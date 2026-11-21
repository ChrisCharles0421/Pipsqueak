// Basement: a lower floor of the same house, reached by the main staircase. Starting location.
// Lit at first by one fluorescent tube (which fails after the flashlight is found).
import * as THREE from 'three';
import { wall, door, box, mats, lamp } from './builder.js';
import { P, place } from './props.js';
import { STAIR } from './house.js';
import { corkboardTexture, paperTexture } from './evidence.js';

export const BASEMENT = { x0: 4.6, x1: 16.4, z0: -6.0, z1: 7.6, y: -3.0, ceil: -0.3 };

export function buildBasement(W) {
  const m = mats();
  const B = BASEMENT;
  const H = B.ceil - B.y;

  box(W, B.x0, B.y - 0.1, B.z0, B.x1, B.y, B.z1, m.concrete);
  const C = (x0, z0, x1, z1) => W.ceilings.push(box(W, x0, B.ceil, z0, x1, B.ceil + 0.25, z1, m.concrete, { cast: true }));
  C(B.x0, B.z0, STAIR.x0, B.z1);
  C(STAIR.x1, B.z0, B.x1, B.z1);
  C(STAIR.x0, B.z0, STAIR.x1, STAIR.zBottom);
  for (let x = B.x0 + 0.6; x < B.x1; x += 1.2) {
    if (x > STAIR.x0 - 0.1 && x < STAIR.x1 + 0.1) continue;
    box(W, x - 0.06, B.ceil - 0.18, B.z0, x + 0.06, B.ceil, B.z1, m.darkWood);
  }

  W.col.addZone(B.x0, B.x1, B.z0, B.z1, (x, z) => {
    if (x > STAIR.x0 && x < STAIR.x1 && z > STAIR.zBottom + 0.05) return null;
    return B.y;
  }, 'concrete');

  const o = { y0: B.y, h: H, mat: m.concrete };
  wall(W, B.x0, B.z0, B.x1, B.z0, o);
  wall(W, B.x0, B.z1, B.x1, B.z1, o);
  wall(W, B.x0, B.z0, B.x0, B.z1, o);
  wall(W, B.x1, B.z0, B.x1, B.z1, o);

  for (const [x, z] of [[7.6, -2.8], [13.4, -2.8], [7.6, 2.6], [14.0, 1.4]]) place(W, P.pillar(H), x, B.y, z, 0, true);

  // ---------- storage room (south-east) with the red toolbox ----------
  const sx0 = 13.5, sz0 = 3.6;
  wall(W, sx0, sz0, B.x1, sz0, { ...o, mat: m.darkWood, t: 0.1 });
  wall(W, sx0, sz0, sx0, B.z1, { ...o, mat: m.darkWood, t: 0.1, openings: [{ type: 'door', from: 5.0, to: 5.9 }] });
  W.doorsByName.storage = door(W, { axis: 'z', from: 5.0, to: 5.9, at: sx0, y0: B.y, swing: 1, name: 'storage' });
  place(W, P.shelf(1.8, 2.2, 0.45), 15.0, B.y, 7.3, Math.PI, true);
  place(W, P.boxes(3, 3), 15.8, B.y, 4.1, 0, true);
  // red toolbox on the middle shelf
  const tb = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0x8e1d17 });
  const tbBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.24), red); tbBody.position.y = 0.11; tb.add(tbBody);
  const tbLid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.24), red); tbLid.position.y = 0.24; tb.add(tbLid);
  const tbHandle = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.03), m.metal); tbHandle.position.y = 0.29; tb.add(tbHandle);
  tb.position.set(14.95, B.y, 6.7);
  tb.rotation.y = 0.25;
  W.scene.add(tb);
  W.spots.toolbox = tb;
  W.spots.toolboxLid = tbLid;

  // ---------- boiler corner (north-east) ----------
  wall(W, 13.6, B.z0, 13.6, -3.9, { ...o, mat: m.brick, t: 0.2 });
  const boiler = new THREE.Group();
  const bc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.8, 14), m.rust);
  bc.position.y = 0.9; bc.castShadow = true; boiler.add(bc);
  place(W, boiler, 15.3, B.y, -5.0, 0, true);
  const pipeUp = P.pipe(2.4, 0.07); pipeUp.rotation.x = Math.PI / 2; place(W, pipeUp, 15.3, B.y + 1.8, -5.0, 0, false);

  // ---------- spawn corner (north-west): mattress, chain, tally marks ----------
  place(W, P.mattress(), 5.4, B.y, -4.6, 0, false);
  place(W, P.chain(), 4.75, B.y, -4.0, Math.PI / 2, false);
  const tally = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: tallyTexture(), transparent: true }));
  tally.position.set(B.x0 + 0.09, B.y + 0.55, -4.8);
  tally.rotation.y = Math.PI / 2;
  W.scene.add(tally);
  W.spots.tally = tally;

  // ---------- cage (north wall) ----------
  W.spots.cage = buildCage(W, 10.9, B.y, -5.85);

  // ---------- corkboard with photographs + clippings (north wall, near spawn) ----------
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshLambertMaterial({ map: corkboardTexture() }));
  cork.position.set(6.55, B.y + 1.55, B.z0 + 0.1);
  W.scene.add(cork);
  W.spots.corkboard = cork;

  // ---------- butcher's block, cleaver, drain (east side) ----------
  const block = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ map: m.wood.map, color: 0x6a5040 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.8), wood); top.position.y = 0.82; top.castShadow = true; block.add(top);
  for (const sx of [-0.65, 0.65]) for (const sz of [-0.32, 0.32]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.1), wood); l.position.set(sx, 0.36, sz); block.add(l); }
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), m.blood); stain.rotation.x = -Math.PI / 2; stain.position.set(0.1, 0.925, 0.05); block.add(stain);
  place(W, block, 15.4, B.y, -1.1, Math.PI / 2, true);
  const cleaver = makeCleaver();
  cleaver.position.set(15.35, B.y + 0.94, -1.35);
  cleaver.rotation.y = 0.5;
  W.scene.add(cleaver);
  W.spots.cleaver = cleaver;
  // note on the block
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.24), new THREE.MeshLambertMaterial({ map: paperTexture('', 7) }));
  note.rotation.x = -Math.PI / 2; note.rotation.z = 0.3;
  note.position.set(15.5, B.y + 0.925, -0.6);
  W.scene.add(note);
  W.spots.diary = note;
  // drain + stains on the floor sloping to it
  const drain = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), m.black);
  drain.rotation.x = -Math.PI / 2; drain.position.set(14.55, B.y + 0.004, -0.4); W.scene.add(drain);
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.18 + (i % 3) * 0.12, 12), m.blood);
    s.rotation.x = -Math.PI / 2; s.position.set(14.6 + Math.sin(i * 2.3) * 0.5, B.y + 0.003 + i * 0.0003, -0.6 - Math.cos(i * 1.7) * 0.6);
    W.scene.add(s);
  }
  // plastic sheeting rolls + bleach bottles
  const sheet = new THREE.MeshStandardMaterial({ color: 0x9aa3a6, roughness: 0.3, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 2; i++) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 10), sheet);
    roll.position.set(16.15, B.y + 0.6, -2.3 + i * 0.3); roll.rotation.z = 0.12; W.scene.add(roll);
  }
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.3, 8), m.white);
    b.position.set(15.9 + i * 0.16, B.y + (i === 2 ? 0.08 : 0.15), 0.2); if (i === 2) b.rotation.z = Math.PI / 2; W.scene.add(b);
  }

  // ---------- children's belongings ----------
  const pack = new THREE.Group();
  const packMat = new THREE.MeshLambertMaterial({ color: 0x5b3a6a });
  const pb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.16), packMat); pb.position.y = 0.19; pack.add(pb);
  const pp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.06), packMat); pp.position.set(0, 0.14, 0.1); pack.add(pp);
  pack.rotation.set(0, 0.6, 0.3);
  place(W, pack, 6.8, B.y, 6.7, 0.6, false);
  const shoe = makeShoe(0x2f5a8a); shoe.position.set(8.9, B.y, 5.9); shoe.rotation.y = 2.2; W.scene.add(shoe);

  // ---------- shelving, workbench, clutter ----------
  place(W, P.shelf(2.0, 2.2, 0.45), 6.0, B.y, B.z1 - 0.3, Math.PI, true);
  place(W, P.shelf(2.0, 2.2, 0.45), B.x0 + 0.3, B.y, 0.5, Math.PI / 2, true);
  place(W, P.shelf(2.0, 2.2, 0.45), 8.6, B.y, B.z0 + 0.3, 0, true);
  W.spots.workbench = place(W, P.workbench(), B.x0 + 0.45, B.y, -1.6, Math.PI / 2, true);
  const clip = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), new THREE.MeshLambertMaterial({ map: paperTexture('TO DO', 6, '#e6e1d0', 'rgba(20,20,20,0.7)') }));
  clip.rotation.x = -Math.PI / 2; clip.rotation.z = -Math.PI / 2 + 0.2;
  clip.position.set(5.2, B.y + 0.93, -1.2);
  W.scene.add(clip);
  W.spots.clipboard = clip;
  place(W, P.boxes(3, 7), 8.8, B.y, 4.8, 0.3, true);
  W.spots.centerTable = place(W, P.table(1.2, 0.7), 9.3, B.y, -0.4, 0.2, true);
  place(W, P.chair(), 9.3, B.y, 0.3, Math.PI + 0.4, true);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.12 + (i % 3) * 0.06, 10), m.blood);
    s.rotation.x = -Math.PI / 2;
    s.position.set(6.2 + i * 0.7, B.y + 0.003, -3.6 + i * 0.25);
    W.scene.add(s);
  }

  // ---------- lighting: one fluorescent tube over the table + a weak bulb at the stairs ----------
  const tubeY = B.ceil - 0.22;
  const fixture = box(W, 8.6, tubeY + 0.05, -0.5, 10.0, tubeY + 0.12, -0.3, m.metal);
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0xe8f0ff });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), tubeMat);
  tube.rotation.z = Math.PI / 2;
  tube.position.set(9.3, tubeY, -0.4);
  W.scene.add(tube);
  const tubeLight = lamp(W, 9.3, tubeY - 0.1, -0.4, { color: 0xcfdcff, intensity: 9, distance: 15, shade: false });
  tubeLight.decay = 1.1;
  W.basementTube = { mesh: tube, mat: tubeMat, light: tubeLight, fixture, state: 'on' };
  W.basementLights = [tubeLight, lamp(W, 11.4, B.ceil - 0.35, 1.2, { color: 0xffc890, intensity: 0.45, distance: 3.5 })];
  box(W, 11.39, B.ceil - 0.35, 1.19, 11.41, B.ceil, 1.21, m.black);
}

function buildCage(W, cx, y, cz) {
  const m = mats();
  const g = new THREE.Group();
  const wdt = 1.5, dep = 1.2, hgt = 1.35;
  const bar = (x, z, h = hgt) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, h, 5), m.metal); b.position.set(x, h / 2, z); b.castShadow = true; g.add(b); };
  for (let x = -wdt / 2; x <= wdt / 2 + 1e-6; x += 0.12) { bar(x, -dep / 2); if (x < -0.1 || x > 0.5) bar(x, dep / 2); }
  for (let z = -dep / 2; z <= dep / 2 + 1e-6; z += 0.12) { bar(-wdt / 2, z); bar(wdt / 2, z); }
  for (const yy of [0.02, hgt]) {
    for (const [sx, sz, lx, lz] of [[0, -dep / 2, wdt, 0.03], [0, dep / 2, wdt, 0.03], [-wdt / 2, 0, 0.03, dep], [wdt / 2, 0, 0.03, dep]]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.03, lz), m.metal); r.position.set(sx, yy, sz); g.add(r);
    }
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(wdt, 0.02, dep), new THREE.MeshLambertMaterial({ color: 0x3d3f42, transparent: true, opacity: 0.5 }));
  roof.position.y = hgt; g.add(roof);
  // door hanging open
  const doorG = new THREE.Group();
  for (let x = 0; x <= 0.6; x += 0.12) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, hgt - 0.05, 5), m.metal); b.position.set(x, hgt / 2, 0); doorG.add(b); }
  doorG.position.set(-0.1, 0, dep / 2); doorG.rotation.y = -1.1; g.add(doorG);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.03), m.rust); lock.position.set(0.5, 0.75, dep / 2 + 0.03); g.add(lock);
  // inside: blanket, shoe, rabbit
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.6), new THREE.MeshLambertMaterial({ color: 0x4a4436 }));
  blanket.position.set(-0.2, 0.03, -0.1); blanket.rotation.y = 0.2; g.add(blanket);
  const shoe = makeShoe(0x8a2a3a); shoe.position.set(0.35, 0.04, 0.1); shoe.rotation.y = 1.1; g.add(shoe);
  const rabbit = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ color: 0x8b8173 });
  const rb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fur); rb.position.y = 0.09; rabbit.add(rb);
  const rh = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), fur); rh.position.y = 0.21; rabbit.add(rh);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.04), fur); e.position.set(s * 0.03, 0.3, 0); e.rotation.z = s * 0.25; rabbit.add(e); }
  rabbit.position.set(-0.45, 0.03, 0.15); rabbit.rotation.z = 1.3; g.add(rabbit);
  g.position.set(cx, y, cz + dep / 2 + 0.05);
  W.scene.add(g);
  W.col.addBox(cx - wdt / 2, y, cz + 0.05, cx + wdt / 2, y + hgt, cz + dep + 0.05, 'prop');
  return g;
}

function makeCleaver() {
  const m = mats();
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.008, 0.11), new THREE.MeshStandardMaterial({ color: 0x8f8f8a, metalness: 0.8, roughness: 0.45 }));
  g.add(blade);
  const crust = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.009, 0.05), new THREE.MeshLambertMaterial({ color: 0x2a0a08 }));
  crust.position.set(-0.04, 0.001, 0.025); g.add(crust);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.035), new THREE.MeshLambertMaterial({ color: 0x2a1a12 }));
  handle.position.set(0.17, 0.005, -0.02); g.add(handle);
  return g;
}

function makeShoe(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.18), mat); s.position.y = 0.03; g.add(s);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.015, 0.19), new THREE.MeshLambertMaterial({ color: 0xcccccc })); sole.position.y = 0.007; g.add(sole);
  return g;
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
