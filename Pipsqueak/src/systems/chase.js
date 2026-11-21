// Scripted sewer chase: the occupant follows the child into the straight tunnel.
// Rubber-banded so it is tense but fair; a sprinting player stays just ahead.
import * as THREE from 'three';
import { makeFigure, animateFigure } from '../world/figure.js';
import { SEWER } from '../world/sewer.js';

export const CHASE = {
  triggerZ: -27.5,        // player must be this far into the tunnel
  startGap: 10,           // metres behind the player when he appears
  graceTime: 1.6,         // seconds of slow entry before full pursuit
  farSpeed: 5.4,          // gap > 6 m
  midSpeed: 4.8,          // 3.5 m < gap < 6 m (slightly faster than a sprint: he closes in)
  nearSpeed: 4.45,        // gap < 3.5 m (a sprinting player can pull away)
  catchDist: 0.95,
  endZ: SEWER.zEnd + 5.5, // confrontation trigger
  confrontGap: 2.4,
};

export class Chase {
  constructor(W, game) {
    this.W = W;
    this.game = game;
    this.state = 'idle';
    this.fig = game.ai ? game.ai.fig : makeFigure(); // the same man as the house AI
    if (!game.ai) W.scene.add(this.fig);
    this.pos = new THREE.Vector3();
    this.t = 0;
    this.stepAcc = 0;
    this.speed = 0;
    // Backlight: a dim, cool light a little behind him so his outline reads against the wall.
    this.back = new THREE.PointLight(0x8796b0, 0, 5.0, 1.1);
    // His own torch, pointed ahead at the floor in front of him.
    this.torch = new THREE.SpotLight(0xffe3b0, 0, 9, 0.32, 0.6, 1.5);
    W.scene.add(this.back, this.torch, this.torch.target);
  }

  canStart() {
    return this.state === 'idle' && this.W.grate?.open && this.game.player.pos.z < CHASE.triggerZ && this.game.player.pos.y < -3.0;
  }

  start() {
    const p = this.game.player.pos;
    this.game.ai?.setScripted();          // house AI hands control of his body to this sequence
    this.state = 'run';
    this.done = false;
    this.speed = 0;
    this.t = 0;
    this.pos.set(SEWER.x, SEWER.floorY, Math.min(p.z + CHASE.startGap, -21.0));
    this.pos.y = this.W.col.groundAt(this.pos.x, this.pos.z, 5).y;
    this.fig.visible = true;
    this.W.audio?.clang(new THREE.Vector3(4, 0.5, -20));
    this.W.audio?.sting(0.15);
    this.game.setObjective('run');
    this.game.ui.hint('Hold Q or right mouse to look behind you');
  }

  reset() {
    this.state = 'idle';
    this.done = false;
    this.fig.visible = false;
    this.back.intensity = 0;
    this.torch.intensity = 0;
    this.W.audio?.setBreath(this.pos, 0);
  }

  update(dt) {
    if (this.state === 'idle') { if (this.canStart()) this.start(); return; }
    const W = this.W, pl = this.game.player, p = pl.pos;
    this.t += dt;
    const gap = this.pos.z - p.z; // he is at larger z (behind the player, who runs towards -z)

    if (this.state === 'run') {
      let target;
      if (this.t < CHASE.graceTime) target = 2.2;
      else if (gap > 6) target = CHASE.farSpeed;
      else if (gap > 3.5) target = CHASE.midSpeed;
      else target = CHASE.nearSpeed;
      this.speed += (target - this.speed) * Math.min(1, dt * 2.5);
      this.moveToward(p, this.speed, dt);
      if (this.pos.distanceTo(p) < CHASE.catchDist) { this.state = 'caught'; this.game.caught(); }
      else if (p.z < CHASE.endZ) { this.state = 'confront'; this.t = 0; this.game.beginConfrontation(); }
    } else if (this.state === 'confront') {
      // he slows to a walk and closes the last metres
      const d = Math.hypot(this.pos.x - p.x, this.pos.z - p.z);
      this.speed += ((d > CHASE.confrontGap ? (d > 6 ? 3.2 : 1.3) : 0) - this.speed) * Math.min(1, dt * 3);
      if (d > CHASE.confrontGap) this.moveToward(p, this.speed, dt);
      else if (this.speed < 0.2 && !this.done) { this.done = true; this.game.finalBlackout(); }
    }

    // pose + lights
    this.fig.position.copy(this.pos);
    this.fig.rotation.y = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    animateFigure(this.fig, dt, this.speed);
    this.back.position.set(this.pos.x, this.pos.y + 1.1, this.pos.z + 2.0);
    this.back.intensity = 5;
    this.torch.position.set(this.pos.x + 0.25, this.pos.y + 1.2, this.pos.z - 0.2);
    this.torch.target.position.set(p.x, p.y, p.z - 1.5);
    this.torch.intensity = this.state === 'confront' ? 2 : 3.5 + Math.sin(this.t * 9) * 0.6;

    // footsteps and breathing grow with proximity
    const d = this.pos.distanceTo(p);
    this.stepAcc += this.speed * dt;
    if (this.stepAcc > 0.85) {
      this.stepAcc = 0;
      W.audio?.footstep('water', 1.4 + Math.max(0, 6 - d) * 0.25, this.pos.clone().setY(this.pos.y + 0.1));
    }
    W.audio?.setBreath(this.pos.clone().setY(this.pos.y + 1.6), Math.min(1.2, 0.2 + 3 / Math.max(1, d)), this.speed > 3 ? 1.6 : 0.8);
  }

  moveToward(p, speed, dt) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    this.pos.x += (dx / len) * speed * dt;
    this.pos.z += (dz / len) * speed * dt;
    this.pos.x = Math.max(SEWER.x - SEWER.halfW + 0.35, Math.min(SEWER.x + SEWER.halfW - 0.35, this.pos.x));
    const g = this.W.col.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5, 1.0);
    if (g.y > -Infinity) this.pos.y = g.y;
  }
}
