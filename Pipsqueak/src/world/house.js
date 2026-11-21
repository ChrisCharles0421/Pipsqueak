// Main floor of the house, built from the reference floor plan (pixel coordinates -> metres).
// Room arrangement follows reference/tanglewood_floorplan_reference.jpg. Icons/legend from the
// reference are intentionally ignored.
import * as THREE from 'three';
import { px, pz, wall, door, box, mats, lamp, WALL_H, SCALE } from './builder.js';
import { P, place } from './props.js';

export const ROOMS = {
  // name: [x0, y0, x1, y1] in reference pixels, floor material
  'Master Bathroom': [80, 82, 190, 205, 'tile'],
  'Master Closet': [190, 82, 258, 205, 'wood'],
  'Master Bedroom': [80, 205, 258, 327, 'carpet'],
  'Master Bedroom (alcove)': [198, 327, 258, 385, 'carpet'],
  'Nursery': [80, 327, 198, 505, 'carpet'],
  'Living Room': [258, 148, 430, 385, 'wood'],
  'Stair Hall': [430, 315, 490, 385, 'wood'],
  'Dining Room': [490, 148, 657, 385, 'wood'],
  'Kitchen': [485, 385, 657, 508, 'tile'],
  'Utility Room': [375, 385, 485, 508, 'concrete'],
  'Foyer': [198, 385, 322, 680, 'wood'],
  'Foyer (nook)': [160, 505, 198, 590, 'wood'],
  'Main Bathroom': [82, 590, 198, 683, 'tile'],
  "Boys' Bedroom": [82, 683, 262, 805, 'carpet'],
  'Garage': [355, 508, 657, 805, 'concrete'],
};

// Stairwell (between living and dining rooms), descending north to the basement.
export const STAIR = { x0: px(430), x1: px(490), zTop: pz(315), zBottom: pz(150), zDoor: pz(325), depth: -3.0 };

export function buildHouse(W) {
  const m = mats();
  const H = WALL_H;

  // ---------- floors ----------
  for (const [name, r] of Object.entries(ROOMS)) {
    const [x0, y0, x1, y1, fm] = r;
    const f = box(W, px(x0), -0.05, pz(y0), px(x1), 0.0, pz(y1), m[fm]);
    f.name = 'floor:' + name;
  }
  // stair landing inside the stairwell
  box(W, STAIR.x0, -0.05, STAIR.zTop, STAIR.x1, 0, STAIR.zDoor, m.wood);

  // ceiling (one slab over the footprint; doubles as porch roof at the front recess)
  const ceil = box(W, px(80), H, pz(82), px(657), H + 0.12, pz(805), m.plaster);
  ceil.name = 'ceiling';
  W.ceilings.push(ceil);

  // Walking surfaces: whole main floor at y=0 except the stairwell opening.
  W.col.addZone(px(78), px(660), pz(80), pz(808), (x, z) => {
    if (x > STAIR.x0 && x < STAIR.x1 && z > STAIR.zBottom - 0.2 && z < STAIR.zTop) return null;
    return 0;
  }, 'wood');

  // ---------- helpers in reference pixels ----------
  const Wp = (x1, y1, x2, y2, o = {}) => {
    const alongX = y1 === y2;
    const openings = (o.openings || []).map((op) => ({ ...op, from: alongX ? px(op.from) : pz(op.from), to: alongX ? px(op.to) : pz(op.to) }));
    wall(W, px(x1), pz(y1), px(x2), pz(y2), { ...o, openings });
  };
  const ext = (side) => ({ mat: m.wallpaper, outMat: m.siding, outSide: side });
  const Dp = (axis, from, to, at, swing, o = {}) => door(W, {
    axis, from: axis === 'x' ? px(from) : pz(from), to: axis === 'x' ? px(to) : pz(to),
    at: axis === 'x' ? pz(at) : px(at), swing, ...o,
  });
  const win = (a, b) => ({ type: 'window', from: a, to: b });
  const dr = (a, b) => ({ type: 'door', from: a, to: b });
  const arch = (a, b) => ({ type: 'arch', from: a, to: b });

  // ---------- exterior walls ----------
  Wp(80, 82, 258, 82, { ...ext(-1), openings: [win(125, 165)] });
  Wp(258, 82, 258, 148, ext(1));
  Wp(258, 148, 657, 148, { ...ext(-1), openings: [win(330, 395), win(515, 580)] });
  Wp(657, 148, 657, 805, { ...ext(1), openings: [win(220, 280), win(415, 465), dr(700, 735)] });
  Wp(355, 805, 657, 805, ext(1));
  Wp(82, 805, 262, 805, { ...ext(1), openings: [win(115, 180)] });
  Wp(262, 683, 262, 805, ext(1));
  Wp(262, 680, 322, 680, { ...ext(1), openings: [dr(273, 311)] });
  Wp(82, 590, 82, 805, { ...ext(-1), openings: [win(615, 650), win(720, 780)] });
  Wp(82, 590, 160, 590, ext(-1));
  Wp(160, 505, 160, 590, ext(-1));
  Wp(80, 505, 160, 505, ext(1));
  Wp(80, 82, 80, 505, { ...ext(-1), openings: [win(230, 290), win(355, 425)] });
  // Solid structural blocks (chimney/closet mass) between the foyer, utility room and garage.
  box(W, px(322), 0, pz(385), px(375), H, pz(508), m.wallpaper, { solid: true });
  box(W, px(322), 0, pz(508), px(355), H, pz(805), [m.wallpaper, m.siding, m.plaster, m.plaster, m.siding, m.siding], { solid: true });

  // ---------- interior walls ----------
  Wp(190, 82, 190, 205);
  Wp(80, 205, 190, 205, { openings: [dr(150, 182)] });
  Wp(190, 205, 258, 205, { openings: [dr(214, 244)] });
  Wp(258, 148, 258, 385);
  Wp(80, 327, 198, 327);
  Wp(198, 327, 198, 505, { openings: [dr(455, 487)] });
  Wp(198, 385, 258, 385, { openings: [dr(206, 240)] });
  Wp(160, 505, 198, 505);
  Wp(160, 590, 198, 590);
  Wp(198, 590, 198, 683, { openings: [dr(622, 655)] });
  Wp(82, 683, 262, 683, { openings: [dr(214, 247)] });
  Wp(375, 385, 485, 385, { openings: [dr(438, 476)] });
  Wp(485, 385, 485, 508);
  Wp(355, 508, 657, 508, { openings: [dr(428, 462)] });
  // living -> dining wide opening is the stair hall; dining -> kitchen open plan (no wall).
  Wp(258, 385, 262, 385);

  // Stairwell walls, full height from the basement floor to the main ceiling.
  wall(W, STAIR.x0, STAIR.zBottom - 0.05, STAIR.x0, STAIR.zDoor, { y0: STAIR.depth, h: H - STAIR.depth, mat: m.plaster });
  wall(W, STAIR.x1, STAIR.zBottom - 0.05, STAIR.x1, STAIR.zDoor, { y0: STAIR.depth, h: H - STAIR.depth, mat: m.plaster });
  Wp(430, 325, 490, 325, { openings: [dr(440, 480)], mat: m.plaster });

  // ---------- doors ----------
  W.doorsByName = {};
  const named = (n, d) => { d.name = n; return (W.doorsByName[n] = d); };
  named('masterBath', Dp('x', 150, 182, 205, 1));
  named('masterCloset', Dp('x', 214, 244, 205, 1));
  named('nursery', Dp('z', 455, 487, 198, 1));
  named('master', Dp('x', 206, 240, 385, 1));
  named('mainBath', Dp('z', 622, 655, 198, 1));
  named('boys', Dp('x', 214, 247, 683, 1));
  named('utilityTop', Dp('x', 438, 476, 385, 1));
  named('utilityGarage', Dp('x', 428, 462, 508, 1));
  // opens into the stairwell (hinge on the dining side) so the open leaf never blocks the stair hall
  named('basement', Dp('x', 440, 480, 325, -1, { hingeAtEnd: true,
    locked: true, keyId: 'basementKey', lockedText: 'Locked. The handle barely moves.', mat: m.darkWood,
  }));
  named('front', Dp('x', 273, 311, 680, 1, {
    locked: true, keyId: 'frontKey', lockedText: 'The front door is deadbolted. There is no key in the lock.', mat: m.darkWood,
  }));
  named('garageSide', Dp('z', 700, 735, 657, 1, {
    locked: true, keyId: 'garageKey', lockedText: 'The side door is locked.', mat: m.darkWood,
  }));
  // Garage roller door: visual only, never opens.
  const roller = box(W, px(420), 0, pz(805) - 0.12, px(610), 2.3, pz(805) - 0.04, m.metal);
  for (let i = 0; i < 9; i++) box(W, px(420), 0.25 * i + 0.1, pz(805) - 0.14, px(610), 0.25 * i + 0.12, pz(805) - 0.12, m.black);
  W.interact.add(roller, { prompt: () => 'Garage door', use: () => { W.ui.toast("The garage door won't budge. The motor is dead."); W.audio?.rattle(roller.position); } });

  // ---------- stairs (visual steps; collision is a ramp zone) ----------
  const steps = 16;
  const run = (STAIR.zTop - STAIR.zBottom) / steps;
  const rise = -STAIR.depth / steps;
  for (let i = 0; i < steps; i++) {
    const zf = STAIR.zTop - i * run; // nearer to top first
    const top = -i * rise;
    box(W, STAIR.x0 + 0.08, STAIR.depth, zf - run, STAIR.x1 - 0.08, top - rise + 0.001, zf, m.darkWood);
  }
  W.col.addZone(STAIR.x0, STAIR.x1, STAIR.zBottom - 0.25, STAIR.zTop, (x, z) => {
    const t = (z - STAIR.zBottom) / (STAIR.zTop - STAIR.zBottom);
    return STAIR.depth * (1 - Math.max(0, Math.min(1, t)));
  }, 'wood');
  // handrail
  box(W, STAIR.x1 - 0.12, -1.6, STAIR.zBottom, STAIR.x1 - 0.08, -1.55, STAIR.zTop, m.darkWood);

  furnish(W);
  houseLights(W);
}

function furnish(W) {
  const m = mats();
  const at = (x, y) => [px(x), pz(y)];
  const put = (g, x, y, ry = 0, solid = true) => { const [X, Z] = at(x, y); return place(W, g, X, 0, Z, ry, solid); };
  const HALF = Math.PI / 2;

  // Master bedroom
  put(P.bed(1.6, 2.0), 135, 265, HALF);
  W.spots.nightstand = put(P.nightstand(), 98, 222, HALF);
  put(P.nightstand(), 98, 308, HALF);
  put(P.dresser(1.3), 245, 292, -HALF);
  put(P.armchair(), 195, 300, -Math.PI / 2);
  // Master closet
  put(P.shelf(1.6, 2.1, 0.45), 224, 92, 0);
  W.spots.hide = [];
  const hideAt = (name, g) => W.spots.hide.push({ name, group: g });
  hideAt('closet wardrobe', put(P.wardrobe(0.9), 247, 150, -HALF));
  W.spots.closetDrawer = put(P.dresser(0.9), 205, 175, HALF);
  // Master bath
  put(P.bathtub(), 98, 140, 0);
  put(P.toilet(), 175, 100, 0);
  put(P.sink(), 140, 92, 0);
  // Nursery
  put(P.crib(), 105, 380, 0);
  put(P.dresser(1.0), 92, 460, HALF);
  put(P.toys(), 150, 420, 0.4, false);
  put(P.chair(), 150, 345, 2.4);
  hideAt('nursery wardrobe', put(P.wardrobe(1.1), 187, 400, -HALF));
  // Living room
  put(P.sofa(2.4), 330, 285, Math.PI);
  put(P.armchair(), 395, 250, -HALF + 0.3);
  W.spots.tv = put(P.tv(), 335, 165, 0);
  put(P.shelf(1.4, 2.0, 0.4), 272, 220, HALF);
  put(P.table(1.0, 0.6, 0.45), 335, 225, 0);
  // Dining room
  put(P.table(2.2, 1.1), 572, 265, 0);
  for (const dx of [-0.7, 0, 0.7]) {
    const [X, Z] = at(572, 265);
    place(W, P.chair(), X + dx, 0, Z - 0.8, 0, true);
    place(W, P.chair(), X + dx, 0, Z + 0.8, Math.PI, true);
  }
  put(P.dresser(1.6), 645, 300, -HALF);
  // Kitchen
  put(P.counter(3.4), 600, 497, Math.PI);
  put(P.counter(2.2), 646, 440, -HALF);
  put(P.fridge(), 505, 495, Math.PI);
  W.spots.kitchenTable = put(P.table(1.0, 0.8), 555, 430, 0);
  // Utility room
  put(P.shelf(1.8, 2.0, 0.45), 385, 440, Math.PI / 2);
  put(P.boxes(3, 2), 395, 492, 0);
  box(W, px(457), 0, pz(452), px(482), 0.9, pz(482), m.white, { solid: true });
  // Foyer
  put(P.dresser(1.0), 312, 560, -HALF);
  put(P.chair(), 210, 600, HALF);
  // Main bathroom
  put(P.bathtub(), 100, 637, Math.PI);
  put(P.toilet(), 180, 600, HALF * 2);
  put(P.sink(), 150, 675, Math.PI);
  // Boys' bedroom
  put(P.bed(1.0, 1.9, m.fabricBlue), 115, 760, HALF);
  hideAt("boys' wardrobe", put(P.wardrobe(1.0), 245, 765, -HALF));
  put(P.table(1.1, 0.6), 175, 793, Math.PI);
  put(P.chair(), 175, 770, Math.PI);
  // Garage
  put(P.car(), 520, 660, 0);
  put(P.workbench(), 640, 600, -HALF);
  hideAt('garage cupboard', put(P.wardrobe(1.0), 367, 610, HALF));
  W.spots.garageMapWall = { x: px(657) - 0.09, y: 1.5, z: pz(538) };
  put(P.shelf(2.2, 2.2, 0.5), 400, 790, Math.PI);
  put(P.boxes(4, 5), 380, 540, 0);
  put(P.boxes(3, 9), 630, 790, 0);
}

function houseLights(W) {
  const L = (x, y, h, o) => lamp(W, px(x), h, pz(y), o);
  W.houseLights = {
    living: L(300, 200, 1.4, { intensity: 3, distance: 6 }),
    dining: L(572, 265, 2.3, { intensity: 3.5, distance: 7, flicker: 0.6 }),
    kitchen: L(570, 450, 2.5, { color: 0xd8e4ff, intensity: 2.2, distance: 5 }),
    foyer: L(260, 520, 2.5, { intensity: 1.8, distance: 6 }),
    garage: L(520, 600, 2.6, { color: 0xffe0b0, intensity: 2.5, distance: 7, flicker: 0.25 }),
  };
}
