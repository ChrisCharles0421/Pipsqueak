// First-person child controller: walking, sprinting, crouching, flashlight, footsteps and noise.
import * as THREE from 'three';

export const PLAYER = {
  radius: 0.27,
  standH: 1.45, crouchH: 0.95,
  eyeStand: 1.33, eyeCrouch: 0.85,
  walk: 2.3, sprint: 4.7, crouch: 1.15,
  accel: 14, gravity: 18,
};

export class Player {
  constructor(W, camera) {
    this.W = W;
    this.cam = camera;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.yaw = 0; this.pitch = 0;
    this.lookBack = 0;           // 0..1 blend for "look behind"
    this.crouching = false;
    this.eye = PLAYER.eyeStand;
    this.stepDist = 0;
    this.bob = 0;
    this.surface = 'concrete';
    this.frozen = false;
    this.speedMul = 1;
    this.lastNoise = 0;
    this.moving = false;
    this.sprinting = false;

    this.flash = new THREE.SpotLight(0xfff1d6, 0, 10, 0.5, 0.55, 1.6);
    this.flash.castShadow = true;
    this.flash.shadow.mapSize.set(512, 512);
    this.flash.shadow.camera.near = 0.1;
    this.flash.shadow.camera.far = 12;
    this.flash.shadow.bias = -0.0015;
    camera.add(this.flash);
    this.flash.position.set(0.18, -0.15, 0.1);
    this.flash.target.position.set(0, -0.2, -5);
    camera.add(this.flash.target);
    this.hasFlash = false;
    this.flashOn = false;
    this.flashProfile = { intensity: 9, distance: 10 };
  }

  spawn(x, y, z, yaw = 0) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.yaw = yaw; this.pitch = 0;
    this.updateCamera(0);
  }

  setFlash(on) {
    this.flashOn = on && this.hasFlash;
    this.flash.intensity = this.flashOn ? this.flashProfile.intensity : 0;
    this.flash.distance = this.flashProfile.distance;
    this.W.audio?.click();
  }

  update(dt, input) {
    const W = this.W;
    // look
    if (!this.frozen) {
      this.yaw -= input.mouseDX * input.sensitivity;
      this.pitch -= input.mouseDY * input.sensitivity;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }
    const wantBack = !this.frozen && (input.is('lookBack') || input.rmb) ? 1 : 0;
    this.lookBack += (wantBack - this.lookBack) * Math.min(1, dt * 10);

    // movement intent (relative to body yaw, not the look-back offset)
    let fx = 0, fz = 0;
    if (!this.frozen) {
      if (input.is('forward')) fz -= 1;
      if (input.is('back')) fz += 1;
      if (input.is('left')) fx -= 1;
      if (input.is('right')) fx += 1;
      if (input.was('crouch')) this.crouching = !this.crouching;
    }
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }
    this.sprinting = input.is('sprint') && fz < 0 && !this.frozen;
    if (this.sprinting) this.crouching = false;
    // stand up only if nothing above (no low ceilings in this map; keep simple)
    const speed = (this.crouching ? PLAYER.crouch : this.sprinting ? PLAYER.sprint : PLAYER.walk) * this.speedMul;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const tx = (fx * cos + fz * sin) * speed;
    const tz = (-fx * sin + fz * cos) * speed;
    const a = Math.min(1, PLAYER.accel * dt);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.z += (tz - this.vel.z) * a;

    // integrate horizontally in sub-steps with collision
    const h = this.crouching ? PLAYER.crouchH : PLAYER.standH;
    const dist = Math.hypot(this.vel.x, this.vel.z) * dt;
    const steps = Math.max(1, Math.ceil(dist / 0.1));
    const before = this.pos.clone();
    for (let i = 0; i < steps; i++) {
      const prev = this.pos.clone();
      this.pos.x += (this.vel.x * dt) / steps;
      this.pos.z += (this.vel.z * dt) / steps;
      W.col.resolveCircle(this.pos, PLAYER.radius, this.pos.y, h, 0.3, prev);
    }
    // vertical: snap to ground / fall
    const g = W.col.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.45);
    if (g.y === -Infinity) {
      // no floor here: refuse the move (prevents leaving the world)
      this.pos.x = before.x; this.pos.z = before.z;
    } else {
      this.surface = g.surface;
      if (this.pos.y - g.y > 0.5) {
        this.vy -= PLAYER.gravity * dt;
        this.pos.y = Math.max(g.y, this.pos.y + this.vy * dt);
        if (this.pos.y === g.y) this.vy = 0;
      } else {
        this.pos.y = g.y; this.vy = 0;
      }
    }

    // footsteps + noise
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    this.moving = moved > 0.001;
    this.stepDist += moved;
    const stride = this.sprinting ? 0.78 : this.crouching ? 0.5 : 0.62;
    if (this.stepDist > stride) {
      this.stepDist = 0;
      const loud = this.sprinting ? 1.4 : this.crouching ? 0.35 : 0.8;
      W.audio?.footstep(this.surface, loud);
      W.noise?.(this.pos, this.sprinting ? 9 : this.crouching ? 1.5 : 4);
    }

    // flashlight toggle
    if (!this.frozen && input.was('flashlight')) {
      if (this.hasFlash) this.setFlash(!this.flashOn);
      else W.ui.toast("You don't have a light.", 2);
    }
    this.updateCamera(dt, moved / Math.max(dt, 1e-4));
  }

  updateCamera(dt, speed = 0) {
    const targetEye = this.crouching ? PLAYER.eyeCrouch : PLAYER.eyeStand;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 10);
    this.bob += dt * speed * 2.4;
    const bobY = speed > 0.3 ? Math.sin(this.bob) * 0.03 * Math.min(1, speed / 3) : 0;
    this.cam.position.set(this.pos.x, this.pos.y + this.eye + bobY, this.pos.z);
    this.cam.rotation.order = 'YXZ';
    this.cam.rotation.y = this.yaw + this.lookBack * Math.PI;
    this.cam.rotation.x = this.pitch * (1 - this.lookBack * 0.8);
    this.cam.rotation.z = 0;
  }

  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
}
