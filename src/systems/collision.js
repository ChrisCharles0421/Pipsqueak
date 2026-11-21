// Collision world: axis-aligned boxes for walls/furniture/doors and
// height zones for floors, stairs and ramps. Kept separate from visual meshes.
import * as THREE from 'three';

export class CollisionWorld {
  constructor() {
    this.boxes = [];   // { min:Vector3, max:Vector3, enabled, tag }
    this.zones = [];   // { minX,maxX,minZ,maxZ, h:(x,z)=>number|null, surface }
    this.segs = [];    // oriented thin colliders (doors): { ax,az,bx,bz, half, minY,maxY, enabled, tag, ref }
  }

  // Oriented collider: a thick 2D segment extruded between minY and maxY. Used for hinged doors so the
  // collider follows the leaf exactly at every angle (no oversized AABB, no gap while animating).
  addSeg(ax, az, bx, bz, half, minY, maxY, tag = 'door', ref = null) {
    const s = { ax, az, bx, bz, half, minY, maxY, enabled: true, tag, ref };
    this.segs.push(s);
    return s;
  }

  static closestOnSeg(s, x, z) {
    const vx = s.bx - s.ax, vz = s.bz - s.az;
    const l2 = vx * vx + vz * vz || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - s.ax) * vx + (z - s.az) * vz) / l2));
    return [s.ax + vx * t, s.az + vz * t];
  }

  // Does a vertical cylinder overlap segment s?
  circleHitsSeg(s, x, z, r, feetY = -1e9, height = 2e9) {
    if (s.maxY <= feetY + 0.05 || s.minY >= feetY + height) return false;
    const [cx, cz] = CollisionWorld.closestOnSeg(s, x, z);
    const dx = x - cx, dz = z - cz;
    return dx * dx + dz * dz < (r + s.half) * (r + s.half);
  }

  addBox(minX, minY, minZ, maxX, maxY, maxZ, tag = 'wall') {
    const b = {
      min: new THREE.Vector3(Math.min(minX, maxX), Math.min(minY, maxY), Math.min(minZ, maxZ)),
      max: new THREE.Vector3(Math.max(minX, maxX), Math.max(minY, maxY), Math.max(minZ, maxZ)),
      enabled: true,
      tag,
    };
    this.boxes.push(b);
    return b;
  }

  addBoxFromObject(obj, tag = 'prop', shrink = 0.02) {
    obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj);
    return this.addBox(bb.min.x + shrink, bb.min.y, bb.min.z + shrink, bb.max.x - shrink, bb.max.y, bb.max.z - shrink, tag);
  }

  updateBoxFromObject(box, obj, shrink = 0.02) {
    obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj);
    box.min.set(bb.min.x + shrink, bb.min.y, bb.min.z + shrink);
    box.max.set(bb.max.x - shrink, bb.max.y, bb.max.z - shrink);
  }

  addZone(minX, maxX, minZ, maxZ, h, surface = 'wood') {
    const z = { minX, maxX, minZ, maxZ, h: typeof h === 'number' ? () => h : h, surface };
    this.zones.push(z);
    return z;
  }

  // Highest floor at (x,z) that is not above feetY + step.
  groundAt(x, z, feetY, step = 0.45) {
    let best = -Infinity, surface = null;
    for (const zn of this.zones) {
      if (x < zn.minX || x > zn.maxX || z < zn.minZ || z > zn.maxZ) continue;
      const h = zn.h(x, z);
      if (h === null || h === undefined) continue;
      if (h <= feetY + step && h > best) { best = h; surface = zn.surface; }
    }
    return { y: best, surface };
  }

  // Push a vertical cylinder out of every overlapping box (2D circle vs rect).
  resolveCircle(pos, radius, feetY, height, stepClear = 0.3, prev = null, skipTag = null) {
    let hit = false;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const b of this.boxes) {
        if (!b.enabled) continue;
        if (b.max.y <= feetY + stepClear || b.min.y >= feetY + height) continue;
        const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
        const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x += (dx / d) * (radius - d);
          pos.z += (dz / d) * (radius - d);
        } else {
          // centre inside box: push out along the shallowest axis
          const pens = [
            [pos.x - b.min.x + radius, -1, 0], [b.max.x - pos.x + radius, 1, 0],
            [pos.z - b.min.z + radius, 0, -1], [b.max.z - pos.z + radius, 0, 1],
          ].sort((a, c) => a[0] - c[0]);
          pos.x += pens[0][1] * pens[0][0];
          pos.z += pens[0][2] * pens[0][0];
        }
        moved = hit = true;
      }
      for (const sg of this.segs) {
        if (!sg.enabled || (skipTag && sg.tag === skipTag)) continue;
        if (sg.maxY <= feetY + stepClear || sg.minY >= feetY + height) continue;
        const [cx, cz] = CollisionWorld.closestOnSeg(sg, pos.x, pos.z);
        let dx = pos.x - cx, dz = pos.z - cz;
        const rr = radius + sg.half;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-6) {
          // centre exactly on the segment: push along its normal, towards the side we came from
          const vx = sg.bx - sg.ax, vz = sg.bz - sg.az, l = Math.hypot(vx, vz) || 1;
          dx = -vz / l; dz = vx / l; d = 1;
          if (prev && (prev.x - cx) * dx + (prev.z - cz) * dz < 0) { dx = -dx; dz = -dz; }
          pos.x = cx + dx * rr; pos.z = cz + dz * rr;
        } else {
          pos.x += (dx / d) * (rr - d);
          pos.z += (dz / d) * (rr - d);
        }
        moved = hit = true;
      }
      if (!moved) break;
    }
    return hit;
  }

  // Distance along a ray to the nearest enabled box (for line-of-sight / interaction occlusion).
  rayBlockDistance(origin, dir, maxDist, ignore = null, filter = null) {
    const ray = new THREE.Ray(origin, dir);
    const tmp = new THREE.Vector3();
    const box = new THREE.Box3();
    let best = Infinity;
    for (const b of this.boxes) {
      if (!b.enabled || b === ignore || (filter && !filter(b))) continue;
      box.min.copy(b.min); box.max.copy(b.max);
      if (box.containsPoint(origin)) continue;
      const p = ray.intersectBox(box, tmp);
      if (p) {
        const d = p.distanceTo(origin);
        if (d < best && d <= maxDist) best = d;
      }
    }
    for (const sg of this.segs) {
      if (!sg.enabled || (filter && !filter(sg))) continue;
      const d = raySegDistance(origin, dir, sg, maxDist);
      if (d < best) best = d;
    }
    return best;
  }
}

// Ray vs thick vertical segment: 2D intersection against the segment's offset rectangle, then height check.
function raySegDistance(o, dir, s, maxDist) {
  const vx = s.bx - s.ax, vz = s.bz - s.az;
  const len = Math.hypot(vx, vz) || 1e-9;
  const ux = vx / len, uz = vz / len;          // along
  const nx = -uz, nz = ux;                     // normal
  // transform ray into segment-local 2D coords (u along, n normal)
  const ox = o.x - s.ax, oz = o.z - s.az;
  const ou = ox * ux + oz * uz, on = ox * nx + oz * nz;
  const du = dir.x * ux + dir.z * uz, dn = dir.x * nx + dir.z * nz;
  let t0 = 0, t1 = maxDist;
  const slab = (p, d, lo, hi) => {
    if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
    let a = (lo - p) / d, b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    return t0 <= t1;
  };
  if (!slab(ou, du, -s.half, len + s.half)) return Infinity;
  if (!slab(on, dn, -s.half, s.half)) return Infinity;
  if (!slab(o.y, dir.y, s.minY, s.maxY)) return Infinity;
  return t0 > 1e-4 ? t0 : Infinity; // origin inside: ignore
}
