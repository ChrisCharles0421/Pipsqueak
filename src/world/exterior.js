// Exterior estate grounds: original compact layout connecting the house to the sewer entrance.
// Fenced plot surrounded by dense woodland; retaining wall with a drainage culvert at the back.
import * as THREE from 'three';
import { box, mats, lamp, px, pz } from './builder.js';
import { P, place } from './props.js';

export const GROUNDS = { x0: -10, x1: 30, z0: -20, z1: 34 };
export const CULVERT = { x0: 3.1, x1: 4.9, zFace: -20.0 };
const HOUSE = { x0: 0, x1: px(657), z0: pz(82), z1: pz(805) };

export function buildExterior(W) {
  const m = mats();
  const G = GROUNDS;

  // Ground with a hole where the house sits.
  const shape = new THREE.Shape();
  shape.moveTo(-60, -60); shape.lineTo(80, -60); shape.lineTo(80, 80); shape.lineTo(-60, 80); shape.lineTo(-60, -60);
  const hole = new THREE.Path();
  hole.moveTo(HOUSE.x0, HOUSE.z0); hole.lineTo(HOUSE.x0, HOUSE.z1); hole.lineTo(HOUSE.x1, HOUSE.z1); hole.lineTo(HOUSE.x1, HOUSE.z0); hole.lineTo(HOUSE.x0, HOUSE.z0);
  shape.holes.push(hole);
  const groundGeo = new THREE.ShapeGeometry(shape);
  groundGeo.rotateX(Math.PI / 2);
  // ShapeGeometry UVs are in world units: scale them for the grass texture
  const uv = groundGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
  const grassMat = m.grass.clone();
  grassMat.map = m.grass.map.clone(); grassMat.map.repeat.set(1, 1); grassMat.map.needsUpdate = true;
  grassMat.side = THREE.DoubleSide;
  const ground = new THREE.Mesh(groundGeo, grassMat);
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  W.scene.add(ground);
  // flip so the face points up (ShapeGeometry rotated +90° faces down)
  ground.scale.y = 1;
  // outside-but-inside-bbox patches
  box(W, px(258), -0.06, pz(82), px(657), -0.01, pz(148), m.dirt);
  box(W, px(80), -0.06, pz(505), px(160), -0.01, pz(590), m.dirt);
  box(W, px(262), -0.06, pz(683), px(322), 0.0, pz(805), m.concrete);

  W.col.addZone(G.x0 - 2, G.x1 + 2, G.z0, G.z1 + 2, (x, z) => {
    if (x > HOUSE.x0 - 0.05 && x < HOUSE.x1 + 0.05 && z > HOUSE.z0 - 0.05 && z < HOUSE.z1 + 0.05) return null;
    return 0;
  }, 'grass');

  // ---------- roof (simple gable over the footprint) ----------
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x23201d, side: THREE.DoubleSide });
  const rw = HOUSE.x1 - HOUSE.x0 + 0.8, rl = HOUSE.z1 - HOUSE.z0 + 0.8, rh = 3.0;
  {
    const y0 = 2.92, cx = (HOUSE.x0 + HOUSE.x1) / 2;
    const xa = HOUSE.x0 - 0.4, xb = HOUSE.x1 + 0.4, za = HOUSE.z0 - 0.4, zb = HOUSE.z1 + 0.4;
    const v = [xa, y0, za, cx, y0 + rh, za, cx, y0 + rh, zb, xa, y0, za, cx, y0 + rh, zb, xa, y0, zb,
      cx, y0 + rh, za, xb, y0, za, xb, y0, zb, cx, y0 + rh, za, xb, y0, zb, cx, y0 + rh, zb];
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    rg.computeVertexNormals();
    const roof = new THREE.Mesh(rg, roofMat);
    W.scene.add(roof);
    W.ceilings.push(roof);
  }
  const gable = new THREE.Shape();
  gable.moveTo(-rw / 2, 0); gable.lineTo(rw / 2, 0); gable.lineTo(0, rh); gable.lineTo(-rw / 2, 0);
  for (const z of [HOUSE.z0 - 0.4, HOUSE.z1 + 0.4]) {
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), new THREE.MeshLambertMaterial({ color: 0x3a3833, side: THREE.DoubleSide }));
    gm.position.set((HOUSE.x0 + HOUSE.x1) / 2, 2.92, z);
    W.scene.add(gm);
    W.ceilings.push(gm);
  }

  // ---------- perimeter fence (solid) ----------
  const fenceRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const f = P.fence(len);
    f.position.set(x0, 0, z0);
    f.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    W.scene.add(f);
    W.col.addBox(Math.min(x0, x1) - 0.1, 0, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, 3.0, Math.max(z0, z1) + 0.1, 'fence');
  };
  fenceRun(G.x0, G.z1, 11, G.z1);
  fenceRun(15, G.z1, G.x1, G.z1);
  fenceRun(G.x0, G.z0, G.x0, G.z1);
  fenceRun(G.x1, G.z0, G.x1, G.z1);

  // Front gate (chained shut)
  const gate = new THREE.Group();
  for (let x = 0; x <= 4; x += 0.14) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.1, 0.035), m.metal); b.position.set(x, 1.05, 0); gate.add(b); }
  for (const y of [0.2, 1.0, 2.0]) { const b = new THREE.Mesh(new THREE.BoxGeometry(4, 0.05, 0.05), m.metal); b.position.set(2, y, 0); gate.add(b); }
  const chain = P.chain(); chain.position.set(1.8, 1.0, 0.05); chain.rotation.z = Math.PI / 2; gate.add(chain);
  gate.position.set(11, 0, G.z1);
  W.scene.add(gate);
  W.col.addBox(11, 0, G.z1 - 0.1, 15, 3, G.z1 + 0.1, 'gate');
  const gateHit = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
  gateHit.position.set(13, 1.1, G.z1); W.scene.add(gateHit);
  W.interact.add(gateHit, {
    prompt: () => 'Gate',
    use: () => {
      W.audio?.rattle(gateHit.position);
      W.noise?.(gateHit.position, 12);
      W.events.emit('gateTried');
      W.ui.toast('The gate is chained and padlocked. The chain looks new.');
    },
  });

  // Driveway and porch path
  box(W, 10.2, -0.04, HOUSE.z1, 16.6, -0.005, G.z1, m.dirt);
  box(W, 5.6, -0.04, HOUSE.z1, 7.1, -0.006, 28.5, m.concrete);
  box(W, 7.1, -0.04, 27.5, 10.2, -0.006, 28.5, m.concrete);

  // ---------- rear: patio, garden, shed, retaining wall + culvert ----------
  box(W, 8.0, -0.03, -3.5, 15.5, 0.02, -0.2, m.concrete);
  (W.spots.tables ||= []).push({ name: 'patio table', group: place(W, P.table(1.0, 1.0, 0.7, m.rust), 10.5, 0, -1.8, 0.3, true), w: 1.0, l: 1.0, h: 0.7 });
  place(W, P.chair(), 11.4, 0, -2.4, 2.2, true);
  const fallen = P.chair(); place(W, fallen, 9.6, 0, -1.2, 0, false); fallen.rotation.z = Math.PI / 2; fallen.position.y = 0.22;

  // garden beds and dead plants
  for (const [x, z, s] of [[2, -8, 1.3], [5, -11, 1], [-4, -6, 1.6], [-6, -14, 1.4], [14, -9, 1.2], [19, -15, 1.5], [8, -16, 1.1], [-2, -17.5, 1.6], [1.8, -18.8, 1.4], [6.4, -18.9, 1.5], [24, 5, 1.3], [26, 15, 1.4], [-7, 20, 1.6], [-5, 30, 1.2], [22, 28, 1.3]]) {
    place(W, P.bush(s), x, 0, z, x * 3, false);
  }
  // fallen branches (only outside the house footprint)
  for (let i = 0, n = 0; i < 60 && n < 18; i++) {
    const x = -8 + (i * 7.7) % 36, z = -18 + (i * 5.3) % 50;
    if (x > HOUSE.x0 - 1 && x < HOUSE.x1 + 1 && z > HOUSE.z0 - 1 && z < HOUSE.z1 + 1) continue;
    const b = P.pipe(1.2 + (i % 3) * 0.6, 0.04, m.bark);
    place(W, b, x, 0.05, z, i * 1.3, false);
    n++;
  }

  // Shed (north-east)
  const sh = { x0: 22.5, x1: 26.5, z0: -14.5, z1: -11.0 };
  const shedMat = m.darkWood;
  box(W, sh.x0, 0, sh.z0, sh.x1, 2.4, sh.z0 + 0.1, shedMat, { solid: true });
  box(W, sh.x0, 0, sh.z1 - 0.1, sh.x1, 2.4, sh.z1, shedMat, { solid: true });
  box(W, sh.x1 - 0.1, 0, sh.z0, sh.x1, 2.4, sh.z1, shedMat, { solid: true });
  box(W, sh.x0, 0, sh.z0, sh.x0 + 0.1, 2.4, -13.6, shedMat, { solid: true });
  box(W, sh.x0, 0, -12.2, sh.x0 + 0.1, 2.4, sh.z1, shedMat, { solid: true });
  box(W, sh.x0, 2.0, -13.6, sh.x0 + 0.1, 2.4, -12.2, shedMat);
  box(W, sh.x0 - 0.2, 2.4, sh.z0 - 0.2, sh.x1 + 0.2, 2.5, sh.z1 + 0.2, m.rust);
  box(W, sh.x0, 0, sh.z0, sh.x1, 0.02, sh.z1, m.darkWood);
  W.spots.shedBench = place(W, P.workbench(), 26.0, 0, -12.75, -Math.PI / 2, true);
  place(W, P.shelf(1.4, 2.0, 0.4), 24.0, 0, -14.1, 0, true);

  // Retaining wall along the back with the drainage culvert opening.
  const C = CULVERT;
  const rwH = 2.5;
  box(W, G.x0, 0, C.zFace - 0.6, C.x0, rwH, C.zFace, m.concrete, { solid: true });
  box(W, C.x1, 0, C.zFace - 0.6, G.x1, rwH, C.zFace, m.concrete, { solid: true });
  box(W, C.x0, 1.95, C.zFace - 0.6, C.x1, rwH, C.zFace, m.concrete);
  // earth bank above and behind the wall
  box(W, G.x0 - 2, rwH - 0.1, C.zFace - 14, G.x1 + 2, rwH, C.zFace - 0.6, m.dirt);
  const bankFence = P.fence(G.x1 - G.x0);
  bankFence.position.set(G.x0, rwH, C.zFace - 0.8);
  W.scene.add(bankFence);
  // drainage stains under the culvert
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshLambertMaterial({ color: 0x15140f, transparent: true, opacity: 0.7 }));
  stain.rotation.x = -Math.PI / 2; stain.position.set(4.0, 0.005, C.zFace + 0.7);
  W.scene.add(stain);

  // ---------- surrounding woodland (instanced) ----------
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 7, 6);
  const coneGeo = new THREE.ConeGeometry(1.9, 4.5, 7);
  const pts = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 420; i++) {
    const x = -45 + rnd() * 120, z = -50 + rnd() * 110;
    const inside = x > G.x0 - 1.5 && x < G.x1 + 1.5 && z > G.z0 - 1 && z < G.z1 + 1.5;
    if (inside) continue;
    pts.push([x, z, 0.8 + rnd() * 0.6]);
  }
  // a few trees inside the plot
  for (const [x, z] of [[-6, -10], [-7, 4], [-4, 26], [27, -4], [26, 24], [20, -18], [-8, -18], [12, -14]]) pts.push([x, z, 1]);
  const trunks = new THREE.InstancedMesh(trunkGeo, m.bark, pts.length);
  const cones = new THREE.InstancedMesh(coneGeo, m.leaf, pts.length * 2);
  const mtx = new THREE.Matrix4();
  pts.forEach(([x, z, s], i) => {
    mtx.makeScale(s, s, s).setPosition(x, 3.5 * s, z);
    trunks.setMatrixAt(i, mtx);
    mtx.makeScale(s, s, s).setPosition(x, 6.0 * s, z); cones.setMatrixAt(i * 2, mtx);
    mtx.makeScale(s * 0.75, s, s * 0.75).setPosition(x, 8.3 * s, z); cones.setMatrixAt(i * 2 + 1, mtx);
  });
  W.scene.add(trunks, cones);
  for (const [x, z] of pts) if (x > G.x0 && x < G.x1 && z > G.z0 && z < G.z1) W.col.addBox(x - 0.25, 0, z - 0.25, x + 0.25, 5, z + 0.25, 'tree');

  // ---------- lighting ----------
  const moon = new THREE.DirectionalLight(0x6f82a8, 0.35);
  moon.position.set(-30, 40, -20);
  W.scene.add(moon);
  W.exteriorLights = [
    lamp(W, px(292), 2.55, pz(690), { color: 0xffd9a0, intensity: 2.0, distance: 6, flicker: 0.5 }),
  ];
}
