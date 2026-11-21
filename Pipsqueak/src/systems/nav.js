// Navigation grid built automatically from the collision world (walls, furniture, fences, trees).
// Two layers: ground floor + grounds (layer 0) and the basement (layer 1), joined at the stairs.
// Doors are dynamic: cells under a door are walkable, but the agent must open a closed door before
// crossing it, and locked doors are impassable. A* with octile heuristic + line-of-sight smoothing.

class Heap {
  constructor(score) { this.a = []; this.score = score; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.score[a[p]] <= this.score[a[i]]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && this.score[a[l]] < this.score[a[m]]) m = l; if (r < a.length && this.score[a[r]] < this.score[a[m]]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

export class NavGrid {
  constructor(col, doors, opts) {
    this.col = col;
    this.doors = doors;
    Object.assign(this, { x0: -10, x1: 30.5, z0: -20, z1: 34.5, cell: 0.2, radius: 0.27 }, opts);
    this.nx = Math.ceil((this.x1 - this.x0) / this.cell);
    this.nz = Math.ceil((this.z1 - this.z0) / this.cell);
    this.N = this.nx * this.nz;
    this.layers = opts.layers;
    this.L = this.layers.length;
    const T = this.N * this.L;
    this.h = new Float32Array(T).fill(NaN);
    this.blocked = new Uint8Array(T);
    this.door = new Int16Array(T).fill(-1);
    this.links = new Map(); // node -> other-layer node
    this.g = new Float32Array(T);
    this.f = new Float32Array(T);
    this.parent = new Int32Array(T);
    this.stamp = new Uint32Array(T);
    this.closedStamp = new Uint32Array(T);
    this.run = 0;
    this.build();
  }

  cx(i) { return this.x0 + ((i % this.nx) + 0.5) * this.cell; }
  cz(i) { return this.z0 + (Math.floor(i / this.nx) + 0.5) * this.cell; }
  idx(x, z) {
    const ix = Math.floor((x - this.x0) / this.cell), iz = Math.floor((z - this.z0) / this.cell);
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return -1;
    return iz * this.nx + ix;
  }
  nodePos(n) { const i = n % this.N; return { x: this.cx(i), y: this.h[n], z: this.cz(i), layer: Math.floor(n / this.N) }; }

  build() {
    const { N, col, radius: r } = this;
    // heights per layer
    this.layers.forEach((Ly, L) => {
      for (let i = 0; i < N; i++) {
        const g = col.groundAt(this.cx(i), this.cz(i), Ly.probeY, Ly.step);
        if (g.y > -Infinity && g.y >= Ly.minY && g.y <= Ly.maxY) this.h[L * N + i] = g.y;
      }
    });
    // static obstacles: rasterise each box (expanded by the agent radius)
    for (const b of col.boxes) {
      const ix0 = Math.max(0, Math.floor((b.min.x - r - this.x0) / this.cell)), ix1 = Math.min(this.nx - 1, Math.floor((b.max.x + r - this.x0) / this.cell));
      const iz0 = Math.max(0, Math.floor((b.min.z - r - this.z0) / this.cell)), iz1 = Math.min(this.nz - 1, Math.floor((b.max.z + r - this.z0) / this.cell));
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
        const i = iz * this.nx + ix, x = this.cx(i), z = this.cz(i);
        const dx = x - Math.max(b.min.x, Math.min(x, b.max.x)), dz = z - Math.max(b.min.z, Math.min(z, b.max.z));
        if (dx * dx + dz * dz >= r * r) continue;
        for (let L = 0; L < this.L; L++) {
          const n = L * N + i, h = this.h[n];
          if (Number.isNaN(h)) continue;
          if (b.max.y > h + 0.3 && b.min.y < h + 1.8) this.blocked[n] = 1;
        }
      }
    }
    // door cells (closed position of each door leaf)
    this.doors.forEach((d, di) => {
      const s = d.seg;
      const minX = Math.min(s.ax, s.bx) - r - s.half, maxX = Math.max(s.ax, s.bx) + r + s.half;
      const minZ = Math.min(s.az, s.bz) - r - s.half, maxZ = Math.max(s.az, s.bz) + r + s.half;
      for (let z = minZ; z <= maxZ; z += this.cell * 0.5) for (let x = minX; x <= maxX; x += this.cell * 0.5) {
        const i = this.idx(x, z); if (i < 0) continue;
        if (!this.col.circleHitsSeg(s, this.cx(i), this.cz(i), r * 0.9)) continue;
        for (let L = 0; L < this.L; L++) {
          const n = L * N + i, h = this.h[n];
          if (!Number.isNaN(h) && h > s.minY - 0.5 && h < s.maxY) this.door[n] = di;
        }
      }
    });
    // cells covered by each door leaf in its OPEN position are kept clear of paths (the leaf rests there)
    this.doors.forEach((d) => {
      const s = d.seg, len = Math.hypot(s.bx - s.ax, s.bz - s.az);
      const ex = s.ax + Math.cos(d.openAngle) * len, ez = s.az - Math.sin(d.openAngle) * len;
      const os = { ax: s.ax, az: s.az, bx: ex, bz: ez, half: s.half, minY: s.minY, maxY: s.maxY };
      const minX = Math.min(os.ax, os.bx) - r - 0.1, maxX = Math.max(os.ax, os.bx) + r + 0.1;
      const minZ = Math.min(os.az, os.bz) - r - 0.1, maxZ = Math.max(os.az, os.bz) + r + 0.1;
      for (let z = minZ; z <= maxZ; z += this.cell * 0.5) for (let x = minX; x <= maxX; x += this.cell * 0.5) {
        const i = this.idx(x, z); if (i < 0) continue;
        if (!this.col.circleHitsSeg(os, this.cx(i), this.cz(i), r * 0.95)) continue;
        for (let L = 0; L < this.L; L++) {
          const n = L * N + i, h = this.h[n];
          if (!Number.isNaN(h) && h > s.minY - 0.5 && h < s.maxY && this.door[n] < 0) this.blocked[n] = 1;
        }
      }
    });
    // layer links (stairs)
    for (let i = 0; i < N; i++) {
      for (let L = 1; L < this.L; L++) {
        const a = i, b = L * N + i;
        if (Number.isNaN(this.h[a]) || Number.isNaN(this.h[b]) || this.blocked[a] || this.blocked[b]) continue;
        if (Math.abs(this.h[a] - this.h[b]) < 0.25) { this.links.set(a, b); this.links.set(b, a); }
      }
    }
  }

  walkable(n, allowDoors = true) {
    if (n < 0 || Number.isNaN(this.h[n]) || this.blocked[n]) return false;
    const d = this.door[n];
    if (d >= 0) {
      const door = this.doors[d];
      if (door.locked || door.aiLocked) return false;
      if (!allowDoors && !door.isOpenEnough()) return false;
    }
    return true;
  }

  // nearest walkable node to a world position (searches outward a few cells, prefers the right layer)
  nearest(x, y, z, maxRing = 8) {
    const i0 = this.idx(x, z); if (i0 < 0) return -1;
    const ix0 = i0 % this.nx, iz0 = Math.floor(i0 / this.nx);
    let best = -1, bestD = Infinity;
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let dz = -ring; dz <= ring; dz++) for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const ix = ix0 + dx, iz = iz0 + dz; if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) continue;
        const i = iz * this.nx + ix;
        for (let L = 0; L < this.L; L++) {
          const n = L * this.N + i;
          if (!this.walkable(n)) continue;
          const dy = Math.abs(this.h[n] - y);
          if (dy > 1.2) continue;
          const d = dx * dx + dz * dz + dy * 4;
          if (d < bestD) { bestD = d; best = n; }
        }
      }
      if (best >= 0) return best;
    }
    return best;
  }

  neighbours(n, out) {
    out.length = 0;
    const N = this.N, i = n % N, L = Math.floor(n / N);
    const ix = i % this.nx, iz = Math.floor(i / this.nx);
    const h = this.h[n];
    const ok = (m) => this.walkable(m) && Math.abs(this.h[m] - h) < 0.3;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= this.nx || jz >= this.nz) continue;
      const m = L * N + jz * this.nx + jx; if (ok(m)) out.push(m, 1);
    }
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= this.nx || jz >= this.nz) continue;
      const m = L * N + jz * this.nx + jx;
      if (ok(m) && ok(L * N + iz * this.nx + jx) && ok(L * N + jz * this.nx + ix)) out.push(m, 1.4142);
    }
    const link = this.links.get(n);
    if (link !== undefined && this.walkable(link)) out.push(link, 0.5);
  }

  // A*. Returns array of node ids from start to goal (inclusive) or null. maxIter bounds cost.
  findPath(sx, sy, sz, gx, gy, gz, maxIter = 60000) {
    const s = this.nearest(sx, sy, sz), t = this.nearest(gx, gy, gz);
    if (s < 0 || t < 0) return null;
    const run = ++this.run;
    const { g, f, parent, stamp, closedStamp, N } = this;
    const tx = this.cx(t % N), tz = this.cz(t % N), tl = Math.floor(t / N);
    const hfun = (n) => {
      const i = n % N, dx = Math.abs(this.cx(i) - tx) / this.cell, dz = Math.abs(this.cz(i) - tz) / this.cell;
      return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz) + (Math.floor(n / N) !== tl ? 4 : 0);
    };
    const heap = new Heap(f);
    g[s] = 0; f[s] = hfun(s); parent[s] = -1; stamp[s] = run; heap.push(s);
    const nb = [];
    let it = 0;
    while (heap.size && it++ < maxIter) {
      const n = heap.pop();
      if (closedStamp[n] === run) continue;
      closedStamp[n] = run;
      if (n === t) {
        const path = []; let c = n; while (c !== -1) { path.push(c); c = parent[c]; }
        return path.reverse();
      }
      this.neighbours(n, nb);
      for (let k = 0; k < nb.length; k += 2) {
        const m = nb[k]; if (closedStamp[m] === run) continue;
        const cost = nb[k + 1] + (this.door[m] >= 0 ? 1.5 : 0);
        const ng = g[n] + cost;
        if (stamp[m] !== run || ng < g[m]) { stamp[m] = run; g[m] = ng; f[m] = ng + hfun(m); parent[m] = n; heap.push(m); }
      }
    }
    return null;
  }

  // straight walkable line between two nodes on the same layer (no door crossing)
  clearLine(a, b) {
    const N = this.N; if (Math.floor(a / N) !== Math.floor(b / N)) return false;
    const L = Math.floor(a / N);
    const ax = this.cx(a % N), az = this.cz(a % N), bx = this.cx(b % N), bz = this.cz(b % N);
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (this.cell * 0.5));
    let prevH = this.h[a];
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, i = this.idx(ax + (bx - ax) * t, az + (bz - az) * t);
      const n = L * N + i;
      if (!this.walkable(n) || this.door[n] >= 0 || Math.abs(this.h[n] - prevH) > 0.3) return false;
      prevH = this.h[n];
    }
    return true;
  }

  // Convert a node path into smoothed world waypoints. Door crossings and layer changes are kept.
  waypoints(path) {
    const out = [];
    if (!path || !path.length) return out;
    let anchor = 0;
    const push = (n, door = -1) => { const p = this.nodePos(n); p.door = door; out.push(p); };
    for (let k = 1; k < path.length; k++) {
      const n = path[k];
      const isDoor = this.door[n] >= 0;
      const layerChange = Math.floor(n / this.N) !== Math.floor(path[k - 1] / this.N);
      if (isDoor || layerChange || !this.clearLine(path[anchor], n)) {
        if (k - 1 > anchor) push(path[k - 1]);
        if (isDoor) { push(n, this.door[n]); }
        anchor = k;
        if (!isDoor) push(n);
      }
    }
    push(path[path.length - 1]);
    // collapse consecutive door cells of the same door into one waypoint (keep the last)
    const res = [];
    for (const p of out) {
      const last = res[res.length - 1];
      if (last && p.door >= 0 && last.door === p.door) res[res.length - 1] = p; else res.push(p);
    }
    return res;
  }

  randomNear(x, y, z, radius, rnd = Math.random, tries = 40) {
    for (let k = 0; k < tries; k++) {
      const a = rnd() * Math.PI * 2, d = 1.5 + rnd() * radius;
      const n = this.nearest(x + Math.cos(a) * d, y, z + Math.sin(a) * d, 3);
      if (n >= 0 && this.door[n] < 0) return n;
    }
    return -1;
  }
}
