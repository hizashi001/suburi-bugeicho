// Gear and sword-part rolls. Every function here is a pure function of its seed and inputs,
// so the same roll can later run on a server and be checked against the client.

export const ARMOR = ["hachigane", "kote", "do", "suneate", "omamori"];
export const SWORD_PARTS = ["tosin", "saya", "tsuba", "tsuka"];
export const SLOTS = [...ARMOR, ...SWORD_PARTS];
export const NAMED_GRADE = 5;

// mulberry32: small, fast, good enough for loot
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

function pickWeighted(r, weights) {
  let x = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
  return weights.length - 1;
}

// a value inside [lo, hi] × scale; the top 5% of the range earns the 極 mark
function rollValue(r, key, [lo, hi], scale, kiwamiAt) {
  const u = r();
  const v = (lo + (hi - lo) * u) * scale;
  return { key, v: +v.toFixed(key === "combo_cap" ? 2 : 1), kiwami: u >= kiwamiAt };
}

export function rollGrade(r, L, { taisho = false, floor = 0 } = {}) {
  const w = L.grades.map((g) => g.weight);
  let g = pickWeighted(r, w);
  if (taisho) g = Math.max(g, pickWeighted(r, w)); // 大将: the better of two rolls
  return Math.max(g, floor);
}

// one item. opts: { grade } for an unnamed piece, or { named: swordId } for a part of a named sword.
// kind = the player's kind ("katana" | "tanto"); sword parts lean toward it by L.kindBias.
export function rollItem(r, L, SW, opts) {
  const named = opts.named ? SW.swords.find((s) => s.id === opts.named) : null;
  const slot = opts.slot || (named ? SWORD_PARTS[Math.floor(r() * 4)] : SLOTS[Math.floor(r() * SLOTS.length)]);
  const isPart = SWORD_PARTS.includes(slot);
  const other = opts.kind === "katana" ? "tanto" : "katana";
  const kind = named ? named.kind : isPart ? (r() < L.kindBias ? opts.kind : other) : null;
  const grade = named ? NAMED_GRADE : opts.grade;
  const g = named
    ? { main: L.named.main, affixes: L.named.fixed + L.named.random, rareChance: 0, scale: L.named.scale }
    : L.grades[grade];
  const mainKey = L.slotMain[slot];
  const main = rollValue(r, mainKey, g.main, 1, L.kiwami);
  const pool = Object.keys(L.affixes).filter((k) => k !== mainKey);
  const affixes = [];
  if (named) {
    const fk = L.namedFixed[named.id];
    if (fk && pool.includes(fk)) {
      pool.splice(pool.indexOf(fk), 1);
      affixes.push({ ...rollValue(r, fk, L.affixes[fk], g.scale, L.kiwami), fixed: true });
    }
  }
  while (affixes.length < g.affixes && pool.length) {
    const k = pool.splice(Math.floor(r() * pool.length), 1)[0];
    affixes.push(rollValue(r, k, L.affixes[k], g.scale, L.kiwami));
  }
  const rare = r() < g.rareChance ? L.rares[Math.floor(r() * L.rares.length)] : null;
  return { slot, kind, grade, named: named ? named.id : null, main, affixes, rare };
}

// everything one defeated yokai drops.
// ctx: { asset, boss, gold, taisho, kind, dropRate (%) }
export function rollDrops(seed, L, SW, ctx) {
  const r = makeRng(seed);
  const out = [];
  const n = 1 + (r() < L.extraDropChance * (1 + (ctx.dropRate || 0) / 100) ? 1 : 0);
  for (let i = 0; i < n; i++) {
    let floor = ctx.gold ? L.goldFloor : 0;
    if (ctx.boss && i === 0) floor = Math.max(floor, L.bossFloor);
    out.push(rollItem(r, L, SW, { grade: rollGrade(r, L, { taisho: ctx.taisho, floor }), kind: ctx.kind }));
  }
  for (const s of SW.swords) {
    if (s.source.id === ctx.asset && r() < (ctx.boss ? L.namedDrop.boss : L.namedDrop.yokai)) out.push(rollItem(r, L, SW, { named: s.id }));
    if (s.source.id === "yokai_rare" && !ctx.boss && r() < L.namedDrop.yokaiRare) out.push(rollItem(r, L, SW, { named: s.id }));
  }
  return out;
}
