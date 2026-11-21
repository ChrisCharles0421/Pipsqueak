// Procedural adult human figure used for the occupant (chase pursuer and scripted sightings).
// Deliberately plain and dark: readable as a person, never glowing or supernatural.
import * as THREE from 'three';
import { mats } from './builder.js';

export function makeFigure() {
  const m = mats();
  const coat = new THREE.MeshLambertMaterial({ color: 0x2e2b28 });
  const trousers = new THREE.MeshLambertMaterial({ color: 0x1f1e1d });
  const skin = new THREE.MeshLambertMaterial({ color: 0x6a5546 });
  const g = new THREE.Group();
  const add = (parent, geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const body = new THREE.Group();
  body.position.y = 1.0;
  g.add(body);
  add(body, new THREE.BoxGeometry(0.5, 0.66, 0.28), coat, 0, 0.36, 0);           // torso
  add(body, new THREE.BoxGeometry(0.46, 0.35, 0.3), coat, 0, -0.1, 0);           // coat skirt
  add(body, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), skin, 0, 0.74, 0);    // neck
  const head = add(body, new THREE.SphereGeometry(0.12, 12, 10), skin, 0, 0.88, 0.0);
  head.scale.set(0.9, 1.15, 1);
  add(body, new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), trousers, 0, 0.93, -0.01); // hair

  const limb = (x, y, len, w, mat) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const seg = add(pivot, new THREE.BoxGeometry(w, len, w), mat, 0, -len / 2, 0);
    body.add(pivot);
    return pivot;
  };
  const armL = limb(-0.31, 0.66, 0.7, 0.11, coat);
  const armR = limb(0.31, 0.66, 0.7, 0.11, coat);
  const legL = limb(-0.12, -0.25, 0.78, 0.14, trousers);
  const legR = limb(0.12, -0.25, 0.78, 0.14, trousers);
  for (const l of [legL, legR]) l.position.y = -0.22;
  body.position.y = 1.02;

  g.scale.setScalar(0.92);
  g.userData = { body, armL, armR, legL, legR, phase: 0 };
  return g;
}

// speed in m/s drives gait; 0 = idle breathing
export function animateFigure(fig, dt, speed) {
  const u = fig.userData;
  const k = Math.min(1, speed / 5);
  u.phase += dt * (2 + speed * 2.1);
  const s = Math.sin(u.phase);
  const amp = 0.25 + k * 0.6;
  u.legL.rotation.x = s * amp;
  u.legR.rotation.x = -s * amp;
  u.armL.rotation.x = -s * amp * 0.9;
  u.armR.rotation.x = s * amp * 0.9;
  u.body.rotation.x = k * 0.18;
  u.body.position.y = 1.02 + Math.abs(Math.cos(u.phase)) * 0.05 * k;
}
