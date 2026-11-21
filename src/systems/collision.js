// Collision world: axis-aligned boxes for walls/furniture/doors and
// height zones for floors, stairs and ramps. Kept separate from visual meshes.
import * as THREE from 'three';

export class CollisionWorld {
  constructor() {
    this.boxes = [];   // { min:Vector3, max:Vector3, enabled, tag }
    this.zones = [];   // { minX,maxX,minZ,maxZ, h:(x,z)=>number|null, surface }
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
  resolveCircle(pos, radius, feetY, height, stepClear = 0.3) {
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
    return best;
  }
}
