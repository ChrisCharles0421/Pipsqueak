// Procedural model of the occupant: an adult man, 175 cm, muscular, broad-shouldered.
// Work jacket, dark jeans, boots, a cap whose brim keeps the face in shadow. No facial features are
// modelled at all, so his face can never be identified during play. Front of the model faces +Z.
import * as THREE from 'three';

export const FIGURE_HEIGHT = 1.75;

export function makeFigure() {
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1a1b16 });   // dark olive canvas jacket
  const shirt = new THREE.MeshLambertMaterial({ color: 0x1e1714 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x1d2330 });
  const boots = new THREE.MeshLambertMaterial({ color: 0x1a140f });
  const skin = new THREE.MeshLambertMaterial({ color: 0x3a2d26 });
  const beard = new THREE.MeshLambertMaterial({ color: 0x120f0d });
  const cap = new THREE.MeshLambertMaterial({ color: 0x1b1b1b });
  const g = new THREE.Group();
  const add = (parent, geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const HIP = 0.88;
  const body = new THREE.Group();
  body.position.y = HIP;
  g.add(body);
  add(body, new THREE.BoxGeometry(0.4, 0.18, 0.24), jeans, 0, 0.05, 0);            // pelvis
  add(body, new THREE.BoxGeometry(0.44, 0.22, 0.26), jacket, 0, 0.22, 0);          // abdomen
  add(body, new THREE.BoxGeometry(0.54, 0.34, 0.31), jacket, 0, 0.45, 0);          // chest
  add(body, new THREE.BoxGeometry(0.16, 0.3, 0.02), shirt, 0, 0.43, 0.158);        // open jacket front
  for (const s of [-1, 1]) add(body, new THREE.SphereGeometry(0.1, 10, 8), jacket, s * 0.28, 0.56, 0); // shoulders
  add(body, new THREE.CylinderGeometry(0.075, 0.085, 0.1, 10), skin, 0, 0.66, 0);  // thick neck
  const head = add(body, new THREE.SphereGeometry(0.112, 14, 12), skin, 0, 0.755, 0.005);
  head.scale.set(0.92, 1.08, 1.0);
  add(body, new THREE.SphereGeometry(0.118, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap, 0, 0.77, 0);
  add(body, new THREE.BoxGeometry(0.2, 0.015, 0.12), cap, 0, 0.79, 0.15);          // brim shades the face
  add(body, new THREE.BoxGeometry(0.19, 0.11, 0.1), beard, 0, 0.7, 0.06);          // heavy beard / jaw
  add(body, new THREE.BoxGeometry(0.3, 0.12, 0.3), jacket, 0, 0.63, -0.02);        // turned-up collar

  const limb = (x, y, parts) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    let yy = 0;
    for (const [len, w, mat] of parts) { add(pivot, new THREE.BoxGeometry(w, len, w), mat, 0, yy - len / 2, 0); yy -= len; }
    body.add(pivot);
    pivot.userData.end = yy;
    return pivot;
  };
  const arm = (s) => {
    const a = limb(s * 0.33, 0.55, [[0.32, 0.135, jacket], [0.28, 0.115, jacket]]);
    add(a, new THREE.SphereGeometry(0.05, 8, 6), skin, 0, -0.64, 0); // hand
    return a;
  };
  const leg = (s) => {
    const l = limb(s * 0.11, 0.0, [[0.44, 0.17, jeans], [0.36, 0.14, jeans]]);
    add(l, new THREE.BoxGeometry(0.13, 0.09, 0.27), boots, 0, -0.835, 0.04);
    return l;
  };
  const armL = arm(-1), armR = arm(1), legL = leg(-1), legR = leg(1);
  for (const a of [armL, armR]) a.rotation.z = 0;
  armL.rotation.z = -0.08; armR.rotation.z = 0.08;

  g.userData = { body, armL, armR, legL, legR, phase: 0, hip: HIP, reach: 0 };
  return g;
}

// speed in m/s drives the gait; 0 = standing, breathing. reach 0..1 raises the arms (grab / open door)
export function animateFigure(fig, dt, speed, reach = 0) {
  const u = fig.userData;
  const k = Math.min(1, speed / 4.5);
  u.phase += dt * (1.5 + speed * 2.0);
  const s = Math.sin(u.phase);
  const amp = 0.18 + k * 0.62;
  u.legL.rotation.x = s * amp;
  u.legR.rotation.x = -s * amp;
  u.reach += (reach - u.reach) * Math.min(1, dt * 6);
  u.armL.rotation.x = -s * amp * 0.85 - u.reach * 1.3;
  u.armR.rotation.x = s * amp * 0.85 - u.reach * 1.3;
  u.body.rotation.x = k * 0.16;
  const breathe = speed < 0.2 ? Math.sin(u.phase * 0.6) * 0.008 : 0;
  u.body.position.y = u.hip + Math.abs(Math.cos(u.phase)) * 0.045 * k + breathe;
}
