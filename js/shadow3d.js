// 影を3Dで出す試験 (docs/設計_影の3D.md, stages 3D-1 and 3D-2): a ghost's 2D points are lifted into 3D joints,
// the joints turn the bones of a VRM body, and the body is drawn ink-black and copied onto the lab's 2D canvas.
// Only shadowlab.html loads this file, and only when one of its "3D" ways of drawing is chosen (three.js is big).
//
// Space (not mirrored; the finished picture is flipped at the very end, like every other ghost renderer):
//   X = x − 0.5 (picture widths; the right of the camera picture, which is the person's left when they face the camera)
//   Y = (0.5 − y) / aspect (up)          Z = towards the viewer
// A VRM faces +Z with its left side at +X, so the person's left arm drives the model's left arm.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { hasDepth } from "./shadowmotion.js";

const LIMBS = [[11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28]];   // upper arm, forearm (L, R), thigh, shin (L, R)
const SPINE = 8;                                                                                 // index of the spine among the signed bones
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pct = (list, p) => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
// a running average over time, forwards and backwards (the recording is looked at afterwards, so nothing lags)
function easeBoth(v, T, sec) {
  const n = v.length, a = new Float64Array(n), b = new Float64Array(n);
  if (!n) return a;
  a[0] = v[0]; for (let i = 1; i < n; i++) a[i] = a[i - 1] + (v[i] - a[i - 1]) * (1 - Math.exp(-(T[i] - T[i - 1]) / 1000 / sec));
  b[n - 1] = v[n - 1]; for (let i = n - 2; i >= 0; i--) b[i] = b[i + 1] + (v[i] - b[i + 1]) * (1 - Math.exp(-(T[i + 1] - T[i]) / 1000 / sec));
  for (let i = 0; i < n; i++) a[i] = (a[i] + b[i]) / 2;
  return a;
}

// ---------- 1. lift: 2D points + bone lengths that never change → 3D joints ----------
// The picture position (x, y) is trusted. The size of a depth step comes from the bone's length and how long it is drawn;
// the recorded depth is only asked which way (towards the viewer or away), and that answer is steadied over time.
// lift.at(tMs) → { 0, 11…28: [X, Y, Z], hc, sc (hip and shoulder centres), U (body length used for sizes) }
export function createLift(g, motion, cfg = {}) {
  const { signGap = 0.08, signEaseSec = 0.25, flatHold = 0.92, flatFull = 0.94, blendSec = 0.08 } = cfg;
  const T = g.frames.map((f) => f[0]), N = T.length, asp = g.aspect || 0.75, D = hasDepth(g);
  const X = (p) => p[0] - 0.5, Y = (p) => (0.5 - p[1]) / asp;
  const flat = (a, b) => Math.hypot(X(b) - X(a), Y(b) - Y(a));
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ((a[2] || 0) + (b[2] || 0)) / 2];
  const poses = T.map((t) => motion.at(t)), metas = T.map((t) => motion.metaAt(t));
  const ends = (p, b) => (b === SPINE ? [mid(p[23], p[24]), mid(p[11], p[12])] : [p[LIMBS[b][0]], p[LIMBS[b][1]]]);
  // one length per bone for the whole ghost: about the longest it is ever drawn; the same for left and right
  const L = []; for (let b = 0; b <= SPINE; b++) L[b] = pct(poses.map((p) => flat(...ends(p, b))), 0.95);
  for (const [l, r] of [[0, 2], [1, 3], [4, 6], [5, 7]]) L[l] = L[r] = Math.max(L[l], L[r]);
  const Wh = pct(poses.map((p) => flat(p[23], p[24])), 0.95), Ws = pct(poses.map((p) => flat(p[11], p[12])), 0.95);
  const step = (b, fl) => { const r = fl / (L[b] * flatFull); return r >= 1 ? 0 : L[b] * Math.sqrt(1 - r * r); };   // how far in depth, never which way
  const rad = (i, k) => { const f = metas[i].facing; return f && f[k] != null ? (f[k] * Math.PI) / 180 : 0; };

  // which way each bone points in depth, frame by frame: +1 towards the viewer, −1 away
  const sign = [];
  for (let b = 0; b <= SPINE; b++) {
    const raw = new Float64Array(N);
    if (D) for (let i = 0; i < N; i++) { const [a, c] = ends(poses[i], b); raw[i] = (c[2] || 0) - (a[2] || 0); }   // recorded depth: negative = nearer the camera
    const sm = easeBoth(raw, T, signEaseSec), s = new Float64Array(N);
    const rest = b === 5 || b === 7 ? -1 : 1;                       // without depth: arms and thighs forwards, shins back
    let cur = D ? (sm[0] <= 0 ? 1 : -1) : rest;
    for (let i = 0; i < N; i++) {
      const fl = flat(...ends(poses[i], b));
      if (D && fl <= L[b] * flatHold) { if (sm[i] < -signGap) cur = 1; else if (sm[i] > signGap) cur = -1; }        // a bone lying flat in the picture keeps its side
      s[i] = cur;
    }
    sign.push(s);
  }
  // knees only bend forwards: of the four ways to place a leg, take one whose knee is in front of the hip–ankle line
  for (const [th, shn, h, k, a] of [[4, 5, 23, 25, 27], [6, 7, 24, 26, 28]]) {
    for (let i = 0; i < N; i++) {
      const p = poses[i], yaw = rad(i, "hips"), front = [-Math.sin(yaw), Math.cos(yaw)];
      const dT = step(th, flat(p[h], p[k])), dS = step(shn, flat(p[k], p[a]));
      let best = null;
      for (const st of [sign[th][i], -sign[th][i]]) for (const ss of [sign[shn][i], -sign[shn][i]]) {
        const kz = st * dT, az = kz + ss * dS;
        const fwd = (X(p[k]) - (X(p[h]) + X(p[a])) / 2) * front[0] + (kz - az / 2) * front[1];
        const cost = (fwd < -0.005 ? 10 : 0) + (st !== sign[th][i] ? 1.5 : 0) + (ss !== sign[shn][i] ? 1 : 0);
        if (!best || cost < best[0]) best = [cost, st, ss];
      }
      sign[th][i] = best[1]; sign[shn][i] = best[2];
    }
  }
  const S = sign.map((s) => easeBoth(s, T, blendSec));               // a change of side passes through "flat" instead of jumping

  let hint = 0;
  return {
    L, hipWidth: Wh, shoulderWidth: Ws, sign,
    at(t) {
      let i = T[hint] <= t ? hint : 0; while (i < N - 1 && T[i + 1] <= t) i++; hint = i;
      const j = Math.min(i + 1, N - 1), k = T[j] > T[i] ? clamp((t - T[i]) / (T[j] - T[i]), 0, 1) : 0;
      const p = motion.at(t), f = motion.metaAt(t).facing, s = (b) => S[b][i] + (S[b][j] - S[b][i]) * k;
      const yawH = f && f.hips != null ? (f.hips * Math.PI) / 180 : 0, yawS = f ? (f.shoulders * Math.PI) / 180 : yawH;
      const J = {}, V = (id, z) => (J[id] = [X(p[id]), Y(p[id]), z]);
      const hc2 = mid(p[23], p[24]), sc2 = mid(p[11], p[12]);
      const scZ = s(SPINE) * step(SPINE, flat(hc2, sc2));
      V(23, (Wh / 2) * Math.sin(yawH)); V(24, (-Wh / 2) * Math.sin(yawH));
      V(11, scZ + (Ws / 2) * Math.sin(yawS)); V(12, scZ - (Ws / 2) * Math.sin(yawS));
      LIMBS.forEach(([a, c], b) => V(c, J[a][2] + s(b) * step(b, flat(p[a], p[c]))));
      V(0, scZ + Ws * 0.35 * Math.cos(yawS));
      J.hc = [X(hc2), Y(hc2), 0]; J.sc = [X(sc2), Y(sc2), scZ]; J.U = L[SPINE]; J.size = L[SPINE] + L[4] + L[5];
      return J;
    },
  };
}

// ---------- a plain check of the lift: the 3D joints seen from the front and from the side ----------
const STICK = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
export function createLiftView(g, motion, cfg = {}) {
  const lift = createLift(g, motion, cfg);
  return {
    lift,
    draw(ctx, pose, box, { aspect = 0.75, time = 0 } = {}) {
      const J = lift.at(time), bw = Math.min(box.w, box.h * aspect), bh = bw / aspect, ox = box.x + (box.w - bw) / 2, oy = box.y + (box.h - bh) / 2;
      // left half: from the front (mirrored like the other drawings); right half: from the person's side, Z across
      const views = [(q) => [ox + bw * 0.27 - (q[0] - J.hc[0]) * bw * 0.9, oy + bh / 2 - q[1] * bw * 0.9], (q) => [ox + bw * 0.75 + q[2] * bw * 0.9, oy + bh / 2 - q[1] * bw * 0.9]];
      ctx.save(); ctx.lineCap = "round"; ctx.lineWidth = Math.max(2, bw / 110);
      views.forEach((P, n) => {
        for (const [a, b] of STICK) {
          const left = a % 2 === 1 && b % 2 === 1, right = a % 2 === 0 && b % 2 === 0;       // odd indices are the person's left
          ctx.strokeStyle = left ? "rgba(255,190,110,0.95)" : right ? "rgba(120,180,255,0.95)" : "rgba(200,205,215,0.8)";
          ctx.beginPath(); ctx.moveTo(...P(J[a])); ctx.lineTo(...P(J[b])); ctx.stroke();
        }
        const h = P(J[0]); ctx.fillStyle = "rgba(230,232,238,0.9)"; ctx.beginPath(); ctx.arc(h[0], h[1], bw / 50, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(150,160,180,0.9)"; ctx.font = `${Math.round(bw / 22)}px system-ui, sans-serif`; ctx.textAlign = "center";
        ctx.fillText(n ? "side →front" : "front", n ? ox + bw * 0.75 : ox + bw * 0.27, oy + bh * 0.06);
      });
      ctx.restore();
    },
  };
}

// ---------- 2. retarget: 3D joints → the rotations of a VRM's bones; 3. draw ----------
// Bones are aimed straight at the joints (no Kalidokit): the parent's rotation is kept and the smallest extra turn is added
// that points the bone from its joint to the next one. What the 13 points do not say is filled in the way games do it:
// the head leans towards the nose, the hands close into fists around the sword and bend only as far as a wrist can,
// and cloth hangs partly from the hips instead of following each leg (cfg.head, cfg.hand, cfg.cloth).
const CHAINS = [["leftUpperArm", "leftLowerArm", "leftHand", 11, 13, 15], ["rightUpperArm", "rightLowerArm", "rightHand", 12, 14, 16],
  ["leftUpperLeg", "leftLowerLeg", "leftFoot", 23, 25, 27], ["rightUpperLeg", "rightLowerLeg", "rightFoot", 24, 26, 28]];
const D2R = Math.PI / 180;

// Cloth (materials whose name matches cfg.cloth.match) gives part of what it takes from each leg to the hips, so a hakama
// or a long hem hangs between the legs instead of splitting with them. Inside a black shadow a leg pushing through is not seen.
function loosenCloth(vrm, share, match, nameOf) {
  if (!(share > 0)) return 0;
  const raw = (n) => vrm.humanoid.getRawBoneNode(n), hips = raw("hips"), legs = [raw("leftUpperLeg"), raw("rightUpperLeg")].filter(Boolean);
  const underLeg = (b) => { for (let o = b; o; o = o.parent) if (legs.includes(o)) return true; return false; };
  let moved = 0;
  vrm.scene.traverse((o) => {
    if (!o.isSkinnedMesh || !match.test(nameOf(o))) return;
    const bones = o.skeleton.bones, hi = bones.indexOf(hips); if (hi < 0) return;
    const leg = new Set(); bones.forEach((b, i) => underLeg(b) && leg.add(i));
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
    for (let v = 0; v < si.count; v++) {
      const idx = [si.getX(v), si.getY(v), si.getZ(v), si.getW(v)], w = [sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v)];
      let take = 0;
      for (let k = 0; k < 4; k++) if (w[k] > 0 && leg.has(idx[k])) { take += w[k] * share; w[k] *= 1 - share; }
      if (!take) continue;
      let slot = idx.findIndex((x, k) => x === hi && w[k] > 0);
      if (slot < 0) slot = w.findIndex((x) => x === 0);
      if (slot < 0) { slot = w.indexOf(Math.min(...w)); take += w[slot]; w[slot] = 0; }   // the weakest pull gives way to the hips
      idx[slot] = hi; w[slot] += take; moved++;
      si.setXYZW(v, ...idx); sw.setXYZW(v, ...w);
    }
    si.needsUpdate = sw.needsUpdate = true;
  });
  return moved;
}
// Wide sleeves that are skinned to the forearm stand out like dishes when the arm is raised (the model has no bones to let
// them hang). Cloth around the arms is pulled in towards the arm, beyond `reach` metres, by `keep` of the way it stuck out.
function narrowSleeves(vrm, keep, reach, match, nameOf) {
  if (!(keep < 1)) return 0;
  const raw = (n) => vrm.humanoid.getRawBoneNode(n);
  vrm.scene.updateMatrixWorld(true);
  let moved = 0;
  for (const side of ["left", "right"]) {
    const top = raw(side + "UpperArm"), hand = raw(side + "Hand"); if (!top || !hand) continue;
    const underArm = (b) => { for (let o = b; o; o = o.parent) { if (o === top) return true; } return false; };
    const a0 = top.getWorldPosition(new THREE.Vector3()), a1 = hand.getWorldPosition(new THREE.Vector3());
    vrm.scene.traverse((o) => {
      if (!o.isSkinnedMesh || !match.test(nameOf(o))) return;
      const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), p0 = a0.clone().applyMatrix4(inv), p1 = a1.clone().applyMatrix4(inv);
      const ax = p1.clone().sub(p0), L = ax.length(); ax.normalize();
      const arm = new Set(); o.skeleton.bones.forEach((b, i) => underArm(b) && arm.add(i));
      const pos = o.geometry.attributes.position, si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, q = new THREE.Vector3();
      for (let v = 0; v < pos.count; v++) {
        let w = 0; for (let k = 0; k < 4; k++) if (arm.has(si.getComponent(v, k))) w += sw.getComponent(v, k);
        if (w < 0.5) continue;
        q.fromBufferAttribute(pos, v);
        const along = clamp(q.clone().sub(p0).dot(ax), 0, L * 1.1), c = p0.clone().addScaledVector(ax, along), r = q.clone().sub(c), d = r.length();
        if (d <= reach) continue;
        r.multiplyScalar((reach + (d - reach) * keep) / d); q.copy(c).add(r); pos.setXYZ(v, q.x, q.y, q.z); moved++;
      }
      pos.needsUpdate = true; o.geometry.computeVertexNormals();
    });
  }
  return moved;
}
// the swinging bones (hems, sleeves): slower and hanging, so they trail the body instead of fluttering
function tuneSprings(vrm, c) {
  const m = vrm.springBoneManager; if (!m || !c) return;
  for (const j of m.joints) {
    const s = j.settings;
    if (c.stiffness != null) s.stiffness = c.stiffness;
    if (c.drag != null) s.dragForce = c.drag;
    if (c.gravity != null) { s.gravityPower = c.gravity; s.gravityDir.set(0, -1, 0); }
  }
}

// Smoke: ink puffs rise from the joints (where a silhouette looks most like a doll) and the outline smoulders.
// Each puff's age comes from the ghost's clock, so pausing and seeking show the same smoke.
const SMOKE_JOINTS = [["neck", 1.2], ["leftUpperArm", 1.1], ["rightUpperArm", 1.1], ["leftLowerArm", 1.2], ["rightLowerArm", 1.2],
  ["leftHand", 0.8], ["rightHand", 0.8], ["chest", 1.0], ["hips", 1.1], ["leftUpperLeg", 1.1], ["rightUpperLeg", 1.1],
  ["leftLowerLeg", 1.2], ["rightLowerLeg", 1.2], ["leftFoot", 0.9], ["rightFoot", 0.9]];
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export async function createVrmRenderer(g, motion, cfg = {}, { aura = [120, 175, 255], smoke = false } = {}) {
  const SMOKE = { puffs: 4, life: 1.1, size: 0.09, rise: 0.12, sway: 0.03, ink: 0.75, glow: 0.35, halo: 0.05, ...(cfg.smoke || {}) };
  const hist = [];                                                   // recent joint positions on the picture: { time, pts }
  const lift = createLift(g, motion, cfg), asp = g.aspect || 0.75;
  const HEAD = { share: 0.5, max: 45, keep: 1, nose: [0, 0.06, 0.1], ...(cfg.head || {}) };
  // posture: the skeleton is trusted for the arms and the sword; the trunk is "sung with reverb" — kept upright and square
  const POSE = { leanKeep: 1, leanMax: 90, twistMax: 180, ...(cfg.posture || {}) };
  const HAND = { fist: [70, 90, 60], bendMax: 35, twistMax: 90, ...(cfg.hand || {}) };
  const CLOTH = { legShare: 0.6, match: "CLOTH", skip: "Shoes", stiffness: 0.5, drag: 0.4, gravity: 0.35, sleeveKeep: 0.25, sleeveReach: 0.06, ...(cfg.cloth || {}) };
  const gl = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  gl.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5 / asp, -0.5 / asp, 0.1, 20);
  cam.position.set(0, 0, 8);
  // ink black; the edges turned away from the viewer catch the light, more on the side the light comes from
  const auraU = { value: new THREE.Color(aura[0] / 255, aura[1] / 255, aura[2] / 255) }, rimU = { value: cfg.rim ?? 1.4 };
  const lightU = { value: new THREE.Vector3(0.6, 0.75, 0.3).normalize() };      // upper right here = upper left once the picture is mirrored
  const ink = () => {
    const m = new THREE.MeshStandardMaterial({ color: 0x020306, roughness: 1, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.aura = auraU; sh.uniforms.rim = rimU; sh.uniforms.lightDir = lightU;
      sh.fragmentShader = "uniform vec3 aura; uniform float rim; uniform vec3 lightDir;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);\n float lit = 0.12 + 0.88 * clamp(dot(normalize(normal), lightDir) * 1.4 + 0.25, 0.0, 1.0);\n totalEmissiveRadiance += aura * fr * lit * rim;");
    };
    return m;
  };
  const loader = new GLTFLoader(); loader.register((p) => new VRMLoaderPlugin(p));
  const gltf = await loader.loadAsync(cfg.model || "assets/models/shadow.vrm"), vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene); VRMUtils.removeUnnecessaryJoints(gltf.scene);
  if (vrm.meta && vrm.meta.metaVersion === "0") VRMUtils.rotateVRM0(vrm);
  const clothRe = new RegExp(CLOTH.match), skipRe = CLOTH.skip ? new RegExp(CLOTH.skip) : null;
  // the material's name as written in the file (the loader does not keep it on every material)
  const nameOf = (o) => {
    const a = gltf.parser.associations.get(o), j = gltf.parser.json;
    const m = a && a.meshes != null ? j.meshes[a.meshes].primitives[a.primitives || 0].material : null;
    return (m != null && j.materials[m] && j.materials[m].name) || (o.material && o.material.name) || "";
  };
  const clothMoved = loosenCloth(vrm, CLOTH.legShare, { test: (n) => clothRe.test(n) && !(skipRe && skipRe.test(n)) }, nameOf);
  const sleeveMoved = narrowSleeves(vrm, CLOTH.sleeveKeep, CLOTH.sleeveReach, { test: (n) => clothRe.test(n) && !(skipRe && skipRe.test(n)) }, nameOf);
  tuneSprings(vrm, CLOTH);
  vrm.scene.traverse((o) => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(ink) : ink(); o.frustumCulled = false; } });
  scene.add(vrm.scene);
  const bone = (name) => vrm.humanoid.getNormalizedBoneNode(name);
  // the body at rest: where the joints are, which way each bone points
  vrm.scene.updateMatrixWorld(true);
  const restPos = (name) => { const b = bone(name); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  const hipRest = restPos("hips"), armL = restPos("leftUpperArm"), armR = restPos("rightUpperArm");
  const torsoRest = armL && armR ? armL.clone().add(armR).multiplyScalar(0.5).distanceTo(hipRest) : 0.5;
  const legRest = (() => { const a = restPos("leftUpperLeg"), b = restPos("leftLowerLeg"), c = restPos("leftFoot"); return a && b && c ? a.distanceTo(b) + b.distanceTo(c) : 0.85; })();
  const restDir = {};
  for (const [up, low, end] of CHAINS) {
    const a = restPos(up), b = restPos(low), c = restPos(end);
    if (a && b) restDir[up] = b.clone().sub(a).normalize();
    if (b && c) restDir[low] = c.clone().sub(b).normalize();
  }
  // the head: from the neck to the nose, at rest (the nose is cfg.head.nose from the head bone, in the model's metres)
  const neckRest = restPos("neck"), headRest = restPos("head");
  const noseRest = neckRest && headRest ? headRest.clone().add(new THREE.Vector3(...HEAD.nose)).sub(neckRest) : null;
  // the hands: closed into fists once (the fingers are never moved again)
  for (const side of ["left", "right"]) {
    const sg = side === "left" ? -1 : 1;                              // a left hand's fingers point +X and curl down: about −Z
    for (const f of ["Index", "Middle", "Ring", "Little"]) ["Proximal", "Intermediate", "Distal"].forEach((p, k) => {
      const b = bone(side + f + p); if (b) b.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), sg * HAND.fist[k] * D2R);
    });
    const tp = bone(side + "ThumbProximal"); if (tp) tp.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -sg * 25 * D2R);
  }
  const blade = new THREE.Color(aura[0] / 255, aura[1] / 255, aura[2] / 255).lerp(new THREE.Color(1, 1, 1), 0.6);
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.008, 1, 0.02), new THREE.MeshBasicMaterial({ color: blade }));
  scene.add(sword);

  const v = (q) => new THREE.Vector3(q[0], q[1], q[2]), UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);
  const basis = (xAxis, up) => {                                       // a rotation from "left" and "up" (up is straightened to be square to left)
    const x = xAxis.clone().normalize(), z = new THREE.Vector3().crossVectors(x, up).normalize(), y = new THREE.Vector3().crossVectors(z, x);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  };
  const put = (name, world, parentWorld) => { const b = bone(name); if (!b) return parentWorld; b.quaternion.copy(parentWorld.clone().invert().multiply(world)); return world; };
  const limit = (q, maxDeg) => {                                       // the same turn, cut down to at most maxDeg
    const a = 2 * Math.acos(clamp(Math.abs(q.w), 0, 1)) / D2R;
    return a <= maxDeg ? q : new THREE.Quaternion().slerp(q, maxDeg / a);
  };
  const flatTo = (v3, axis) => v3.clone().sub(axis.clone().multiplyScalar(v3.dot(axis)));
  const ID = new THREE.Quaternion();
  let lastT = null, lastTime = null;

  function pose(J) {
    // the whole body first: sized so that torso + leg match the person's, hips placed on the picture's hips
    const s = J.size / (torsoRest + legRest);
    vrm.scene.scale.setScalar(s);
    vrm.scene.position.set(J.hc[0] - hipRest.x * s, J.hc[1] - hipRest.y * s, -hipRest.z * s);
    const up = v(J.sc).sub(v(J.hc)); if (up.length() < 1e-5) up.set(0, 1, 0);
    up.normalize();
    // a lean is mostly a misreading (a torso drawn short reads as bent forward): keep part of it, and never more than leanMax
    const lean = up.angleTo(UP) / D2R;
    if (lean > 0.01) {
      const want = POSE.leanMax * Math.tanh((lean * POSE.leanKeep) / POSE.leanMax), axis = new THREE.Vector3().crossVectors(up, UP);
      if (axis.length() > 1e-6) up.applyAxisAngle(axis.normalize(), (lean - want) * D2R);
    }
    // hips follow the shoulders when the two are read more than twistMax apart (a turn read late or wrong at the hips)
    const shX = v(J[11]).sub(v(J[12])), hipX = v(J[23]).sub(v(J[24]));
    const flatUp = (a) => a.clone().sub(up.clone().multiplyScalar(a.dot(up)));
    const hs = flatUp(hipX), ss = flatUp(shX);
    if (hs.length() > 1e-5 && ss.length() > 1e-5) {
      const tw = Math.atan2(new THREE.Vector3().crossVectors(hs, ss).dot(up), hs.dot(ss)) / D2R;
      if (Math.abs(tw) > POSE.twistMax) hipX.applyAxisAngle(up, (tw - Math.sign(tw) * POSE.twistMax) * D2R);
    }
    const qHips = basis(hipX, up), qChest = basis(shX, up);
    put("hips", qHips, ID);
    const qSpine = bone("chest") ? put("spine", qHips.clone().slerp(qChest, 0.5), qHips) : put("spine", qChest, qHips);
    const qTop = bone("chest") ? put("chest", qChest, qSpine) : qSpine;
    const world = {};
    for (const [upper, lower, , a, b, c] of CHAINS) {
      let parent = upper.endsWith("Leg") ? qHips : qTop;
      for (const [name, from, to] of [[upper, a, b], [lower, b, c]]) {
        const d = v(J[to]).sub(v(J[from])), r = restDir[name];
        world[name] = parent;
        if (!r || !bone(name) || d.length() < 1e-5) continue;
        const now = r.clone().applyQuaternion(parent);                 // where the bone points if it only follows its parent
        parent = world[name] = put(name, new THREE.Quaternion().setFromUnitVectors(now, d.normalize()).multiply(parent), parent);
      }
    }
    // the head: neck and head share the turn that brings the nose over the picture's nose (depth from the neck's length)
    if (noseRest && bone("neck") && bone("head")) {
      vrm.scene.updateMatrixWorld(true);
      const neck = bone("neck").getWorldPosition(new THREE.Vector3());
      const r = noseRest.clone().multiplyScalar(s).applyQuaternion(qTop), R = r.length();
      const fl = Math.hypot(J[0][0] - neck.x, J[0][1] - neck.y), dz = Math.sqrt(Math.max(0, R * R - fl * fl));
      const want = new THREE.Vector3(J[0][0] - neck.x, J[0][1] - neck.y, Math.sign(r.z || 1) * dz);
      if (want.length() > 1e-5) {
        const turn = limit(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(r.clone().normalize(), want.normalize()), HEAD.keep), HEAD.max);
        const qNeck = put("neck", new THREE.Quaternion().slerp(turn, HEAD.share).multiply(qTop), qTop);
        put("head", turn.clone().multiply(qTop), qNeck);
      }
    }
    // the sword: along the forearms (the skeleton cannot tell more: docs/設計_影の3D.md), steadied between the two arms
    const fa = v(J[15]).sub(v(J[13])).normalize().add(v(J[16]).sub(v(J[14])).normalize());
    const dir = fa.length() > 1e-5 ? fa.normalize() : UP.clone();
    // the hands: the forearm turns about its length so the thumbs face the body's "up", then the wrist bends towards the sword
    const bodyUp = UP.clone().applyQuaternion(qTop);
    for (const [, lower, hand, , el, wr] of CHAINS.slice(0, 2)) {   // (CHAINS rows: upper, lower, end, joint a, b, c)
      if (!bone(hand) || !world[lower]) continue;
      const axis = v(J[wr]).sub(v(J[el])); if (axis.length() < 1e-5) continue; axis.normalize();
      let ql = world[lower];
      const thumb = flatTo(FWD.clone().applyQuaternion(ql), axis), aim = flatTo(bodyUp, axis);
      if (thumb.length() > 1e-4 && aim.length() > 1e-4) {
        thumb.normalize(); aim.normalize();
        const ang = clamp(Math.atan2(new THREE.Vector3().crossVectors(thumb, aim).dot(axis), thumb.dot(aim)), -HAND.twistMax * D2R, HAND.twistMax * D2R);
        ql = world[lower] = put(lower, new THREE.Quaternion().setFromAxisAngle(axis, ang).multiply(ql), world[lower.replace("Lower", "Upper")]);
      }
      const bend = limit(new THREE.Quaternion().setFromUnitVectors(axis, dir), HAND.bendMax);
      world[hand] = put(hand, bend.multiply(ql), ql);
    }
    // the sword starts between the model's own fists (not the picture's wrists), so it is always held
    vrm.scene.updateMatrixWorld(true);
    const fists = [["leftHand", 1], ["rightHand", -1]].filter(([n]) => bone(n) && world[n])
      .map(([n, sx]) => bone(n).getWorldPosition(new THREE.Vector3()).addScaledVector(new THREE.Vector3(sx, 0, 0).applyQuaternion(world[n]), 0.06 * s));
    const hand = fists.length === 2 ? fists[0].add(fists[1]).multiplyScalar(0.5) : v(J[15]).add(v(J[16])).multiplyScalar(0.5);
    const len = J.U * 2.1;
    sword.position.copy(hand).addScaledVector(dir, len / 2 + J.U * 0.08); sword.quaternion.setFromUnitVectors(UP, dir); sword.scale.set(s, len, s);
  }

  // behind the body: only its blurred glow (the picture itself is drawn far off, its shadow lands in place), drifting up
  function drawHalo(ctx, bw, bh, time) {
    const [ar, ag, ab] = aura, far = bw * 4;
    ctx.save(); ctx.globalAlpha = SMOKE.glow; ctx.shadowColor = `rgba(${ar},${ag},${ab},1)`; ctx.shadowBlur = bw * SMOKE.halo;
    for (let k = 0; k < 2; k++) {
      const ph = (time / 1000) * 1.3 + k * 2.1;
      // drawn at x = far in the mirrored frame = far to the LEFT on the canvas; shadow offsets are not mirrored: move it back right
      ctx.shadowOffsetX = far; ctx.shadowOffsetY = -bw * (0.01 + 0.008 * k);
      ctx.drawImage(gl.domElement, far + Math.sin(ph) * bw * 0.006, 0, bw, bh);
    }
    ctx.restore();
  }
  // the smoke, drawn in the picture's own (mirrored) frame
  function drawSmoke(ctx, bw, bh, aspect, time) {
    const P = (w) => [(w.x + 0.5) * bw, (0.5 - w.y * aspect) * bh];
    const now = SMOKE_JOINTS.map(([n]) => (bone(n) ? P(bone(n).getWorldPosition(new THREE.Vector3())) : null));
    if (hist.length && Math.abs(hist[hist.length - 1].time - time) > 400) hist.length = 0;   // a jump: forget the trail
    hist.push({ time, pts: now }); while (hist.length > 90) hist.shift();
    const at = (t) => { let best = hist[hist.length - 1]; for (const h of hist) if (Math.abs(h.time - t) < Math.abs(best.time - t)) best = h; return best.pts; };
    const [ar, ag, ab] = aura, L = SMOKE.life;
    // ink puffs at the joints, rising, widening and fading: ink on the ink body is unseen, so they only soften the outline
    ctx.save(); ctx.shadowBlur = 0;
    SMOKE_JOINTS.forEach(([, w], j) => {
      for (let k = 0; k < SMOKE.puffs; k++) {
        const seed = j * 13 + k, age = (((time / 1000 + (k / SMOKE.puffs) * L + hash(seed) * L) % L) + L) % L, u = age / L;
        const from = at(time - age * 1000)[j]; if (!from) continue;
        const r = bw * SMOKE.size * w * (0.45 + 0.9 * u) * (0.8 + 0.4 * hash(seed + 5));
        const x = from[0] + Math.sin(time / 1000 * 2 + seed) * bw * SMOKE.sway * u, y = from[1] - bw * SMOKE.rise * u * (0.7 + 0.6 * hash(seed + 9));
        const a = Math.pow(1 - u, 1.5) * SMOKE.ink;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(3,4,8,${a})`); gr.addColorStop(0.5, `rgba(3,4,8,${a * 0.6})`); gr.addColorStop(1, "rgba(3,4,8,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.restore();
  }

  return {
    lift, vrm, rest: { torsoRest, hipRest, restDir }, clothMoved, sleeveMoved,
    draw(ctx, _pose, box, { aspect = asp, t = performance.now(), time = 0 } = {}) {
      const bw = Math.round(Math.min(box.w, box.h * aspect)), bh = Math.round(bw / aspect), ox = box.x + (box.w - bw) / 2, oy = box.y + (box.h - bh) / 2;
      if (gl.domElement.width !== bw || gl.domElement.height !== bh) gl.setSize(bw, bh, false);
      const jump = lastT == null || t < lastT || t - lastT > 400 || lastTime == null || Math.abs(time - lastTime) > 400;
      const dt = jump ? 0 : Math.min(0.05, (t - lastT) / 1000); lastT = t; lastTime = time;
      pose(lift.at(time));
      if (jump && vrm.springBoneManager) vrm.springBoneManager.reset();
      vrm.update(dt);
      gl.render(scene, cam);
      ctx.save();
      ctx.translate(ox + bw, oy); ctx.scale(-1, 1);                    // mirrored, like every other ghost drawing
      ctx.shadowColor = `rgba(${aura[0]},${aura[1]},${aura[2]},0.55)`; ctx.shadowBlur = bw * 0.035;
      if (smoke) drawHalo(ctx, bw, bh, time);
      ctx.drawImage(gl.domElement, 0, 0, bw, bh);
      if (smoke) drawSmoke(ctx, bw, bh, aspect, time);
      ctx.restore();
    },
  };
}
