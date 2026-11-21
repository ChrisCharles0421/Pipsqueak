// Basement: a lower floor of the same house, reached by the main staircase.
// Large rectangular concrete space with pillars, shelving and enclosed storage areas.
import * as THREE from 'three';
import { wall, door, box, mats, lamp } from './builder.js';
import { P, place } from './props.js';
import { STAIR } from './house.js';

export const BASEMENT = { x0: 4.6, x1: 16.4, z0: -6.0, z1: 7.6, y: -3.0, ceil: -0.3 };

export function buildBasement(W) {
  const m = mats();
  const B = BASEMENT;
  const H = B.ceil - B.y;

  box(W, B.x0, B.y - 0.1, B.z0, B.x1, B.y, B.z1, m.concrete);
  // ceiling with a hole for the stairwell
  const C = (x0, z0, x1, z1) => W.ceilings.push(box(W, x0, B.ceil, z0, x1, B.ceil + 0.25, z1, m.concrete));
  C(B.x0, B.z0, STAIR.x0, B.z1);
  C(STAIR.x1, B.z0, B.x1, B.z1);
  C(STAIR.x0, B.z0, STAIR.x1, STAIR.zBottom);
  // joists for texture
  for (let x = B.x0 + 0.6; x < B.x1; x += 1.2) {
    if (x > STAIR.x0 - 0.1 && x < STAIR.x1 + 0.1) continue;
    box(W, x - 0.06, B.ceil - 0.18, B.z0, x + 0.06, B.ceil, B.z1, m.darkWood);
  }

  W.col.addZone(B.x0, B.x1, B.z0, B.z1, (x, z) => {
    if (x > STAIR.x0 && x < STAIR.x1 && z > STAIR.zBottom + 0.05) return null; // under the stairs is walled off
    return B.y;
  }, 'concrete');

  const o = { y0: B.y, h: H, mat: m.concrete };
  wall(W, B.x0, B.z0, B.x1, B.z0, o);
  wall(W, B.x0, B.z1, B.x1, B.z1, o);
  wall(W, B.x0, B.z0, B.x0, B.z1, o);
  wall(W, B.x1, B.z0, B.x1, B.z1, o);

  // Pillars
  for (const [x, z] of [[7.6, -2.8], [13.4, -2.8], [7.6, 2.6], [14.0, 1.4]]) place(W, P.pillar(H), x, B.y, z, 0, true);

  // --- Enclosed storage room (south-east), door on its west side ---
  const sx0 = 13.5, sz0 = 3.6;
  wall(W, sx0, sz0, B.x1, sz0, { ...o, mat: m.darkWood, t: 0.1 });
  wall(W, sx0, sz0, sx0, B.z1, { ...o, mat: m.darkWood, t: 0.1, openings: [{ type: 'door', from: 5.0, to: 5.9 }] });
  W.doorsByName.storage = door(W, { axis: 'z', from: 5.0, to: 5.9, at: sx0, y0: B.y, swing: 1 });
  place(W, P.shelf(1.8, 2.2, 0.45), 15.0, B.y, 7.3, Math.PI, true);
  place(W, P.boxes(3, 3), 15.8, B.y, 4.1, 0, true);
  W.spots.storageShelf = { x: 15.0, y: B.y + 1.0, z: 7.05 };

  // --- Partially enclosed boiler corner (north-east) ---
  wall(W, 13.6, B.z0, 13.6, -3.9, { ...o, mat: m.brick, t: 0.2 });
  const boiler = new THREE.Group();
  const bc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.8, 14), m.rust);
  bc.position.y = 0.9; boiler.add(bc);
  place(W, boiler, 15.3, B.y, -5.0, 0, true);
  const pipeUp = P.pipe(2.4, 0.07); pipeUp.rotation.x = Math.PI / 2; place(W, pipeUp, 15.3, B.y + 1.8, -5.0, 0, false);

  // --- Spawn corner (north-west): mattress, chain, tally marks ---
  place(W, P.mattress(), 5.4, B.y, -4.6, 0, false);
  const ch = P.chain(); place(W, ch, 4.75, B.y, -4.0, Math.PI / 2, false);
  const tally = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: tallyTexture(), transparent: true }));
  tally.position.set(B.x0 + 0.09, B.y + 0.55, -4.8);
  tally.rotation.y = Math.PI / 2;
  W.scene.add(tally);
  W.spots.tally = tally;

  // Shelving and clutter
  place(W, P.shelf(2.0, 2.2, 0.45), 6.0, B.y, B.z1 - 0.3, Math.PI, true);
  place(W, P.shelf(2.0, 2.2, 0.45), B.x0 + 0.3, B.y, 0.5, Math.PI / 2, true);
  place(W, P.shelf(2.0, 2.2, 0.45), 9.5, B.y, B.z0 + 0.3, 0, true);
  W.spots.workbench = place(W, P.workbench(), B.x0 + 0.45, B.y, -1.6, Math.PI / 2, true);
  place(W, P.boxes(3, 7), 8.8, B.y, 4.8, 0.3, true);
  place(W, P.boxes(2, 4), 12.6, B.y, -5.4, 0, true);
  place(W, P.table(1.2, 0.7), 9.3, B.y, -0.4, 0.2, true);
  place(W, P.chair(), 9.3, B.y, 0.3, Math.PI + 0.4, true);
  // stain trail on the floor
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.12 + (i % 3) * 0.06, 10), m.blood);
    s.rotation.x = -Math.PI / 2;
    s.position.set(6.2 + i * 0.7, B.y + 0.003, -3.6 + i * 0.25);
    W.scene.add(s);
  }

  W.basementLights = [
    lamp(W, 8.5, B.ceil - 0.35, -1.0, { color: 0xb8c8d8, intensity: 1.6, distance: 7, flicker: 0.35 }),
    lamp(W, 11.4, B.ceil - 0.35, 1.0, { color: 0xb8c8d8, intensity: 0.9, distance: 4.5 }),
  ];
  const cord = box(W, 8.49, B.ceil - 0.35, -1.01, 8.51, B.ceil, -0.99, m.black);
}

function tallyTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(25,20,15,0.85)';
  g.lineWidth = 3;
  let x = 12;
  for (let grp = 0; grp < 5; grp++) {
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + i * 9, 30 + (i % 2) * 3); g.lineTo(x + i * 9 + 2, 95); g.stroke(); }
    g.beginPath(); g.moveTo(x - 4, 85); g.lineTo(x + 32, 40); g.stroke();
    x += 48;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
