// Procedural furniture and props. Each builder returns a Group placed at (x, floorY, z)
// with rotation ry (radians). Large items are solid (collision box from bounds).
import * as THREE from 'three';
import { mats } from './builder.js';

const G = new THREE.BoxGeometry(1, 1, 1);

function part(g, mat, x, y, z, sx, sy, sz, cast = true) {
  const m = new THREE.Mesh(G, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function cyl(g, mat, x, y, z, r, h, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

export function place(W, g, x, y, z, ry = 0, solid = true) {
  g.position.set(x, y, z);
  g.rotation.y = ry;
  W.scene.add(g);
  if (solid) g.userData.col = W.col.addBoxFromObject(g, 'prop');
  return g;
}

export const P = {
  bed(w = 1.5, l = 2.0, mat) {
    const m = mats(); const g = new THREE.Group();
    part(g, m.darkWood, 0, 0.2, 0, w, 0.25, l);
    part(g, m.linen, 0, 0.42, 0.05, w - 0.06, 0.2, l - 0.15);
    part(g, mat || m.fabricRed, 0, 0.54, 0.25, w - 0.04, 0.06, l * 0.6);
    part(g, m.white, 0, 0.58, -l / 2 + 0.3, w * 0.7, 0.12, 0.35);
    part(g, m.darkWood, 0, 0.6, -l / 2 - 0.03, w + 0.06, 1.1, 0.07);
    return g;
  },
  nightstand() {
    const m = mats(); const g = new THREE.Group();
    part(g, m.darkWood, 0, 0.3, 0, 0.45, 0.6, 0.4);
    part(g, m.metal, 0, 0.42, 0.205, 0.08, 0.02, 0.02);
    return g;
  },
  wardrobe(w = 1.2) {
    const m = mats(); const g = new THREE.Group();
    part(g, m.darkWood, 0, 1.0, 0, w, 2.0, 0.6);
    part(g, m.black, 0, 1.0, 0.301, 0.01, 1.8, 0.01);
    part(g, m.metal, -0.06, 1.05, 0.31, 0.02, 0.15, 0.02);
    part(g, m.metal, 0.06, 1.05, 0.31, 0.02, 0.15, 0.02);
    return g;
  },
  dresser(w = 1.2) {
    const m = mats(); const g = new THREE.Group();
    part(g, m.darkWood, 0, 0.45, 0, w, 0.9, 0.5);
    for (let i = 0; i < 3; i++) part(g, m.black, 0, 0.2 + i * 0.27, 0.251, w - 0.1, 0.01, 0.01, false);
    return g;
  },
  sofa(w = 2.2) {
    const m = mats(); const g = new THREE.Group();
    part(g, m.fabric, 0, 0.25, 0, w, 0.45, 0.9);
    part(g, m.fabric, 0, 0.65, -0.35, w, 0.6, 0.2);
    part(g, m.fabric, -w / 2 + 0.1, 0.45, 0, 0.2, 0.4, 0.9);
    part(g, m.fabric, w / 2 - 0.1, 0.45, 0, 0.2, 0.4, 0.9);
    return g;
  },
  armchair() { return P.sofa(1.0); },
  table(w = 1.8, l = 1.0, h = 0.76, mat) {
    const m = mats(); const g = new THREE.Group();
    const mm = mat || m.darkWood;
    part(g, mm, 0, h - 0.03, 0, w, 0.06, l);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, mm, sx * (w / 2 - 0.06), (h - 0.06) / 2, sz * (l / 2 - 0.06), 0.06, h - 0.06, 0.06);
    return g;
  },
  chair() {
    const m = mats(); const g = new THREE.Group();
    part(g, m.darkWood, 0, 0.45, 0, 0.44, 0.05, 0.44);
    part(g, m.darkWood, 0, 0.75, -0.2, 0.44, 0.6, 0.04);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, m.darkWood, sx * 0.19, 0.22, sz * 0.19, 0.04, 0.45, 0.04);
    return g;
  },
  tv() {
    const m = mats(); const g = new THREE.Group();
    part(g, m.darkWood, 0, 0.25, 0, 1.4, 0.5, 0.45);
    part(g, m.black, 0, 0.8, 0, 0.9, 0.6, 0.45);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.48), new THREE.MeshBasicMaterial({ color: 0x0d1012 }));
    screen.position.set(0, 0.8, 0.227);
    g.add(screen);
    g.userData.screen = screen;
    return g;
  },
  shelf(w = 1.2, h = 1.9, d = 0.4, mat) {
    const m = mats(); const g = new THREE.Group();
    const mm = mat || m.darkWood;
    part(g, mm, -w / 2 + 0.02, h / 2, 0, 0.04, h, d);
    part(g, mm, w / 2 - 0.02, h / 2, 0, 0.04, h, d);
    for (let i = 0; i < 5; i++) part(g, mm, 0, 0.05 + i * (h - 0.1) / 4, 0, w, 0.03, d);
    const r = (n) => (Math.sin(n * 12.9898) * 43758.5453) % 1;
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 3; k++) {
        if (Math.abs(r(i * 3 + k + w)) < 0.35) continue;
        const bw = 0.15 + Math.abs(r(i + k)) * 0.2;
        part(g, Math.abs(r(k + i * 7)) > 0.5 ? m.cardboard : m.rust, -w / 2 + 0.2 + k * (w - 0.3) / 3, 0.07 + i * (h - 0.1) / 4 + 0.1, 0, bw, 0.2, d * 0.8);
      }
    }
    return g;
  },
  counter(w = 2, d = 0.6) {
    const m = mats(); const g = new THREE.Group();
    part(g, m.white, 0, 0.44, 0, w, 0.88, d);
    part(g, m.plaster, 0, 0.9, 0, w + 0.02, 0.04, d + 0.02);
    for (let x = -w / 2 + 0.3; x < w / 2; x += 0.6) part(g, m.black, x, 0.45, d / 2 + 0.005, 0.01, 0.8, 0.01, false);
    return g;
  },
  fridge() {
    const m = mats(); const g = new THREE.Group();
    part(g, m.white, 0, 0.9, 0, 0.75, 1.8, 0.7);
    part(g, m.metal, 0.3, 1.1, 0.36, 0.03, 0.5, 0.03);
    return g;
  },
  sink() {
    const m = mats(); const g = new THREE.Group();
    part(g, m.white, 0, 0.42, 0, 0.6, 0.84, 0.5);
    part(g, m.porcelain, 0, 0.86, 0, 0.55, 0.06, 0.45);
    part(g, m.metal, 0, 1.0, -0.18, 0.04, 0.22, 0.04);
    return g;
  },
  toilet() {
    const m = mats(); const g = new THREE.Group();
    part(g, m.porcelain, 0, 0.2, 0.05, 0.38, 0.4, 0.5);
    part(g, m.porcelain, 0, 0.55, -0.22, 0.42, 0.45, 0.18);
    return g;
  },
  bathtub() {
    const m = mats(); const g = new THREE.Group();
    part(g, m.porcelain, 0, 0.28, 0, 0.75, 0.56, 1.65);
    part(g, m.black, 0, 0.5, 0, 0.6, 0.1, 1.45, false);
    return g;
  },
  crib() {
    const m = mats(); const g = new THREE.Group();
    part(g, m.white, 0, 0.35, 0, 0.7, 0.06, 1.25);
    for (let i = 0; i < 9; i++) {
      part(g, m.white, -0.33, 0.6, -0.6 + i * 0.15, 0.03, 0.55, 0.03);
      part(g, m.white, 0.33, 0.6, -0.6 + i * 0.15, 0.03, 0.55, 0.03);
    }
    part(g, m.white, -0.33, 0.9, 0, 0.05, 0.05, 1.25);
    part(g, m.white, 0.33, 0.9, 0, 0.05, 0.05, 1.25);
    part(g, m.white, 0, 0.6, -0.62, 0.7, 0.6, 0.04);
    part(g, m.white, 0, 0.6, 0.62, 0.7, 0.6, 0.04);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, m.white, sx * 0.33, 0.2, sz * 0.6, 0.05, 0.4, 0.05);
    part(g, m.linen, 0, 0.42, 0, 0.62, 0.08, 1.15);
    return g;
  },
  toys() {
    const m = mats(); const g = new THREE.Group();
    const cols = [m.toyRed, m.toyYellow, m.toyBlue];
    for (let i = 0; i < 6; i++) part(g, cols[i % 3], Math.sin(i * 2.1) * 0.35, 0.06 + (i > 3 ? 0.12 : 0), Math.cos(i * 1.7) * 0.3, 0.12, 0.12, 0.12);
    // a small rocking horse silhouette
    part(g, m.darkWood, 0.6, 0.35, 0.2, 0.15, 0.2, 0.55);
    part(g, m.darkWood, 0.6, 0.55, 0.45, 0.13, 0.28, 0.13);
    part(g, m.darkWood, 0.6, 0.12, 0.2, 0.08, 0.06, 0.8);
    return g;
  },
  boxes(n = 3, seed = 1) {
    const m = mats(); const g = new THREE.Group();
    let y = 0;
    for (let i = 0; i < n; i++) {
      const s = 0.4 + ((seed * 31 + i * 17) % 10) / 30;
      part(g, m.cardboard, (i % 2) * 0.1, y + s / 2, ((i * 7) % 3) * 0.05, s, s, s);
      y += s;
      if (i === 1) y = 0;
    }
    return g;
  },
  workbench() {
    const m = mats(); const g = new THREE.Group();
    part(g, m.darkWood, 0, 0.88, 0, 2.0, 0.08, 0.7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, m.darkWood, sx * 0.92, 0.42, sz * 0.3, 0.08, 0.84, 0.08);
    part(g, m.darkWood, 0, 0.2, 0, 1.9, 0.04, 0.6);
    part(g, m.darkWood, 0, 1.45, -0.33, 2.0, 1.0, 0.04);
    for (let i = 0; i < 5; i++) part(g, m.metal, -0.7 + i * 0.35, 1.45, -0.29, 0.04, 0.35, 0.03);
    return g;
  },
  car() {
    const m = mats(); const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.5, metalness: 0.4 });
    part(g, paint, 0, 0.55, 0, 1.8, 0.6, 4.5);
    part(g, paint, 0, 1.05, -0.2, 1.6, 0.5, 2.4);
    part(g, m.glass, 0, 1.05, -0.2, 1.62, 0.4, 2.3);
    for (const sx of [-1, 1]) for (const sz of [-1.4, 1.4]) {
      const w = cyl(g, m.black, sx * 0.85, 0.33, sz, 0.33, 0.25, 14);
      w.rotation.z = Math.PI / 2;
    }
    return g;
  },
  pillar(h = 2.7) {
    const m = mats(); const g = new THREE.Group();
    part(g, m.concrete, 0, h / 2, 0, 0.35, h, 0.35);
    return g;
  },
  mattress() {
    const m = mats(); const g = new THREE.Group();
    part(g, new THREE.MeshLambertMaterial({ color: 0x6b6452 }), 0, 0.09, 0, 0.9, 0.18, 1.9);
    part(g, m.blood, 0.15, 0.185, 0.35, 0.3, 0.005, 0.22, false);
    return g;
  },
  chain() {
    const m = mats(); const g = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const l = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 8), m.metal);
      l.position.set(i * 0.05, 0.01, Math.sin(i) * 0.04);
      l.rotation.set(Math.PI / 2, i % 2 ? Math.PI / 2 : 0, 0);
      g.add(l);
    }
    return g;
  },
  fence(len, h = 1.9) {
    const m = mats(); const g = new THREE.Group();
    for (let x = 0; x <= len; x += 0.22) part(g, m.bark, x, h / 2, 0, 0.1, h - Math.abs(Math.sin(x * 7)) * 0.25, 0.04);
    part(g, m.bark, len / 2, h * 0.3, 0.05, len, 0.08, 0.04);
    part(g, m.bark, len / 2, h * 0.8, 0.05, len, 0.08, 0.04);
    return g;
  },
  tree(h = 9, seed = 1) {
    const m = mats(); const g = new THREE.Group();
    const trunk = cyl(g, m.bark, 0, h * 0.35, 0, 0.18 + (seed % 3) * 0.04, h * 0.7, 6);
    trunk.castShadow = false;
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.8 - i * 0.45, 2.6, 7), m.leaf);
      c.position.set(0, h * 0.45 + i * 1.5, 0);
      g.add(c);
    }
    return g;
  },
  bush(s = 1) {
    const m = mats(); const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 * s, 0), i % 2 ? m.leaf : m.deadPlant);
      b.position.set(Math.sin(i * 2) * 0.4 * s, 0.4 * s, Math.cos(i * 2) * 0.4 * s);
      g.add(b);
    }
    return g;
  },
  pipe(len, r = 0.08, mat) {
    const g = new THREE.Group();
    const p = cyl(g, mat || mats().rust, 0, 0, 0, r, len, 8);
    p.rotation.x = Math.PI / 2;
    p.castShadow = false;
    return g;
  },
  // A small readable sheet of paper lying flat.
  paper(title = '') {
    const m = mats(); const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xc9bfa3 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), mat);
    p.rotation.x = -Math.PI / 2;
    p.position.y = 0.005;
    g.add(p);
    // invisible larger pick target
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.05;
    g.add(hit);
    g.userData.hit = hit;
    return g;
  },
};
