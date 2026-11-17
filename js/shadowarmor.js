// 仮の鎧武者 (docs/設計_影の3D.md 第3D-2.9段): rigid armour pieces built from simple shapes and hung on a VRM's bones,
// with the joints (neck, shoulders, elbows, wrists, waist, knees, ankles) left empty for the drawing to fill with haze.
// A test of the idea "a model whose joints are not drawn" before a real model is made. Each piece follows one bone only,
// so nothing ever bends or stretches. Sizes are in the model's metres; the VRM's own body is hidden.
import * as THREE from "three";

// pieces: [bone, kind, params]; positions along a limb are fractions of the bone's length (0 = its joint, 1 = the next joint)
const LIMB = [
  ["UpperArm", "LowerArm", { from: 0.18, to: 0.8, r0: 0.062, r1: 0.055 }],      // sleeve armour of the upper arm
  ["LowerArm", "Hand", { from: 0.16, to: 0.88, r0: 0.052, r1: 0.04 }],         // kote
  ["UpperLeg", "LowerLeg", { from: 0.1, to: 0.8, r0: 0.1, r1: 0.15 }],          // haidate / hakama, flaring out
  ["LowerLeg", "Foot", { from: 0.16, to: 0.88, r0: 0.065, r1: 0.055 }],        // suneate
];

export function buildArmor(vrm, cfg = {}) {
  const C = { gap: 1, ...cfg };
  const bone = (n) => vrm.humanoid.getNormalizedBoneNode(n);
  vrm.scene.updateMatrixWorld(true);
  const W = (n) => { const b = bone(n); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  const mat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const parts = [];
  // a piece is placed in world space at rest, then hung on the bone keeping that place (normalized bones have no rest rotation)
  const hang = (name, mesh, worldPos) => {
    const b = bone(name); if (!b) return;
    mesh.position.copy(worldPos.clone().sub(W(name)));
    b.add(mesh); parts.push(mesh);
  };
  const tube = (a, b, r0, r1, seg = 14) => {                          // a tapering tube from a to b (open), lying along a→b
    const d = b.clone().sub(a), L = d.length();
    const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, false);
    const m = new THREE.Mesh(g, mat); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return [m, a.clone().add(b).multiplyScalar(0.5)];
  };
  for (const side of ["left", "right"]) {
    for (const [p, c, o] of LIMB) {
      const a = W(side + p), b = W(side + c); if (!a || !b) continue;
      const g = (o.to - o.from) * C.gap + (1 - C.gap), f0 = o.from * C.gap, f1 = f0 + g;
      const [m, at] = tube(a.clone().lerp(b, f0), a.clone().lerp(b, f1), o.r0, o.r1); hang(side + p, m, at);
    }
    // sode: a big square plate on top of the upper arm (outside of it when the arm hangs), curving a little
    const sh = W(side + "UpperArm"), el = W(side + "LowerArm"), sx = side === "left" ? 1 : -1;
    if (sh && el) {
      const g = new THREE.CylinderGeometry(0.2, 0.2, 0.2, 10, 1, true, -0.55, 1.1);    // a slice of a cylinder: a curved plate
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x111111, side: THREE.DoubleSide }));
      m.rotation.set(0, 0, sx * Math.PI / 2); m.scale.set(1, 1.15, 1);
      hang(side + "UpperArm", m, sh.clone().lerp(el, 0.42).add(new THREE.Vector3(0, -0.12, 0)));
    }
    // hands: fists; feet: shoes
    const h = W(side + "Hand"); if (h) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), mat); m.scale.set(1.4, 1, 1); hang(side + "Hand", m, h.clone().add(new THREE.Vector3(sx * 0.06, 0, 0.01))); }
    const ft = W(side + "Foot"); if (ft) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.25), mat); hang(side + "Foot", m, ft.clone().add(new THREE.Vector3(0, -0.04, 0.06))); }
  }
  // do (cuirass) on the chest: wider at the chest, narrowing to the waist, flattened front to back
  const ch = W("chest") || W("spine"), hp = W("hips"), hd = W("head"), nk = W("neck");
  if (ch && hp) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.36, 18), mat); m.scale.set(1, 1, 0.72);
    hang(bone("chest") ? "chest" : "spine", m, ch.clone().add(new THREE.Vector3(0, 0.02, 0.0)));
    // kusazuri: five plates hanging from the waist all round, leaning out
    for (let k = 0; k < 5; k++) {
      const ang = -Math.PI / 2 + (k / 5) * Math.PI * 2 + Math.PI / 5, r = 0.17;
      const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.26, 0.018), mat);
      const at = hp.clone().add(new THREE.Vector3(Math.cos(ang) * r, -0.1, Math.sin(ang) * r * 0.85));
      m2.rotation.set(0, -ang + Math.PI / 2, 0); m2.rotateX(-0.22 * (Math.sin(ang) > -0.5 ? 1 : 1));
      hang("hips", m2, at);
    }
  }
  // the head: a kabuto (dome, a flaring neck guard, two kuwagata horns) over a round head, the neck left empty
  if (hd && nk) {
    const top = hd.clone().add(new THREE.Vector3(0, 0.1, 0.0));
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), mat); face.scale.set(0.95, 1.05, 1); hang("head", face, hd.clone().add(new THREE.Vector3(0, 0.07, 0.02)));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat); hang("head", dome, top.clone().add(new THREE.Vector3(0, 0.02, -0.01)));
    const shikoro = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.22, 0.11, 18, 1, true, Math.PI * 0.15, Math.PI * 1.7), new THREE.MeshStandardMaterial({ color: 0x111111, side: THREE.DoubleSide }));
    hang("head", shikoro, top.clone().add(new THREE.Vector3(0, -0.035, -0.015)));
    for (const sx of [1, -1]) {
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(sx * 0.05, 0.06, 0.03), new THREE.Vector3(sx * 0.1, 0.14, 0.0), new THREE.Vector3(sx * 0.11, 0.2, -0.04)];
      const horn = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.02, 6, false), mat); horn.scale.set(1, 1, 0.4);   // flat blades
      hang("head", horn, top.clone().add(new THREE.Vector3(sx * 0.015, 0.03, 0.12)));
    }
  }
  return parts;
}

// A made armour (tools/models/make_parts.py): one piece per bone, named "part_" + the VRM bone's name, already placed in
// the VRM's rest space with the joints cut away. Each piece is hung on its bone, keeping its place.
export async function loadArmorParts(vrm, url) {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  vrm.scene.updateMatrixWorld(true);
  const parts = [], mat = new THREE.MeshStandardMaterial({ color: 0x111111, side: THREE.DoubleSide });
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const name = (o.name || (o.parent && o.parent.name) || "").replace(/^part_/, "").replace(/_\d+$/, "");
    const b = vrm.humanoid.getNormalizedBoneNode(name); if (!b) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
    m.position.copy(b.getWorldPosition(new THREE.Vector3())).multiplyScalar(-1);
    parts.push([b, m]);
  });
  for (const [b, m] of parts) b.add(m);
  return parts.map((p) => p[1]);
}

// A whole body that bends at the joints (tools/models/make_ronin.py): one mesh with a grey per point, already in the VRM's
// rest space. It is bound here to the VRM's bones: each point follows the nearest bones, weighted by closeness, so the
// joints bend softly (they are hidden under smoke anyway). The model needs no bones of its own.
const SKIN_SEGS = [["hips", "hips", "spine"], ["spine", "spine", "chest"], ["chest", "chest", "neck"], ["neck", "neck", "head"], ["head", "head", null],
  ["leftUpperArm", "leftUpperArm", "leftLowerArm"], ["leftLowerArm", "leftLowerArm", "leftHand"], ["leftHand", "leftHand", "leftMiddleProximal"],
  ["rightUpperArm", "rightUpperArm", "rightLowerArm"], ["rightLowerArm", "rightLowerArm", "rightHand"], ["rightHand", "rightHand", "rightMiddleProximal"],
  ["leftUpperLeg", "leftUpperLeg", "leftLowerLeg"], ["leftLowerLeg", "leftLowerLeg", "leftFoot"], ["leftFoot", "leftFoot", "leftToes"],
  ["rightUpperLeg", "rightUpperLeg", "rightLowerLeg"], ["rightLowerLeg", "rightLowerLeg", "rightFoot"], ["rightFoot", "rightFoot", "rightToes"]];
export async function loadSkinnedBody(vrm, url, material, cfg = {}) {
  const C = { power: 4, near: 0.01, headFrom: 0.6, headReach: 0.3, backDepth: 0.12, ...cfg };
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().loadAsync(url);
  let src = null; gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
  gltf.scene.updateMatrixWorld(true);
  const g = src.geometry.clone(); g.applyMatrix4(src.matrixWorld); g.computeVertexNormals();
  vrm.scene.updateMatrixWorld(true);
  const node = (n) => vrm.humanoid.getNormalizedBoneNode(n), W = (n) => { const b = node(n); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  const segs = SKIN_SEGS.filter(([n, a]) => node(n) && W(a)).map(([n, a, b]) => {
    const A = W(a), B = b && W(b) ? W(b) : A.clone().add(new THREE.Vector3(0, b ? -0.08 : 0.25, 0));
    return { name: n, bone: node(n), A, AB: B.clone().sub(A) };
  });
  // who is next to whom (parent and children), by name
  const PARENT = { spine: "hips", chest: "spine", neck: "chest", head: "neck", leftUpperArm: "chest", rightUpperArm: "chest", leftLowerArm: "leftUpperArm", rightLowerArm: "rightUpperArm",
    leftHand: "leftLowerArm", rightHand: "rightLowerArm", leftUpperLeg: "hips", rightUpperLeg: "hips", leftLowerLeg: "leftUpperLeg", rightLowerLeg: "rightUpperLeg", leftFoot: "leftLowerLeg", rightFoot: "rightLowerLeg" };
  segs.forEach((s) => { s.nb = segs.map((o, k) => (PARENT[o.name] === s.name || PARENT[s.name] === o.name ? k : -1)).filter((k) => k >= 0); });
  const head = segs.findIndex((s) => s.name === "head"), headAt = head >= 0 ? segs[head].A : null;
  const neckY = W("neck") ? W("neck").y : 0, headCut = headAt ? neckY + (headAt.y - neckY) * C.headFrom : Infinity;
  const chest = segs.findIndex((s) => s.name === "chest"), backZ = chest >= 0 ? segs[chest].A.z : 0, hipY = W("hips") ? W("hips").y : 0;
  const pos = g.attributes.position, n = pos.count, idx = new Uint16Array(n * 4), wts = new Float32Array(n * 4), p = new THREE.Vector3(), d = new Float32Array(segs.length);
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    segs.forEach((s, k) => {
      const t = Math.max(0, Math.min(1, p.clone().sub(s.A).dot(s.AB) / Math.max(1e-9, s.AB.lengthSq())));
      d[k] = p.distanceTo(s.A.clone().addScaledVector(s.AB, t));
    });
    let near = 0; for (let k = 1; k < segs.length; k++) if (d[k] < d[near]) near = k;
    if (head >= 0 && p.y > headCut && Math.hypot(p.x - headAt.x, p.z - headAt.z) < C.headReach) { idx[i * 4] = head; wts[i * 4] = 1; continue; }
    // things on the back (wings, a quiver...): behind the back, between the waist and the neck → the chest alone
    if (chest >= 0 && p.z < backZ - C.backDepth && p.y > hipY && p.y < neckY + 0.05) { idx[i * 4] = chest; wts[i * 4] = 1; continue; }
    const order = [near, ...segs[near].nb].sort((a, b) => d[a] - d[b]).slice(0, 4);
    let sum = 0; const w = order.map((k) => { const v = 1 / Math.pow(d[k] + C.near, C.power); sum += v; return v; });
    order.forEach((k, j) => { idx[i * 4 + j] = k; wts[i * 4 + j] = w[j] / sum; });
  }
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(wts, 4));
  const bones = segs.map((s) => s.bone);
  const skel = new THREE.Skeleton(bones, bones.map((b) => b.matrixWorld.clone().invert()));
  const mesh = new THREE.SkinnedMesh(g, material); mesh.frustumCulled = false;
  vrm.scene.add(mesh); mesh.updateMatrixWorld(true); mesh.bind(skel, mesh.matrixWorld.clone());
  // the eyes, in the head bone's frame: at eyeY above the head bone, the front-most face points 2–5 cm either side
  if (headAt) {
    const y0 = headAt.y + (C.eyeY ?? 0.06); let zf = -Infinity;
    for (let i = 0; i < n; i++) { const y = pos.getY(i), x = pos.getX(i); if (Math.abs(y - y0) < 0.015 && Math.abs(x - headAt.x) < 0.05) zf = Math.max(zf, pos.getZ(i)); }
    if (zf > -Infinity) mesh.userData.eyes = [C.eyeGap ?? 0.032, y0 - headAt.y, zf - headAt.z + 0.004];
  }
  return mesh;
}
