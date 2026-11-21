// Drainage culvert + one long, straight, narrow sewer tunnel for the final chase.
// No branches, no side rooms. Ends in a blocked grille (final confrontation spot).
import * as THREE from 'three';
import { box, mats, lamp } from './builder.js';
import { CULVERT } from './exterior.js';

export const SEWER = { x: 4.0, halfW: 1.1, floorY: -3.5, zStart: -26.0, zEnd: -142.0, wallTop: -2.0 };

export function buildSewer(W) {
  const m = mats();
  const S = SEWER;
  const C = CULVERT;
  const xL = S.x - S.halfW, xR = S.x + S.halfW;

  // ---------- culvert ramp (z -20 .. -26), floor 0 -> -3.5 ----------
  const zA = C.zFace + 0.05, zB = S.zStart;
  const rampH = (z) => {
    const t = (zA - z) / (zA - zB);
    return S.floorY * Math.max(0, Math.min(1, t));
  };
  W.col.addZone(C.x0, C.x1, zB - 0.01, zA + 0.6, (x, z) => rampH(z), 'concrete');
  // sloped floor + ceiling slabs
  const len = Math.hypot(zA - zB, S.floorY);
  const ang = Math.atan2(-S.floorY, zA - zB);
  const slab = (y, mat) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(C.x1 - C.x0 + 0.2, 0.12, len), mat);
    g.position.set((C.x0 + C.x1) / 2, y + S.floorY / 2, (zA + zB) / 2);
    g.rotation.x = -ang;
    g.receiveShadow = true;
    W.scene.add(g);
  };
  slab(-0.06, m.wetConcrete);
  slab(1.95 + 0.06, m.concrete);
  box(W, C.x0 - 0.12, S.floorY, zB, C.x0, 2.2, zA, m.sewerWall, { solid: true });
  box(W, C.x1, S.floorY, zB, C.x1 + 0.12, 2.2, zA, m.sewerWall, { solid: true });
  // concrete roof over the culvert mouth so the gap to the bank is closed
  box(W, C.x0 - 0.12, 1.95, C.zFace - 0.6, C.x1 + 0.12, 2.5, zA, m.concrete);

  // ---------- main tunnel ----------
  const L = S.zStart - S.zEnd;
  const zc = (S.zStart + S.zEnd) / 2;
  W.col.addZone(xL, xR, S.zEnd - 0.5, S.zStart + 0.01, S.floorY, 'water');
  // floor walkways and centre channel
  box(W, xL, S.floorY - 0.2, S.zEnd, S.x - 0.3, S.floorY, S.zStart, m.wetConcrete);
  box(W, S.x + 0.3, S.floorY - 0.2, S.zEnd, xR, S.floorY, S.zStart, m.wetConcrete);
  box(W, S.x - 0.3, S.floorY - 0.3, S.zEnd, S.x + 0.3, S.floorY - 0.1, S.zStart, m.sewerWall);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(0.6, L), m.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(S.x, S.floorY - 0.04, zc);
  W.scene.add(water);
  // walls
  box(W, xL - 0.3, S.floorY - 0.2, S.zEnd, xL, S.wallTop, S.zStart, m.sewerWall);
  box(W, xR, S.floorY - 0.2, S.zEnd, xR + 0.3, S.wallTop, S.zStart, m.sewerWall);
  W.col.addBox(xL - 0.3, S.floorY - 1, S.zEnd - 1, xL, 0, S.zStart, 'sewer');
  W.col.addBox(xR, S.floorY - 1, S.zEnd - 1, xR + 0.3, 0, S.zStart, 'sewer');
  // arched ceiling
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(S.halfW, S.halfW, L, 18, 1, true, -Math.PI / 2, Math.PI), m.sewerWall);
  arch.material = m.sewerWall.clone();
  arch.material.side = THREE.BackSide;
  arch.position.set(S.x, S.wallTop, zc);
  // cylinder axis Y -> Z, and the open half (+z side of the geometry) -> up
  arch.rotation.set(-Math.PI / 2, 0, 0);
  W.scene.add(arch);
  W.sewerArch = arch;
  // headwall above the culvert where it meets the tunnel
  box(W, xL, S.floorY + 2.0, S.zStart, xR, S.wallTop + S.halfW + 0.1, S.zStart + 0.2, m.sewerWall);
  box(W, xL, S.floorY, S.zStart, C.x0 - 0.12, S.floorY + 2.0, S.zStart + 0.2, m.sewerWall, { solid: true });
  box(W, C.x1 + 0.12, S.floorY, S.zStart, xR, S.floorY + 2.0, S.zStart + 0.2, m.sewerWall, { solid: true });

  // ribs every 5 m give a sense of speed in the dark
  const ribGeo = new THREE.TorusGeometry(S.halfW - 0.02, 0.07, 4, 14, Math.PI);
  const pilGeo = new THREE.BoxGeometry(0.14, S.wallTop - S.floorY, 0.18);
  const nR = Math.floor(L / 5);
  const ribs = new THREE.InstancedMesh(ribGeo, m.sewerWall, nR);
  const pils = new THREE.InstancedMesh(pilGeo, m.sewerWall, nR * 2);
  const mt = new THREE.Matrix4();
  for (let i = 0; i < nR; i++) {
    const z = S.zStart - 2.5 - i * 5;
    mt.makeTranslation(S.x, S.wallTop, z); ribs.setMatrixAt(i, mt);
    mt.makeTranslation(xL + 0.05, (S.wallTop + S.floorY) / 2, z); pils.setMatrixAt(i * 2, mt);
    mt.makeTranslation(xR - 0.05, (S.wallTop + S.floorY) / 2, z); pils.setMatrixAt(i * 2 + 1, mt);
  }
  W.scene.add(ribs, pils);

  // pipes along the walls
  const pipe = (x, y, r, mat) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), mat);
    p.rotation.x = Math.PI / 2;
    p.position.set(x, y, zc);
    W.scene.add(p);
  };
  pipe(xL + 0.12, S.floorY + 1.15, 0.09, m.rust);
  pipe(xR - 0.1, S.floorY + 1.55, 0.06, m.metal);
  pipe(xR - 0.1, S.floorY + 1.35, 0.05, m.rust);

  // puddles and small, non-blocking debris
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.25 + rnd() * 0.4, 12), m.water);
    p.rotation.x = -Math.PI / 2;
    p.position.set(xL + 0.3 + rnd() * (xR - xL - 0.6), S.floorY + 0.004, S.zStart - 3 - rnd() * (L - 6));
    W.scene.add(p);
  }
  for (let i = 0; i < 25; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.1 + rnd() * 0.25, 0.04 + rnd() * 0.1, 0.1 + rnd() * 0.3), rnd() > 0.5 ? m.rust : m.cardboard);
    d.position.set(rnd() > 0.5 ? xL + 0.2 : xR - 0.2, S.floorY + 0.05, S.zStart - 4 - rnd() * (L - 10));
    d.rotation.y = rnd() * 3;
    W.scene.add(d);
  }

  // two overhead drain grates letting in faint moonlight
  W.sewerLights = [];
  for (const z of [-62, -104]) {
    W.sewerLights.push(lamp(W, S.x, S.wallTop + S.halfW - 0.2, z, { color: 0x7d8fb0, intensity: 0.8, distance: 3.2, shade: false }));
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ color: 0x1d2430 }));
    gr.rotation.x = Math.PI / 2;
    gr.position.set(S.x, S.wallTop + S.halfW - 0.01, z);
    W.scene.add(gr);
  }

  // ---------- end: blocked by a rusted grille and collapse ----------
  box(W, xL - 0.3, S.floorY - 0.2, S.zEnd - 0.6, xR + 0.3, 0, S.zEnd - 0.3, m.sewerWall, { solid: true });
  for (let x = xL + 0.1; x < xR; x += 0.16) box(W, x, S.floorY, S.zEnd - 0.05, x + 0.04, S.wallTop + 0.9, S.zEnd, m.rust);
  W.col.addBox(xL, S.floorY, S.zEnd - 0.3, xR, 0, S.zEnd, 'grille');
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + rnd() * 0.25, 0), m.concrete);
    r.position.set(xL + rnd() * (xR - xL), S.floorY + 0.2, S.zEnd - 0.4);
    W.scene.add(r);
  }
  const endGrille = new THREE.Mesh(new THREE.BoxGeometry(xR - xL, 2.6, 0.2), new THREE.MeshBasicMaterial({ visible: false }));
  endGrille.position.set(S.x, S.floorY + 1.3, S.zEnd);
  W.scene.add(endGrille);

  // ---------- entrance grate (opens with the crowbar) ----------
  const pivot = new THREE.Group();
  const gw = C.x1 - C.x0;
  for (let x = 0.05; x < gw; x += 0.14) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.9, 0.04), m.rust);
    b.position.set(x, 0.95, 0);
    pivot.add(b);
  }
  for (const y of [0.1, 0.95, 1.85]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.06, 0.06), m.rust);
    b.position.set(gw / 2, y, 0);
    pivot.add(b);
  }
  const hit = new THREE.Mesh(new THREE.BoxGeometry(gw, 1.9, 0.25), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(gw / 2, 0.95, 0);
  pivot.add(hit);
  pivot.position.set(C.x0, 0, C.zFace + 0.05);
  W.scene.add(pivot);
  const gcol = W.col.addBox(C.x0, 0, C.zFace - 0.05, C.x1, 2, C.zFace + 0.15, 'grate');
  W.grate = { pivot, open: false, angle: 0, col: gcol };
  W.interact.add(hit, {
    prompt: () => (W.grate.open ? '' : 'Drainage grate'),
    enabled: () => !W.grate.open,
    use: () => {
      if (!W.inventory.has('crowbar')) {
        W.audio?.rattle(pivot.position);
        W.ui.toast('A drainage grate. Cold air and the sound of water come from behind it. It is rusted shut.');
        W.events.emit('grateFound');
        return;
      }
      W.grate.open = true;
      W.grate.col.enabled = false;
      W.audio?.pry();
      W.noise?.(pivot.position, 15);
      W.ui.toast('You force the grate open with the crowbar.');
      W.events.emit('grateOpened');
    },
  });
}

export function updateSewer(W, dt) {
  const g = W.grate;
  if (g && g.open && g.angle < 1.45) {
    g.angle = Math.min(1.45, g.angle + dt * 1.6);
    g.pivot.rotation.y = -g.angle;
  }
}
