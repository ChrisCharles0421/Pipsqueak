// Shared geometry helpers: materials, walls with door/window openings, doors, boxes.
import * as THREE from 'three';
import { tex } from './textures.js';

// Floor-plan pixel -> world metres. Reference image: house spans ~x 80..657, y 82..805.
export const SCALE = 0.03;
export const px = (x) => (x - 80) * SCALE;
export const pz = (y) => (y - 80) * SCALE;

export const WALL_H = 2.8;
export const DOOR_H = 2.05;
export const WALL_T = 0.16;

let M = null;
export function mats() {
  if (M) return M;
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const rep = (t, x, y) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(x, y); return c; };
  M = {
    wallpaper: lam({ map: tex.wallpaper() }),
    plaster: lam({ map: tex.plaster() }),
    siding: lam({ map: tex.siding() }),
    concrete: lam({ map: tex.concrete() }),
    wood: lam({ map: tex.wood() }),
    tile: lam({ map: tex.tile() }),
    carpet: lam({ map: tex.carpet() }),
    grass: lam({ map: rep(tex.grass(), 40, 40) }),
    dirt: lam({ map: tex.dirt() }),
    brick: lam({ map: tex.brick() }),
    wetConcrete: new THREE.MeshStandardMaterial({ map: tex.concrete(), roughness: 0.25, metalness: 0.1, color: 0x8a8a80 }),
    sewerWall: new THREE.MeshStandardMaterial({ map: tex.concrete(), roughness: 0.6, color: 0x6f6e66 }),
    water: new THREE.MeshStandardMaterial({ color: 0x0c0d0a, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.85 }),
    door: lam({ map: tex.wood(), color: 0x8a6d55 }),
    darkWood: lam({ map: tex.wood(), color: 0x5a4636 }),
    fabric: lam({ color: 0x4b4640 }),
    fabricRed: lam({ color: 0x5a2c2a }),
    fabricBlue: lam({ color: 0x2f3c4f }),
    linen: lam({ color: 0x9c968a }),
    metal: new THREE.MeshStandardMaterial({ color: 0x6b6d70, metalness: 0.7, roughness: 0.45 }),
    rust: lam({ color: 0x5a3a24 }),
    white: lam({ color: 0xb8b4aa }),
    porcelain: new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.2 }),
    black: lam({ color: 0x0b0b0b }),
    glass: new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.55 }),
    cardboard: lam({ color: 0x7a6142 }),
    toyRed: lam({ color: 0x8a2a20 }),
    toyYellow: lam({ color: 0x9a8a2a }),
    toyBlue: lam({ color: 0x2a4a8a }),
    skin: lam({ color: 0x1a1816 }),
    coat: lam({ color: 0x151515 }),
    leaf: lam({ color: 0x1c2616 }),
    bark: lam({ color: 0x2a2018 }),
    deadPlant: lam({ color: 0x3d3424 }),
    blood: new THREE.MeshLambertMaterial({ color: 0x2a0606, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    lampShade: new THREE.MeshBasicMaterial({ color: 0xc9a46a }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffe2a8 }),
  };
  return M;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// A box mesh positioned by its min/max corners. Optionally solid.
export function box(W, minX, minY, minZ, maxX, maxY, maxZ, mat, { solid = false, parent = null, uv = true, cast = false } = {}) {
  const sx = maxX - minX, sy = maxY - minY, sz = maxZ - minZ;
  let geo = boxGeo;
  if (uv) {
    geo = new THREE.BoxGeometry(sx, sy, sz);
    scaleUV(geo, sx, sy, sz);
  }
  const m = new THREE.Mesh(geo, mat);
  if (!uv) m.scale.set(sx, sy, sz);
  m.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  m.receiveShadow = true;
  m.castShadow = cast;
  (parent || W.scene).add(m);
  if (solid) W.col.addBox(minX, minY, minZ, maxX, maxY, maxZ);
  return m;
}

// World-scale UVs so textures do not stretch (1 texture repeat ≈ 1.5 m).
function scaleUV(geo, sx, sy, sz) {
  const uv = geo.attributes.uv;
  const k = 1 / 1.5;
  // face order: +x,-x,+y,-y,+z,-z ; 4 verts each
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] * k, uv.getY(i) * dims[f][1] * k);
    }
  }
  uv.needsUpdate = true;
}

/*
 * Axis-aligned wall from (x1,z1) to (x2,z2). Openings are positions along the wall in metres
 * measured in the same coordinate as the wall's long axis.
 * opening: { from, to, type: 'door'|'window'|'arch', sill, top }
 * inMat / outMat: material on each long face; outSide: +1 means the +perpendicular side is "outside".
 */
export function wall(W, x1, z1, x2, z2, { y0 = 0, h = WALL_H, t = WALL_T, mat, outMat = null, outSide = 1, openings = [] } = {}) {
  const m = mats();
  mat = mat || m.wallpaper;
  const alongX = Math.abs(z2 - z1) < 1e-6;
  const a0 = alongX ? Math.min(x1, x2) : Math.min(z1, z2);
  const a1 = alongX ? Math.max(x1, x2) : Math.max(z1, z2);
  const c = alongX ? z1 : x1;
  const ops = openings.slice().sort((p, q) => p.from - q.from);

  const material = outMat ? faceMats(alongX, mat, outMat, outSide) : mat;

  const seg = (s0, s1, yb, yt, solid) => {
    if (s1 - s0 < 0.005 || yt - yb < 0.005) return;
    const mesh = alongX
      ? box(W, s0, yb, c - t / 2, s1, yt, c + t / 2, material, { cast: true })
      : box(W, c - t / 2, yb, s0, c + t / 2, yt, s1, material, { cast: true });
    if (solid) {
      if (alongX) W.col.addBox(s0, yb, c - t / 2, s1, yt, c + t / 2);
      else W.col.addBox(c - t / 2, yb, s0, c + t / 2, yt, s1);
    }
    return mesh;
  };

  let cur = a0;
  for (const o of ops) {
    seg(cur, o.from, y0, y0 + h, true);
    if (o.type === 'window') {
      const sill = o.sill ?? 0.95, top = o.top ?? 2.1;
      seg(o.from, o.to, y0, y0 + sill, false);
      seg(o.from, o.to, y0 + top, y0 + h, false);
      // collision across the full window opening: windows are never passable
      if (alongX) W.col.addBox(o.from, y0, c - t / 2, o.to, y0 + h, c + t / 2);
      else W.col.addBox(c - t / 2, y0, o.from, c + t / 2, y0 + h, o.to);
      windowPane(W, alongX, c, o.from, o.to, y0 + sill, y0 + top);
    } else {
      const top = o.top ?? DOOR_H + 0.05;
      seg(o.from, o.to, y0 + top, y0 + h, false); // lintel, above head height
      if (o.type === 'door' || o.type === 'arch') frame(W, alongX, c, o.from, o.to, y0, y0 + top, t);
    }
    cur = o.to;
  }
  seg(cur, a1, y0, y0 + h, true);
}

function faceMats(alongX, inMat, outMat, outSide) {
  // Box face order: +x, -x, +y, -y, +z, -z
  const arr = [inMat, inMat, inMat, inMat, inMat, inMat];
  if (alongX) { arr[outSide > 0 ? 4 : 5] = outMat; }
  else { arr[outSide > 0 ? 0 : 1] = outMat; }
  return arr;
}

function windowPane(W, alongX, c, s0, s1, yb, yt) {
  const m = mats();
  const w = s1 - s0, hgt = yt - yb;
  const g = new THREE.Group();
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), m.glass);
  g.add(pane);
  // mullions
  const bar = (bx, by, bw, bh) => {
    const b = new THREE.Mesh(boxGeo, m.darkWood);
    b.scale.set(bw, bh, 0.06);
    b.position.set(bx, by, 0);
    g.add(b);
  };
  bar(0, 0, 0.05, hgt); bar(0, 0, w, 0.05);
  bar(-w / 2, 0, 0.06, hgt); bar(w / 2, 0, 0.06, hgt); bar(0, -hgt / 2, w, 0.08); bar(0, hgt / 2, w, 0.06);
  const mid = (s0 + s1) / 2;
  if (alongX) g.position.set(mid, (yb + yt) / 2, c);
  else { g.position.set(c, (yb + yt) / 2, mid); g.rotation.y = Math.PI / 2; }
  W.scene.add(g);
  pane.material.side = THREE.DoubleSide;
}

function frame(W, alongX, c, s0, s1, yb, yt, t) {
  const m = mats();
  const ft = t + 0.04, fw = 0.06;
  if (alongX) {
    box(W, s0 - fw, yb, c - ft / 2, s0, yt + fw, c + ft / 2, m.darkWood);
    box(W, s1, yb, c - ft / 2, s1 + fw, yt + fw, c + ft / 2, m.darkWood);
    box(W, s0, yt, c - ft / 2, s1, yt + fw, c + ft / 2, m.darkWood);
  } else {
    box(W, c - ft / 2, yb, s0 - fw, c + ft / 2, yt + fw, s0, m.darkWood);
    box(W, c - ft / 2, yb, s1, c + ft / 2, yt + fw, s1 + fw, m.darkWood);
    box(W, c - ft / 2, yt, s0, c + ft / 2, yt + fw, s1, m.darkWood);
  }
}

/*
 * Hinged door. axis: 'x' (door sits in a wall running along X) or 'z'.
 * from/to: span along the axis; at: wall coordinate; swing: +1/-1 side it opens towards.
 *
 * Collision: an oriented segment collider from the hinge to the leaf tip, updated every animation
 * step, so it always matches the visible leaf (closed, opening, open, closing). It is never disabled.
 * If the next animation step would sweep into the player or the occupant, the door stops (it bumps)
 * instead of pushing them through.
 */
export function door(W, { axis, from, to, at, y0 = 0, swing = 1, locked = false, keyId = null, name = 'door', lockedText = null, mat = null, onOpen = null, height = DOOR_H, aiLocked = false, hingeAtEnd = false }) {
  const m = mats();
  const width = to - from;
  const pivot = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(width - 0.02, height, 0.05), mat || m.door);
  leaf.position.set(width / 2, height / 2, 0);
  leaf.castShadow = true; leaf.receiveShadow = true;
  pivot.add(leaf);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), m.metal);
  knob.position.set(width - 0.12, 0.95, 0.05);
  const knob2 = knob.clone(); knob2.position.z = -0.05;
  pivot.add(knob, knob2);

  // hinge at the 'from' end (default) or the 'to' end; the leaf points from the hinge along the wall
  let base, hx, hz;
  if (axis === 'x') { hx = hingeAtEnd ? to : from; hz = at; base = hingeAtEnd ? Math.PI : 0; }
  else { hx = at; hz = hingeAtEnd ? to : from; base = hingeAtEnd ? Math.PI / 2 : -Math.PI / 2; }
  pivot.position.set(hx, y0, hz);
  // open towards the requested side: pick the rotation whose tip ends up on that side of the wall
  const tipSide = (a) => (axis === 'x' ? -Math.sin(a) : Math.cos(a));
  const openAngle = [base + Math.PI / 2 * 0.92, base - Math.PI / 2 * 0.92].find((a) => Math.sign(tipSide(a)) === Math.sign(swing));
  pivot.rotation.y = base;
  W.scene.add(pivot);

  const reach = width - 0.01;
  const seg = W.col.addSeg(0, 0, 0, 0, 0.045, y0, y0 + height, 'door');
  const place = (ang) => {
    // leaf local +X rotated by ang about Y: (cos a, -sin a)
    seg.ax = hx; seg.az = hz;
    seg.bx = hx + Math.cos(ang) * reach;
    seg.bz = hz - Math.sin(ang) * reach;
  };
  place(base);

  const d = {
    name, pivot, leaf, seg, open: false, locked, keyId, lockedText, aiLocked,
    angle: base, target: base, base, openAngle, animating: false, onOpen, blockedT: 0,
    hinge: { x: hx, z: hz }, axis, from, to, at, y0, width,
    center: axis === 'x' ? { x: (from + to) / 2, z: at } : { x: at, z: (from + to) / 2 },
    // fraction open, 0 closed .. 1 fully open
    openness() { return (this.angle - this.base) / (this.openAngle - this.base); },
    isOpenEnough() { return this.openness() > 0.75; },
    setOpen(v, { silent = false, by = 'player' } = {}) {
      if (this.locked && v) return false;
      this.open = v;
      this.target = v ? this.openAngle : this.base;
      this.animating = true;
      this.blockedT = 0;
      if (!silent) {
        const p = this.leaf.getWorldPosition(new THREE.Vector3());
        W.audio?.door(v, p);
        if (by === 'player') W.noise?.(p, 6.5, 'door');
      }
      if (v && this.onOpen) { const f = this.onOpen; this.onOpen = null; f(); }
      return true;
    },
    // true if the leaf at angle `ang` would overlap a moving body (player / occupant)
    sweepBlocked(ang) {
      const save = [seg.bx, seg.bz];
      place(ang);
      let hit = false;
      for (const b of W.bodies || []) {
        if (W.col.circleHitsSeg(seg, b.pos.x, b.pos.z, b.radius, b.pos.y, b.height)) { hit = true; break; }
      }
      seg.bx = save[0]; seg.bz = save[1];
      return hit;
    },
    update(dt) {
      if (!this.animating) return;
      const sp = 3.0 * dt;
      const diff = this.target - this.angle;
      const next = Math.abs(diff) <= sp ? this.target : this.angle + Math.sign(diff) * sp;
      const closing = Math.abs(next - this.base) < Math.abs(this.angle - this.base);
      if (closing && this.sweepBlocked(next)) {
        // someone is in the way: hold position; after a moment give up and stay where it is
        this.blockedT += dt;
        if (this.blockedT > 1.2) { this.animating = false; this.open = this.openness() > 0.5; this.target = this.angle; }
        return;
      }
      this.blockedT = 0;
      this.angle = next;
      if (this.angle === this.target) this.animating = false;
      this.pivot.rotation.y = this.angle;
      place(this.angle);
    },
  };
  seg.ref = d;
  W.doors.push(d);
  W.interact.add(leaf, {
    prompt: () => (d.locked ? 'Open' : d.open ? 'Close' : 'Open'),
    use: () => {
      if (d.locked) {
        if (d.keyId && W.inventory.has(d.keyId)) {
          d.locked = false;
          W.ui.toast(`The ${W.inventory.label(d.keyId)} turns in the lock.`);
          W.audio?.unlock();
          W.events?.emit('doorUnlocked', d);
          setTimeout(() => d.setOpen(true), 350);
        } else {
          W.audio?.rattle(d.leaf.getWorldPosition(new THREE.Vector3()));
          W.ui.toast(d.lockedText || 'Locked.');
          W.noise?.(d.leaf.getWorldPosition(new THREE.Vector3()), 7, 'rattle');
          W.events?.emit('lockedDoor', d);
        }
        return;
      }
      d.setOpen(!d.open);
    },
  });
  return d;
}

// Simple point light with an optional visible bulb/shade.
export function lamp(W, x, y, z, { color = 0xffc98a, intensity = 4, distance = 6, shade = true, flicker = 0 } = {}) {
  const m = mats();
  const l = new THREE.PointLight(color, intensity, distance, 1.6);
  l.position.set(x, y, z);
  W.scene.add(l);
  if (shade) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), m.bulb);
    b.position.set(x, y, z);
    W.scene.add(b);
    l.userData.bulb = b;
  }
  l.userData.base = intensity;
  l.userData.flicker = flicker;
  W.lights.push(l);
  return l;
}
