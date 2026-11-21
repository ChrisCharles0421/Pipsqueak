// Centre-screen raycast interaction with wall occlusion, plus a minimal inventory.
import * as THREE from 'three';

export class Interactions {
  constructor() {
    this.items = []; // { obj, prompt, use, enabled }
    this.objects = [];
    this.ray = new THREE.Raycaster();
    this.ray.far = 2.3;
    this.current = null;
  }
  add(obj, { prompt, use, enabled = () => true }) {
    const it = { obj, prompt, use, enabled };
    obj.userData.interact = it;
    this.items.push(it);
    this.objects.push(obj);
    return it;
  }
  remove(obj) {
    this.items = this.items.filter((i) => i.obj !== obj);
    this.objects = this.objects.filter((o) => o !== obj);
  }
  findItem(o) {
    while (o) { if (o.userData.interact) return o.userData.interact; o = o.parent; }
    return null;
  }
  update(camera, col) {
    this.ray.setFromCamera({ x: 0, y: 0 }, camera);
    const hits = this.ray.intersectObjects(this.objects, true);
    this.current = null;
    for (const h of hits) {
      const it = this.findItem(h.object);
      if (!it || !it.enabled()) continue;
      // blocked by a wall or closed door in front of it? (furniture does not block)
      const block = col.rayBlockDistance(this.ray.ray.origin, this.ray.ray.direction, h.distance, null, (b) => b.tag !== 'prop' && b.tag !== 'tree');
      if (block < h.distance - 0.12) break;
      this.current = it;
      break;
    }
    return this.current;
  }
}

export class Inventory {
  constructor(defs) { this.defs = defs; this.items = new Set(); }
  add(id) { this.items.add(id); }
  has(id) { return this.items.has(id); }
  label(id) { return this.defs[id]?.label || id; }
  list() { return [...this.items].map((id) => ({ id, ...this.defs[id] })); }
}
