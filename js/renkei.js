// 連携 (link): the one gateway between the main app (本体) and 侍の旅 (tabi).
// Both sides read and write a single localStorage entry, separate from the main save
// (the main app rewrites its own save whole, so shared data must not live inside it).
//
//   localStorage["ghost-renkei.v1"] = {
//     ver: 1,
//     hontai: { ... },   // written only by the main app, read by the journey
//     tabi:   { ... },   // written only by the journey, read by the main app
//   }
//
// Each side rewrites only its own half and re-reads the entry before every write,
// so the two pages can be open at the same time without wiping each other.
// Every number comes from config/balance.json ("shugyo"); nothing is hard-coded here.
// The shapes are documented in docs/連携報告.md, chapter 2.

export const RENKEI_KEY = "ghost-renkei.v1";
export const RENKEI_VER = 1;

// the day turns over at 22:00 in Japan (UTC 13:00) for everyone — the same rule as the main app
const DAY_MS = 86400000, TURN_MS = 13 * 3600000;
export const dayId = (now = Date.now()) => Math.floor((now - TURN_MS) / DAY_MS);

// what is counted each day. The first four earn 修行点; "boss" and "swings" are plain tallies for the daily quests.
export const EVENT_KINDS = ["tabata", "yokai", "climb", "kiwami", "boss", "swings"];
// the two kinds that are fights against a yokai: their points can also be paid by time fought (cfg.fightBy = "time")
export const FIGHT_KINDS = ["yokai", "climb"];
const noEvents = () => Object.fromEntries(EVENT_KINDS.map((k) => [k, 0]));
const noMs = () => Object.fromEntries(FIGHT_KINDS.map((k) => [k, 0]));
const freshShugyo = (day) => ({ day, events: noEvents(), ms: noMs(), prevDay: null, prevRate: null, prevStreak: 0 });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (v) => Math.round(v * 100) / 100;

// ---------- 修行点 and 修行の倍率: pure functions of the stored state, the day and the settings ----------
// sh  = { day, events: {tabata, yokai, climb, kiwami, boss, swings}, ms: {yokai, climb}, prevDay, prevRate, prevStreak }
//       day/events/ms are the day in progress (ms = time spent fighting, each kill capped); prev* describe the last earlier day that had any points
// cfg = balance.json "shugyo"

// today's points. Kept as counts and milliseconds, so 0.8 never piles up rounding errors.
// cfg.fightBy: "count" = each yokai / floor is worth cfg.points; "time" = one point per cfg.time.secPerPoint seconds of fighting.
export function pointsOf(sh, cfg) {
  const byTime = cfg.fightBy === "time";
  const sum = EVENT_KINDS.reduce((s, k) => s + (byTime && FIGHT_KINDS.includes(k)
    ? ((sh.ms && sh.ms[k]) || 0) / 1000 / cfg.time.secPerPoint
    : (sh.events[k] || 0) * (cfg.points[k] || 0)), 0);
  return Math.round(sum * 10) / 10;
}
// the multiplier a day starts from: the last trained day's value, minus the decay for days of rest.
// The first freeRestDays of rest cost nothing; each day after that costs decayPerDay.
export function baseRate(sh, cfg, day = sh.day) {
  if (sh.prevDay == null) return cfg.min;
  const rest = Math.max(0, day - sh.prevDay - 1); // whole days without training before `day`
  return clamp(sh.prevRate - cfg.decayPerDay * Math.max(0, rest - cfg.freeRestDays), cfg.min, cfg.max);
}
// the multiplier right now: the day's base plus up to gainPerDay, in proportion to today's points (fullPoints = all of it)
export function rateOf(sh, cfg) {
  const share = Math.min(pointsOf(sh, cfg), cfg.fullPoints) / cfg.fullPoints;
  return round2(clamp(baseRate(sh, cfg) + cfg.gainPerDay * share, cfg.min, cfg.max));
}
// days in a row with any points. Before today's first point, yesterday's run still stands.
export function streakOf(sh, cfg) {
  const linked = sh.prevDay != null && sh.prevDay === sh.day - 1;
  return pointsOf(sh, cfg) > 0 ? (linked ? sh.prevStreak : 0) + 1 : linked ? sh.prevStreak : 0;
}
// move the state to `day`: a finished day that had points becomes the new "prev"
export function rollTo(sh, cfg, day) {
  if (!sh || typeof sh.day !== "number" || !sh.events) return freshShugyo(day);
  if (sh.day === day) return { ...sh, events: { ...noEvents(), ...sh.events }, ms: { ...noMs(), ...sh.ms } };
  if (day < sh.day) return { ...sh, day, events: noEvents(), ms: noMs() }; // the clock went back: keep the history, start the day clean
  const trained = pointsOf(sh, cfg) > 0;
  return {
    day, events: noEvents(), ms: noMs(),
    prevDay: trained ? sh.day : sh.prevDay,
    prevRate: trained ? rateOf(sh, cfg) : sh.prevRate,
    prevStreak: trained ? streakOf(sh, cfg) : sh.prevStreak,
  };
}

// ---------- the store ----------
function readAll() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(RENKEI_KEY) || "null"); } catch {}
  if (!o || typeof o !== "object" || o.ver !== RENKEI_VER) o = { ver: RENKEI_VER };
  o.hontai = o.hontai && typeof o.hontai === "object" ? o.hontai : {};
  o.tabi = o.tabi && typeof o.tabi === "object" ? o.tabi : {};
  return o;
}
function writeHalf(side, fn, now) {
  const all = readAll();
  const half = all[side];
  fn(half);
  half.updatedAt = now;
  try { localStorage.setItem(RENKEI_KEY, JSON.stringify(all)); return true; } catch { return false; }
}
// the derived numbers are stored next to the raw state, so a reader that only wants "today's multiplier" needs no arithmetic.
// They are true for `day`; a reader on a later day should call summary() instead (it re-applies the rest-day rule).
function stamp(h, cfg, day) {
  h.shugyo = rollTo(h.shugyo, cfg, day);
  h.shugyo.points = pointsOf(h.shugyo, cfg);
  h.shugyo.rate = rateOf(h.shugyo, cfg);
  h.shugyo.streak = streakOf(h.shugyo, cfg);
  h.shugyo.fullPoints = cfg.fullPoints;
}

// ---------- 本体 → 旅 ----------
// training happened. counts = { kind: how many }, ms = { yokai | climb: how long that one fight took }.
// One call is one fight (or one round, one swing…), so the time is capped here at cfg.time.maxPerKill points' worth.
// Returns the new summary.
export function addEvents(cfg, { counts = {}, ms = {}, now = Date.now() } = {}) {
  for (const k of Object.keys(counts)) if (!EVENT_KINDS.includes(k)) throw new Error("renkei: unknown event " + k);
  for (const k of Object.keys(ms)) if (!FIGHT_KINDS.includes(k)) throw new Error("renkei: no fight time for " + k);
  const capMs = cfg.time.maxPerKill * cfg.time.secPerPoint * 1000;
  writeHalf("hontai", (h) => {
    h.shugyo = rollTo(h.shugyo, cfg, dayId(now));
    for (const [k, n] of Object.entries(counts)) h.shugyo.events[k] += n;
    for (const [k, v] of Object.entries(ms)) h.shugyo.ms[k] += Math.max(0, Math.min(v, capMs));
    stamp(h, cfg, dayId(now));
  }, now);
  return summary(cfg, now);
}
export const addEvent = (kind, cfg, { n = 1, now = Date.now() } = {}) => addEvents(cfg, { counts: { [kind]: n }, now });
// 極みの試練 passed. res = { id, name_ja, name_en, seq, level, need, clean, top }
// One entry per technique: the strictest pass is kept, and the 緩めずに合格 mark is never taken away.
export function recordTrial(res, cfg, { now = Date.now() } = {}) {
  writeHalf("hontai", (h) => {
    h.kiwami = h.kiwami || {};
    const old = h.kiwami[res.id];
    h.kiwami[res.id] = {
      name_ja: res.name_ja, name_en: res.name_en, seq: res.seq,
      level: Math.max(res.level, old ? old.level : 0),
      clean: !!(res.clean || (old && old.clean)),
      passes: (old ? old.passes : 0) + 1,
      day: dayId(now), at: now,
    };
    stamp(h, cfg, dayId(now));
  }, now);
}
// a yokai fell. rec = { yokai, timeMs, points, wave, maxHp, variant, boss, mode, division, diff, kg, ghostId }
// Kept per yokai: the fastest kill ("fast") and the highest score ("top"), each with the conditions it was made under.
export function recordKill(rec, cfg, { now = Date.now() } = {}) {
  writeHalf("hontai", (h) => {
    h.best = h.best || {};
    const b = (h.best[rec.yokai] = h.best[rec.yokai] || {});
    const { yokai, ...rest } = rec;
    const entry = { ...rest, day: dayId(now), at: now };
    if (!b.fast || rec.timeMs < b.fast.timeMs) b.fast = entry;
    if (!b.top || rec.points > b.top.points) b.top = entry;
    stamp(h, cfg, dayId(now));
  }, now);
}

// ---------- 旅 → 本体 ----------
// the journey replaces its half (or part of it): { trials: [...], revenge: [...], items: [...] }
export function writeTabi(patch, { now = Date.now() } = {}) {
  return writeHalf("tabi", (tb) => Object.assign(tb, patch), now);
}
export function readTabi() {
  const tb = readAll().tabi;
  return {
    updatedAt: tb.updatedAt || 0,
    // techniques the journey lets the player attempt: { id, name_ja, name_en, seq: [form ids], gapSec, level }
    trials: (Array.isArray(tb.trials) ? tb.trials : []).filter((x) => x && typeof x.id === "string" && Array.isArray(x.seq) && x.seq.length >= 2),
    // 仇討ち requests: { id, yokai, targetMs, from, until, ghost }  (shape still open — see the report's questions)
    revenge: Array.isArray(tb.revenge) ? tb.revenge : [],
    // belongings: passed through untouched until the two inventories are designed together
    items: Array.isArray(tb.items) ? tb.items : [],
  };
}

// ---------- reading (either side) ----------
// what the main app has to tell, as of `now`: the multiplier already has the rest-day rule applied for today
export function summary(cfg, now = Date.now()) {
  const h = readAll().hontai;
  const sh = rollTo(h.shugyo, cfg, dayId(now));
  return {
    day: sh.day, rate: rateOf(sh, cfg), base: baseRate(sh, cfg), points: pointsOf(sh, cfg), fullPoints: cfg.fullPoints,
    streak: streakOf(sh, cfg), events: { ...sh.events }, ms: { ...sh.ms }, fightBy: cfg.fightBy,
    kiwami: h.kiwami || {}, best: h.best || {}, updatedAt: h.updatedAt || 0,
  };
}
// the whole entry, for the report and for debugging
export const dump = () => readAll();
