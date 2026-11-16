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
// that points the bone from its joint to the next one. The twist of an arm about its own length is unknown and left alone.
const CHAINS = [["leftUpperArm", "leftLowerArm", "leftHand", 11, 13, 15], ["rightUpperArm", "rightLowerArm", "rightHand", 12, 14, 16],
  ["leftUpperLeg", "leftLowerLeg", "leftFoot", 23, 25, 27], ["rightUpperLeg", "rightLowerLeg", "rightFoot", 24, 26, 28]];
export async function createVrmRenderer(g, motion, cfg = {}, { aura = [120, 175, 255] } = {}) {
  const lift = createLift(g, motion, cfg), asp = g.aspect || 0.75;
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
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.008, 1, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(aura[0] / 255, aura[1] / 255, aura[2] / 255).lerp(new THREE.Color(1, 1, 1), 0.6) }));
  scene.add(sword);

  const v = (q) => new THREE.Vector3(q[0], q[1], q[2]), UP = new THREE.Vector3(0, 1, 0);
  const basis = (xAxis, up) => {                                       // a rotation from "left" and "up" (up is straightened to be square to left)
    const x = xAxis.clone().normalize(), z = new THREE.Vector3().crossVectors(x, up).normalize(), y = new THREE.Vector3().crossVectors(z, x);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  };
  const put = (name, world, parentWorld) => { const b = bone(name); if (!b) return parentWorld; b.quaternion.copy(parentWorld.clone().invert().multiply(world)); return world; };
  const ID = new THREE.Quaternion();
  let lastT = null, lastTime = null;

  function pose(J) {
    const up = v(J.sc).sub(v(J.hc)); if (up.length() < 1e-5) up.set(0, 1, 0);
    const qHips = basis(v(J[23]).sub(v(J[24])), up), qChest = basis(v(J[11]).sub(v(J[12])), up);
    put("hips", qHips, ID);
    const qSpine = bone("chest") ? put("spine", qHips.clone().slerp(qChest, 0.5), qHips) : put("spine", qChest, qHips);
    const qTop = bone("chest") ? put("chest", qChest, qSpine) : qSpine;
    for (const [upper, lower, , a, b, c] of CHAINS) {
      let parent = upper.endsWith("Leg") ? qHips : qTop;
      for (const [name, from, to] of [[upper, a, b], [lower, b, c]]) {
        const d = v(J[to]).sub(v(J[from])), r = restDir[name];
        if (!r || !bone(name) || d.length() < 1e-5) continue;
        const now = r.clone().applyQuaternion(parent);                 // where the bone points if it only follows its parent
        parent = put(name, new THREE.Quaternion().setFromUnitVectors(now, d.normalize()).multiply(parent), parent);
      }
    }
    // the whole body: sized by the torso, hips placed on the picture's hips
    const s = J.size / (torsoRest + legRest);                       // sized so that torso + leg match the person's
    vrm.scene.scale.setScalar(s);
    vrm.scene.position.set(J.hc[0] - hipRest.x * s, J.hc[1] - hipRest.y * s, -hipRest.z * s);
    // the sword: from between the hands, along the forearms (its true direction is not known from the skeleton)
    const hand = v(J[15]).add(v(J[16])).multiplyScalar(0.5), elbow = v(J[13]).add(v(J[14])).multiplyScalar(0.5), dir = hand.clone().sub(elbow);
    if (dir.length() > 1e-5) {
      dir.normalize(); const len = J.U * 2.1;
      sword.position.copy(hand).addScaledVector(dir, len / 2 + J.U * 0.08); sword.quaternion.setFromUnitVectors(UP, dir); sword.scale.set(s, len, s);
    }
  }

  return {
    lift, vrm, rest: { torsoRest, hipRest, restDir },
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
      ctx.drawImage(gl.domElement, 0, 0, bw, bh);
      ctx.restore();
    },
  };
}
