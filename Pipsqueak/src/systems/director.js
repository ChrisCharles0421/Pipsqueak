// Horror event director: rare, one-shot atmospheric incidents. Ambiguous, never confirmed
// supernatural. Separate from the chase so silhouettes do not require the real occupant to path there.
import * as THREE from 'three';
import { px, pz } from '../world/builder.js';
import { makeFigure } from '../world/figure.js';

export class Director {
  constructor(W, game) {
    this.W = W;
    this.game = game;
    this.cooldown = 25;
    this.done = new Set();
    this.t = 0;
    this.fig = makeFigure();
    this.fig.visible = false;
    W.scene.add(this.fig);
    this.figTimer = 0;
    this.figWatch = 0;
    this.figMode = null;
    this.flickerBurst = 0;
    this.flickerLight = null;
    this.zoneTime = {};
    this.visited = new Set();
  }

  looking(target, maxAngle = 0.35) {
    const cam = this.W.camera;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    const to = target.clone().sub(cam.position).normalize();
    return dir.angleTo(to) < maxAngle;
  }

  visible(target) {
    const cam = this.W.camera;
    const to = target.clone().sub(cam.position);
    const d = to.length();
    to.normalize();
    return this.W.col.rayBlockDistance(cam.position, to, d, null, (b) => b.tag !== 'prop' && b.tag !== 'tree') >= d - 0.1;
  }

  fire(name, fn) {
    if (this.done.has(name) || this.cooldown > 0) return false;
    this.done.add(name);
    this.cooldown = 35 + Math.random() * 20;
    fn();
    return true;
  }

  showFigure(x, y, z, faceYaw, mode) {
    this.fig.position.set(x, y, z);
    this.fig.rotation.y = faceYaw;
    this.fig.visible = true;
    this.figTimer = 6;
    this.figWatch = 0;
    this.figMode = mode;
  }

  update(dt) {
    const W = this.W, g = this.game, p = g.player.pos;
    this.t += dt;
    this.cooldown -= dt;
    const zone = g.zone, room = g.room;
    if (room) this.visited.add(room);

    // figure lifetime: vanishes once watched briefly, when approached, or after a timeout
    if (this.fig.visible) {
      this.figTimer -= dt;
      const head = this.fig.position.clone().add(new THREE.Vector3(0, 1.6, 0));
      if (this.looking(head, 0.5) && (this.figMode === 'window' || this.visible(head))) this.figWatch += dt;
      const near = this.fig.position.distanceTo(p) < 5;
      if (this.figWatch > 0.7 || near || this.figTimer <= 0) {
        this.fig.visible = false;
        if (this.figWatch > 0.7) W.audio?.creak(this.fig.position, 0.05);
        if (this.flickerLight) this.flickerBurst = 0.5;
      }
    }

    // flicker bursts
    if (this.flickerBurst > 0 && this.flickerLight) {
      this.flickerBurst -= dt;
      const l = this.flickerLight;
      l.intensity = Math.random() < 0.5 ? 0 : l.userData.base * Math.random();
      if (this.flickerBurst <= 0) l.intensity = l.userData.base;
    }

    // --- basement: footsteps crossing the floor above ---
    if (zone === 'basement' && this.t > 35) {
      this.fire('stepsAbove', () => W.audio?.distantSteps(new THREE.Vector3(9, 0.3, 4), 7, 600));
    }

    if (zone === 'house') {
      // figure at the far end of the foyer, seen from the living-room side
      if ((room === 'Living Room' || room === 'Stair Hall') && this.visited.size > 1) {
        const spot = new THREE.Vector3(px(290), 0, pz(655));
        if (this.looking(spot.clone().setY(1.2), 0.45) && this.visible(spot.clone().setY(1.6)) && spot.distanceTo(p) > 9) {
          this.fire('hallFigure', () => {
            this.showFigure(spot.x, 0, spot.z, Math.PI, 'hall');
            this.flickerLight = W.houseLights.foyer;
          });
        }
      }
      // dining light stutters
      if (room === 'Dining Room') {
        this.fire('diningFlicker', () => { this.flickerLight = W.houseLights.dining; this.flickerBurst = 2.2; W.audio?.noiseHit({ pos: W.houseLights.dining.position, freq: 120, q: 8, dur: 1.8, gain: 0.08 }); });
      }
      // the TV is on when you come back
      if ((room === 'Kitchen' || room === 'Garage') && this.visited.has('Living Room')) {
        this.fire('tvOn', () => { g.tvOn = true; });
      }
      // nursery door has changed state after you left
      const nd = W.doorsByName.nursery;
      if (this.visited.has('Nursery') && room !== 'Nursery' && room !== 'Foyer' && nd) {
        const pos = nd.leaf.getWorldPosition(new THREE.Vector3());
        if (pos.distanceTo(p) > 8 && !this.looking(pos, 1.0)) {
          this.fire('nurseryDoor', () => { nd.setOpen(!nd.open, { silent: true, by: 'director' }); W.audio?.creak(pos, 0.03); });
        }
      }
      // footsteps beyond a wall
      if (room === 'Kitchen' && this.done.has('tvOn')) {
        this.fire('kitchenSteps', () => W.audio?.distantSteps(new THREE.Vector3(px(520), 0.3, pz(640)), 4, 700));
      }
    }

    if (zone === 'exterior') {
      // a figure behind a rear window of the house
      if (p.z < -4) {
        const spot = new THREE.Vector3(px(362), 0, pz(175));
        if (this.looking(spot.clone().setY(1.5), 0.4) && spot.distanceTo(p) > 7) {
          this.fire('windowFigure', () => this.showFigure(spot.x, 0, spot.z, Math.PI, 'window'));
        }
      }
      if (p.x > 18 && this.t > 5) {
        this.fire('branch', () => {
          const back = g.player.forward().multiplyScalar(-6).add(p);
          W.audio?.branch(back);
        });
      }
    }

    // TV static glow
    const scr = W.spots.tv?.userData?.screen;
    if (scr && g.tvOn) {
      const v = 0.25 + Math.random() * 0.25;
      scr.material.color.setRGB(v * 0.8, v * 0.9, v);
    }
  }
}
