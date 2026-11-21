// The occupant's AI: hierarchical state machine + perception (sight, hearing, memory) + grid navigation.
//
// States: DORMANT -> PATROL <-> INVESTIGATE -> SEARCH -> PATROL
//                    any -> PURSUE -> LOST -> SEARCH
//                    any -> SCRIPTED (story-controlled, e.g. the sewer chase)
//
// He never reads the child's position directly except through perception: vision needs range, field of
// view and an unobstructed ray; hearing needs a noise event within (muffled) range. Memory holds the last
// seen position/velocity and recent sounds; search confidence decays over time.
import * as THREE from 'three';
import { AI, PATROL_PX, EXCLUSION, RECENT_ROOM_COOLDOWN } from '../data/antagonist.js';
import { makeFigure, animateFigure } from '../world/figure.js';
import { px, pz } from '../world/builder.js';

const S = { DORMANT: 'DORMANT', PATROL: 'PATROL', INVESTIGATE: 'INVESTIGATE', SEARCH: 'SEARCH', PURSUE: 'PURSUE', LOST: 'LOST', SCRIPTED: 'SCRIPTED' };
export const AI_STATES = S;

const tmpV = new THREE.Vector3(), tmpD = new THREE.Vector3();

export class Antagonist {
  constructor(W, game, nav) {
    this.W = W; this.game = game; this.nav = nav;
    this.cfg = AI;
    this.fig = makeFigure();
    this.fig.visible = false;
    W.scene.add(this.fig);
    this.pos = new THREE.Vector3(px(500), 0, pz(700));
    this.yaw = 0;
    this.lookYaw = null;            // when set, he turns to face this instead of his movement
    this.speed = 0;
    this.state = S.DORMANT;
    this.stateT = 0;
    this.awareness = 0;
    this.percT = 0;
    this.graceT = 0;
    this.seen = false;              // child visible on the last perception tick
    this.memory = { lastSeen: null, lastSeenT: -1e9, vel: new THREE.Vector3(), sounds: [] };
    this.path = []; this.wp = 0; this.goal = null; this.repathT = 0;
    this.stuckT = 0; this.stuckRef = this.pos.clone(); this.stuckCount = 0;
    this.doorWait = null; this.doorWaitT = 0;
    this.pause = 0; this.lookAround = 0; this.lookBase = 0;
    this.patrolPoints = PATROL_PX.map(([room, x, y]) => ({ room, x: px(x), y: 0, z: pz(y) }));
    this.recentPatrol = [];
    this.roomVisitT = {};          // room -> game time of last patrol visit
    this.zones = EXCLUSION.map((z) => ({ ...z, rect: z.px ? [px(z.px[0]), pz(z.px[1]), px(z.px[2]), pz(z.px[3])] : null, until: -1e9 }));
    this.capture = false;          // frozen while the jumpscare plays
    this.search = null;
    this.checking = null;           // hiding spot being checked
    this.stepAcc = 0;
    this.reach = 0;
    this.body = { pos: this.pos, radius: this.cfg.radius, height: this.cfg.height };
    W.bodies.push(this.body);
    this.log = [];
  }

  // ---------------- state control ----------------
  setState(s, why = '') {
    if (this.state === s) return;
    this.log.push(`${this.game.time.toFixed(1)} ${this.state}->${s} ${why}`);
    if (this.log.length > 60) this.log.shift();
    this.state = s; this.stateT = 0;
    this.path = []; this.wp = 0; this.pause = 0; this.lookYaw = null; this.checking = null; this.doorWait = null;
    if (s === S.PURSUE) { this.W.audio?.sting(0.12); }
  }

  activate(x, z) {
    this.pos.set(x, 0, z);
    this.fig.visible = true;
    this.setState(S.PATROL, 'activate');
  }

  setScripted() { this.setState(S.SCRIPTED, 'story'); this.fig.visible = false; }

  // Put him somewhere far from the respawn point, unaware, patrolling.
  respawnAwayFrom(p) {
    let best = null, bestD = -1;
    for (const pt of this.patrolPoints) {
      const d = Math.hypot(pt.x - p.x, pt.z - p.z);
      if (d > bestD) { bestD = d; best = pt; }
    }
    const cand = this.patrolPoints.filter((pt) => Math.hypot(pt.x - p.x, pt.z - p.z) >= this.cfg.minRespawnDistance);
    const pick = cand.length ? cand[Math.floor(Math.random() * cand.length)] : best;
    this.pos.set(pick.x, 0, pick.z);
    this.awareness = 0;
    this.memory.lastSeen = null; this.memory.sounds = [];
    this.graceT = this.cfg.graceAfterRespawn;
    this.capture = false;
    for (const z of this.zones) z.until = -1e9;
    this.fig.visible = true;
    this.state = null;
    this.setState(S.PATROL, 'respawn');
  }

  // ---------------- perception ----------------
  eye() { return tmpV.set(this.pos.x, this.pos.y + 1.62, this.pos.z); }

  canSeeChild() {
    const g = this.game, pl = g.player, c = this.cfg;
    if (g.hiding || this.graceT > 0) return 0;
    const p = pl.pos;
    if (Math.abs(p.y - this.pos.y) > 1.6) return 0;             // different floor
    const eye = this.eye().clone();
    const headY = p.y + (pl.crouching ? 0.85 : 1.3), chestY = p.y + (pl.crouching ? 0.5 : 0.85);
    const dx = p.x - eye.x, dz = p.z - eye.z;
    const d = Math.hypot(dx, dz);
    const range = pl.flashOn ? c.visionRangeFlashlight : c.visionRange;
    if (d > range) return 0;
    const fwdX = Math.sin(this.yaw), fwdZ = Math.cos(this.yaw);
    const cosA = (dx * fwdX + dz * fwdZ) / (d || 1);
    const inFov = cosA > Math.cos(c.fov / 2);
    if (!inFov && d > c.closeSenseRange) return 0;
    let visible = false;
    for (const ty of [headY, chestY]) {
      tmpD.set(p.x - eye.x, ty - eye.y, p.z - eye.z);
      const dist = tmpD.length(); tmpD.normalize();
      if (this.W.col.rayBlockDistance(eye, tmpD, dist) >= dist - 0.05) { visible = true; break; }
    }
    if (!visible) return 0;
    let f = Math.pow(Math.max(0, 1 - d / range), 0.6);
    if (pl.crouching) f *= c.crouchVisibility;
    if (!pl.moving) f *= 0.7;
    if (pl.flashOn) f *= 1.35;
    f *= 0.6 + 0.4 * Math.max(0, cosA);                          // centre of vision counts more
    if (d < 2.5) f = Math.max(f, 0.9);
    return f;
  }

  perceive(dt) {
    const c = this.cfg, pl = this.game.player;
    const f = this.canSeeChild();
    this.seen = f > 0;
    if (this.seen) {
      this.awareness = Math.min(1.2, this.awareness + c.detectRate * f * dt * (this.state === S.PURSUE ? 3 : 1));
      const prev = this.memory.lastSeen;
      if (prev && this.game.time - this.memory.lastSeenT < 0.6) {
        const k = 1 / Math.max(0.05, this.game.time - this.memory.lastSeenT);
        this.memory.vel.set((pl.pos.x - prev.x) * k, 0, (pl.pos.z - prev.z) * k);
      }
      this.memory.lastSeen = pl.pos.clone();
      this.memory.lastSeenT = this.game.time;
    } else {
      this.awareness = Math.max(0, this.awareness - c.awarenessDecay * dt);
    }
    if (this.state === S.SCRIPTED || this.state === S.DORMANT) return;
    if (this.seen && this.awareness >= c.confirmThreshold && this.state !== S.PURSUE) this.setState(S.PURSUE, 'saw child');
    else if (this.seen && this.awareness >= c.suspicionThreshold && (this.state === S.PATROL || this.state === S.SEARCH)) {
      this.startInvestigate(pl.pos, 'glimpse');
    }
  }

  // Event-driven hearing. radius is how far the sound carries in open air.
  hear(pos, radius, kind = 'noise') {
    if (this.state === S.SCRIPTED || this.state === S.DORMANT || this.graceT > 0) return;
    const c = this.cfg;
    let r = radius * c.hearingMultiplier;
    if (Math.abs(pos.y - this.pos.y) > 1.6) r *= c.otherFloorFactor;
    const ear = this.eye().clone();
    tmpD.set(pos.x - ear.x, (pos.y + 0.3) - ear.y, pos.z - ear.z);
    const d = tmpD.length(); tmpD.normalize();
    if (this.W.col.rayBlockDistance(ear, tmpD, d) < d - 0.1) r *= c.muffledFactor;
    if (d > r) return;
    const err = c.soundError * (d / r);
    let guess = new THREE.Vector3(pos.x + (Math.random() - 0.5) * 2 * err, pos.y, pos.z + (Math.random() - 0.5) * 2 * err);
    const z = this.zoneAt(pos, 1.2) || this.zoneAt(guess, 1.2);   // judge by where the sound really was
    if (z && this.state !== S.PURSUE) {
      // anti-camping: a zone he has just checked is ignored until its cooldown ends (unless he saw the child)
      if (this.game.time < z.until && !this.recentlySawChild()) return;
      // noises from the basement: he goes to the top of the stairs to listen, not down into it
      if (z.layer === -1) guess = this.stairListenPoint();
    }
    this.memory.sounds.push({ pos: guess, t: this.game.time, kind });
    if (this.memory.sounds.length > 6) this.memory.sounds.shift();
    if (this.state === S.PURSUE) {
      if (!this.seen) { this.memory.lastSeen = guess; this.memory.lastSeenT = this.game.time; this.memory.vel.set(0, 0, 0); }
      return;
    }
    if (this.state === S.LOST || this.state === S.SEARCH || this.state === S.INVESTIGATE || this.state === S.PATROL) {
      this.startInvestigate(guess, `heard ${kind}`);
    }
  }

  // ---------------- exclusion zones (anti spawn-camping) ----------------
  zoneAt(p, margin = 0) {
    for (const z of this.zones) {
      if (z.layer === -1) { if (p.y < -1) return z; continue; }
      const [x0, z0, x1, z1] = z.rect;
      if (p.x > x0 - margin && p.x < x1 + margin && p.z > z0 - margin && p.z < z1 + margin && p.y > -1) return z;
    }
    return null;
  }
  recentlySawChild(sec = 10) { return this.game.time - this.memory.lastSeenT < sec; }
  // after dealing with a zone he leaves it alone for its cooldown
  coolZone(z) { if (z) { z.until = this.game.time + z.cooldown; this.log.push(`${this.game.time.toFixed(1)} cooldown ${z.name}`); } }
  // the nearest point just outside the basement-exit zone (where he stands to listen down the stairs)
  stairListenPoint() { return new THREE.Vector3(px(460), 0, pz(405)); }

  // Called by the game when the child climbs into a hiding place. Hidden children are SAFE under the
  // current design: he may have seen it and walk over to stare at the spot, but he never catches them there.
  onChildHid(spot) {
    if (this.state === S.SCRIPTED || this.state === S.DORMANT) return;
    const since = this.game.time - this.memory.lastSeenT;
    if (since < this.cfg.sawHideWindow && this.distTo(spot.pos) < this.cfg.visionRangeFlashlight) {
      if (this.state !== S.PURSUE) this.setState(S.PURSUE, 'saw hiding');
      this.checking = spot; this.knowsHidden = true;  // goes there, lingers, then searches the area
    }
  }

  startInvestigate(p, why) {
    // keep the current investigation unless this is newer and meaningfully elsewhere
    if (this.state === S.INVESTIGATE && this.goal && Math.hypot(this.goal.x - p.x, this.goal.z - p.z) < 1.5) { this.goal = p.clone(); return; }
    this.setState(S.INVESTIGATE, why);
    this.goal = p.clone();
    this.investigatePhase = 'go';
  }

  // ---------------- navigation ----------------
  pathTo(target) {
    const nodes = this.nav.findPath(this.pos.x, this.pos.y, this.pos.z, target.x, target.y ?? 0, target.z);
    this.path = nodes ? this.nav.waypoints(nodes) : [];
    this.wp = this.path.length > 1 ? 1 : 0;
    this.goal = target.clone ? target.clone() : new THREE.Vector3(target.x, target.y ?? 0, target.z);
    this.repathT = 0;
    return this.path.length > 0;
  }

  arrived(tol = 0.45) { return this.path.length && this.wp >= this.path.length - 1 && this.distTo(this.path[this.path.length - 1]) < tol; }
  distTo(p) { return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }

  // Follow the current path; handles doors. Returns true while still travelling.
  follow(dt, speed) {
    if (!this.path.length) { this.speed = 0; return false; }
    const W = this.W;
    // doors: open a closed door on the way before stepping into it
    const wp = this.path[Math.min(this.wp, this.path.length - 1)];
    if (wp.door >= 0) {
      const d = W.doors[wp.door];
      const dc = Math.hypot(d.center.x - this.pos.x, d.center.z - this.pos.z);
      if (!d.isOpenEnough() && dc < 1.25) {
        this.speed = 0;
        this.lookYaw = Math.atan2(d.center.x - this.pos.x, d.center.z - this.pos.z);
        this.reach = 1;
        if (d.locked || d.aiLocked) { this.path = []; return false; }
        if (!d.animating || d.target !== d.openAngle) d.setOpen(true, { by: 'ai' });
        this.doorWaitT += dt;
        if (this.doorWaitT > 3) { this.doorWaitT = 0; this.path = []; }  // something holds it: give up, re-plan
        return true;
      }
    }
    this.doorWaitT = 0; this.reach = 0;
    const tgt = this.path[this.wp];
    const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.3 && this.wp < this.path.length - 1) {
      const passed = this.path[this.wp];
      this.wp++;
      if (passed.door >= 0) this.maybeCloseBehind(W.doors[passed.door]);
      return true;
    }
    if (dist < 0.12) { this.speed = 0; return false; }
    this.moveDir(dx / dist, dz / dist, Math.min(speed, dist / dt), dt);
    return true;
  }

  maybeCloseBehind(d) {
    if (this.state !== S.PATROL || Math.random() > 0.3) return;
    setTimeout(() => { if (this.state === S.PATROL && d.open && !d.locked) d.setOpen(false, { by: 'ai' }); }, 1300);
  }

  moveDir(nx, nz, speed, dt) {
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    const prev = this.pos.clone();
    this.pos.x += nx * this.speed * dt;
    this.pos.z += nz * this.speed * dt;
    this.W.col.resolveCircle(this.pos, this.cfg.radius, this.pos.y, this.cfg.height, 0.3, prev);
    const g = this.W.col.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.5);
    if (g.y > -Infinity && Math.abs(g.y - this.pos.y) < 0.6) this.pos.y = g.y; else { this.pos.x = prev.x; this.pos.z = prev.z; }
    this.lookYaw = null;
    this.yawTarget = Math.atan2(nx, nz);
  }

  stuckCheck(dt, moving) {
    this.stuckT += dt;
    if (this.stuckT < 1.2) return;
    const moved = this.pos.distanceTo(this.stuckRef);
    this.stuckRef.copy(this.pos); this.stuckT = 0;
    if (moving && moved < 0.2 && !this.doorWaitT) {
      this.stuckCount++;
      this.path = [];                         // re-plan next tick
      if (this.stuckCount > 3) {              // nudge free and give up on this goal
        const n = this.nav.nearest(this.pos.x, this.pos.y, this.pos.z, 6);
        if (n >= 0) { const p = this.nav.nodePos(n); this.pos.x = p.x; this.pos.z = p.z; }
        this.stuckCount = 0; this.goal = null;
        if (this.state === S.PATROL) this.pause = 0.5;
      }
    } else this.stuckCount = 0;
  }

  // ---------------- per-state behaviour ----------------
  update(dt) {
    if (this.state === S.DORMANT || this.state === S.SCRIPTED || this.capture) return;
    const c = this.cfg, g = this.game, pl = g.player;
    this.stateT += dt;
    if (this.graceT > 0) this.graceT -= dt;
    this.percT += dt;
    if (this.percT >= c.perceptionInterval) { this.perceive(this.percT); this.percT = 0; }

    let moving = false;
    switch (this.state) {
      case S.PATROL: moving = this.patrol(dt); break;
      case S.INVESTIGATE: moving = this.investigate(dt); break;
      case S.SEARCH: moving = this.searchUpdate(dt); break;
      case S.PURSUE: moving = this.pursue(dt); break;
      case S.LOST: moving = this.lost(dt); break;
    }
    this.stuckCheck(dt, moving);

    // turning
    const target = this.lookYaw ?? this.yawTarget ?? this.yaw;
    let dy = ((target - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.yaw += Math.sign(dy) * Math.min(Math.abs(dy), c.turnRate * dt);

    // catch
    if (this.state === S.PURSUE && !g.hiding) {
      const d = Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
      if (d < c.catchDistance && Math.abs(pl.pos.y - this.pos.y) < 1) { g.caughtByOccupant('He caught you.'); }
    }

    // body, sound
    this.fig.position.copy(this.pos);
    this.fig.rotation.y = this.yaw;
    animateFigure(this.fig, dt, moving ? this.speed : 0, this.reach);
    if (moving) {
      this.stepAcc += this.speed * dt;
      const stride = this.speed > 3 ? 0.95 : 0.75;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        const surf = this.W.col.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.1).surface;
        this.W.audio?.footstep(surf, this.speed > 3 ? 1.5 : 1.0, this.pos.clone().setY(this.pos.y + 0.1), 'occupant');
        this.game.floorCreak?.(this.pos, 'occupant');
      }
    }
    const dpl = this.pos.distanceTo(pl.pos);
    if (this.state === S.PURSUE || dpl < 4) this.W.audio?.setBreath(this.pos.clone().setY(this.pos.y + 1.6), Math.min(0.9, 2.5 / Math.max(1, dpl)), this.state === S.PURSUE ? 1.5 : 0.7);
    else this.W.audio?.setBreath(this.pos, 0);
  }

  lookAroundUpdate(dt) {
    this.lookAround += dt;
    this.lookYaw = this.lookBase + Math.sin(this.lookAround * 1.1) * 1.2;
  }

  // Pick the next patrol point: never in an exclusion zone, not one of the last few, prefer rooms he has
  // not visited for a while and points a reasonable distance away. Weighted random, so it is not predictable.
  nextPatrolPoint() {
    const t = this.game.time;
    const cands = this.patrolPoints.filter((p) => !this.recentPatrol.includes(p) && !this.zoneAt(p) && this.distTo(p) > 3);
    let total = 0;
    const w = cands.map((p) => {
      const since = t - (this.roomVisitT[p.room] ?? -1e9);
      let wt = since > RECENT_ROOM_COOLDOWN ? 3 : 0.4;
      const d = this.distTo(p);
      wt *= d < 6 ? 0.7 : d > 16 ? 0.8 : 1.2;
      total += wt; return wt;
    });
    let r = Math.random() * total;
    for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) return cands[i]; }
    return cands[0] || this.patrolPoints[0];
  }

  patrol(dt) {
    if (this.pause > 0) { this.pause -= dt; this.lookAroundUpdate(dt); this.speed = 0; return false; }
    if (!this.path.length || !this.goal) {
      const next = this.nextPatrolPoint();
      this.patrolTarget = next;
      this.recentPatrol.push(next); if (this.recentPatrol.length > 5) this.recentPatrol.shift();
      if (!this.pathTo(new THREE.Vector3(next.x, 0, next.z))) { this.pause = 1; return false; }
    }
    const moving = this.follow(dt, this.cfg.walkSpeed);
    if (this.arrived() || (!moving && this.path.length)) {
      const [a, b] = this.cfg.patrolPause;
      // never stand around inside an exclusion zone (e.g. outside the basement door)
      this.pause = this.zoneAt(this.pos) ? 0 : a + Math.random() * (b - a);
      if (this.patrolTarget) this.roomVisitT[this.patrolTarget.room] = this.game.time;
      this.lookBase = this.yaw; this.lookAround = 0;
      this.path = []; this.goal = null;
    }
    return moving;
  }

  investigate(dt) {
    if (this.investigatePhase === 'go') {
      if (!this.path.length || this.repathT > 1.5) { this.repathT = 0; if (!this.pathTo(this.goal)) { this.investigatePhase = 'look'; this.stateT = 0; } }
      this.repathT += dt;
      const moving = this.follow(dt, this.cfg.briskSpeed);
      if (this.arrived(0.6) || (!moving && this.path.length) || this.stateT > 25) {
        this.investigatePhase = 'look'; this.stateT = 0; this.lookBase = this.yaw; this.lookAround = 0;
      }
      return moving;
    }
    if (this.investigatePhase === 'look') {
      this.speed = 0; this.lookAroundUpdate(dt);
      const zone = this.zoneAt(this.goal, 1.2);
      if (zone && this.stateT > this.cfg.investigateLookTime * 0.6) {
        // checked the area near the basement: nothing. Leave it alone for a while and go elsewhere.
        this.coolZone(zone);
        this.beginSearch(this.outsideZone(this.goal), 10);
        return false;
      }
      if (this.stateT > this.cfg.investigateLookTime) {
        // check one nearby hiding place, then search the area for a while
        const spot = this.pickHidingSpot(this.goal, 4.5, 1);
        if (spot) { this.checking = spot; this.investigatePhase = 'check'; this.pathTo(spot.front); }
        else this.beginSearch(this.goal, 12);
      }
      return false;
    }
    if (this.investigatePhase === 'check') return this.checkSpot(dt, () => this.beginSearch(this.goal, 12));
    return false;
  }

  pursue(dt) {
    const c = this.cfg, pl = this.game.player, m = this.memory;
    const since = this.game.time - m.lastSeenT;
    if (this.checking) { const sp = this.checking; return this.checkSpot(dt, () => this.beginSearch(sp.front, 15)); }
    if (!this.seen && since > c.pursuitMemory) {
      this.setState(S.LOST, 'lost sight');
      const ex = m.lastSeen ? m.lastSeen.clone().addScaledVector(m.vel, Math.min(1.5, since)) : this.pos.clone();
      this.goal = ex; this.lostPhase = 'go';
      return false;
    }
    // where to go: the child if seen, otherwise the remembered position extrapolated a little
    const target = this.seen ? pl.pos : m.lastSeen.clone().addScaledVector(m.vel, Math.min(1.0, since));
    const d = this.distTo(target);
    const direct = this.seen && d < 7 && Math.abs(pl.pos.y - this.pos.y) < 0.5 && this.directClear(target);
    if (direct) {
      const dx = target.x - this.pos.x, dz = target.z - this.pos.z, l = Math.hypot(dx, dz) || 1;
      this.moveDir(dx / l, dz / l, c.pursuitSpeed, dt);
      this.path = [];
      return true;
    }
    this.repathT += dt;
    if (!this.path.length || this.repathT > c.repathInterval) this.pathTo(target);
    return this.follow(dt, c.pursuitSpeed);
  }

  // direct steering only when the straight line on the nav grid is open (no door/furniture between)
  directClear(t) {
    const a = this.nav.nearest(this.pos.x, this.pos.y, this.pos.z, 2), b = this.nav.nearest(t.x, t.y, t.z, 2);
    return a >= 0 && b >= 0 && this.nav.clearLine(a, b);
  }

  lost(dt) {
    if (this.lostPhase === 'go') {
      if (!this.path.length) { if (!this.pathTo(this.goal)) { this.lostPhase = 'look'; this.stateT = 0; } }
      const moving = this.follow(dt, this.cfg.briskSpeed * 1.3);
      if (this.arrived(0.6) || (!moving && this.path.length) || this.stateT > 12) { this.lostPhase = 'look'; this.stateT = 0; this.lookBase = this.yaw; this.lookAround = 0; }
      return moving;
    }
    this.speed = 0; this.lookAroundUpdate(dt);
    if (this.stateT > this.cfg.lostLookTime) this.beginSearch(this.goal, this.cfg.searchDuration);
    return false;
  }

  // move a point out of any exclusion zone (search around it, not inside it)
  outsideZone(p) {
    const z = this.zoneAt(p);
    if (!z) return p.clone();
    // search the rooms around the zone instead: the nearest patrol point at least 5 m from the stairs
    const exit = this.stairListenPoint();
    const pts = this.patrolPoints.filter((q) => Math.hypot(q.x - exit.x, q.z - exit.z) > 5)
      .sort((a, b) => Math.hypot(a.x - exit.x, a.z - exit.z) - Math.hypot(b.x - exit.x, b.z - exit.z));
    const q = pts[Math.floor(Math.random() * Math.min(3, pts.length))];
    return new THREE.Vector3(q.x, 0, q.z);
  }

  beginSearch(center, duration) {
    const z = this.zoneAt(center);
    if (z && !(z.layer === -1 && this.pos.y < -1)) { this.coolZone(z); center = this.outsideZone(center); duration = Math.min(duration, 12); }
    if (z && z.layer === -1 && this.pos.y < -1) duration = Math.min(duration, 12); // brief look round the basement only
    this.setState(S.SEARCH, 'searching');
    this.search = { center: center.clone(), until: this.game.time + duration, checks: 0, phase: 'pick', zone: z };
  }

  searchUpdate(dt) {
    const s = this.search, c = this.cfg;
    if (!s || this.game.time > s.until) { if (s?.zone) this.coolZone(s.zone); this.setState(S.PATROL, 'gave up'); return false; }
    if (s.phase === 'check') return this.checkSpot(dt, () => { s.phase = 'pick'; });
    if (s.phase === 'pause') {
      this.speed = 0; this.lookAroundUpdate(dt);
      s.pauseT -= dt; if (s.pauseT <= 0) s.phase = 'pick';
      return false;
    }
    if (s.phase === 'pick') {
      const spot = s.checks < c.maxHidingChecks && Math.random() < c.hidingCheckChance ? this.pickHidingSpot(s.center, 7) : null;
      if (spot) { s.checks++; this.checking = spot; s.phase = 'check'; this.pathTo(spot.front); return false; }
      let n = -1, p = null;
      for (let k = 0; k < 6 && n < 0; k++) {
        const m = this.nav.randomNear(s.center.x, s.center.y, s.center.z, c.searchRadius);
        if (m < 0) continue;
        const q = this.nav.nodePos(m);
        if (this.zoneAt(q) && !(s.zone && s.zone.layer === -1 && this.pos.y < -1)) continue; // do not search inside zones
        n = m; p = q;
      }
      if (n < 0) { s.phase = 'pause'; s.pauseT = 2; return false; }
      this.pathTo(new THREE.Vector3(p.x, p.y, p.z));
      s.phase = 'go';
    }
    const moving = this.follow(dt, c.briskSpeed);
    if (this.arrived(0.5) || (!moving && this.path.length) || !this.path.length) {
      s.phase = 'pause'; s.pauseT = 1.2 + Math.random() * 2; this.lookBase = this.yaw; this.lookAround = 0;
    }
    return moving;
  }

  pickHidingSpot(center, radius, limit = 99) {
    const spots = (this.game.hidingSpots || []).filter((h) => Math.hypot(h.front.x - center.x, h.front.z - center.z) < radius && h.lastChecked !== this.search?.until);
    if (!spots.length || limit <= 0) return null;
    return spots[Math.floor(Math.random() * spots.length)];
  }

  // Walk to a hiding place and inspect it from outside: he stands there, tries the handle / crouches to
  // look, breathes, then moves on. Under the current design a hidden child is never caught here.
  checkSpot(dt, done) {
    const spot = this.checking;
    if (!spot) { done(); return false; }
    if (this.distTo(spot.front) > 0.5) {
      if (!this.path.length) this.pathTo(spot.front);
      const moving = this.follow(dt, this.knowsHidden ? this.cfg.pursuitSpeed * 0.8 : this.cfg.briskSpeed);
      if (moving) return true;
      if (this.distTo(spot.front) > 1.0) { this.checking = null; this.knowsHidden = false; done(); return false; }
    }
    this.speed = 0;
    this.lookYaw = Math.atan2(spot.pos.x - this.pos.x, spot.pos.z - this.pos.z);
    this.reach = spot.type === 'cupboard' ? 0.6 : 0;
    spot.checkT = (spot.checkT || 0) + dt;
    if (spot.checkT > 0.3 && !spot.rattled) { spot.rattled = true; if (spot.type === 'cupboard') this.W.audio?.rattle(spot.pos); }
    const linger = this.knowsHidden ? 3.0 : 1.4;   // he lingers longer if he saw the child go in
    if (spot.checkT > linger) {
      spot.checkT = 0; spot.rattled = false; spot.lastChecked = this.search?.until;
      this.reach = 0;
      this.game.emit('spotChecked', { spot, childInside: this.game.hiding?.spot === spot });
      this.checking = null; this.knowsHidden = false;
      done();
    }
    return false;
  }
}
