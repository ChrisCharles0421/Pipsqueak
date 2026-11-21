// Game state, progression, zones, items/clues placement, checkpoints and the ending sequence.
import * as THREE from 'three';
import { CollisionWorld } from './systems/collision.js';
import { Interactions, Inventory } from './systems/interact.js';
import { Player } from './systems/player.js';
import { Audio } from './systems/audio.js';
import { UI } from './systems/ui.js';
import { Director } from './systems/director.js';
import { Chase } from './systems/chase.js';
import { buildHouse, ROOMS, STAIR } from './world/house.js';
import { buildBasement, BASEMENT } from './world/basement.js';
import { buildExterior } from './world/exterior.js';
import { buildSewer, updateSewer, SEWER } from './world/sewer.js';
import { px, pz, mats } from './world/builder.js';
import { P, place } from './world/props.js';
import { OBJECTIVES, ITEMS, CLUES, ENDING } from './data/story.js';

const ZONE_LOOK = {
  basement: { fog: 0x040506, density: 0.085, hemi: 0.08, flash: [9, 10] },
  house: { fog: 0x060504, density: 0.06, hemi: 0.07, flash: [9, 11] },
  exterior: { fog: 0x0a0d13, density: 0.045, hemi: 0.16, flash: [10, 14] },
  sewer: { fog: 0x000000, density: 0.06, hemi: 0.0, flash: [6, 3.6] }, // ~2-3 m of usable light
};

export class Game {
  constructor(renderer, debug = false) {
    this.renderer = renderer;
    this.debug = debug;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 140);
    scene.add(camera);
    this.scene = scene; this.camera = camera;
    scene.fog = new THREE.FogExp2(0x040506, 0.085);
    scene.background = new THREE.Color(0x040506);
    this.hemi = new THREE.HemisphereLight(0x8090a8, 0x201810, 0.05);
    scene.add(this.hemi);

    this.ui = new UI();
    this.audio = new Audio();
    this.inventory = new Inventory(ITEMS);
    this.clues = [];
    this.listeners = {};
    const W = this.W = {
      scene, camera, col: new CollisionWorld(), interact: new Interactions(),
      doors: [], lights: [], ceilings: [], spots: {}, doorsByName: {},
      ui: this.ui, audio: this.audio, inventory: this.inventory,
      events: { emit: (n, a) => this.emit(n, a) },
      noise: (pos, radius) => { this.lastNoise = { pos: pos.clone?.() || pos, radius, t: performance.now() }; },
    };

    buildHouse(W);
    buildBasement(W);
    buildExterior(W);
    buildSewer(W);

    this.player = new Player(W, camera);
    this.director = new Director(W, this);
    this.chase = new Chase(W, this);
    this.placeItems();
    this.wireEvents();

    this.state = 'title';
    this.zone = 'basement';
    this.room = null;
    this.flags = {};
    this.look = { ...ZONE_LOOK.basement };
    this.checkpoint = { x: 5.6, y: BASEMENT.y, z: -3.2, yaw: -2.3 };
    this.player.spawn(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z, this.checkpoint.yaw);
    this.tvOn = false;
  }

  // ---------------- events ----------------
  on(n, f) { (this.listeners[n] ||= []).push(f); }
  emit(n, a) { (this.listeners[n] || []).forEach((f) => f(a)); }

  setObjective(key) {
    this.objective = key;
    this.ui.setObjective(OBJECTIVES[key] || key);
  }

  setCheckpoint(x, y, z, yaw) { this.checkpoint = { x, y, z, yaw }; }

  // ---------------- items & clues ----------------
  pickup(mesh, id, extra) {
    // generous invisible pick volume so small items are easy to target
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(mesh.position);
    mesh.parent.add(hit);
    const done = () => { hit.parent?.remove(hit); this.W.interact.remove(hit); };
    this.W.interact.add(hit, {
      prompt: () => `Take ${ITEMS[id].label}`,
      use: () => { done(); this.W.interact.items.find((i) => i.obj === mesh)?.use(); },
    });
    this.W.interact.add(mesh, {
      prompt: () => `Take ${ITEMS[id].label}`,
      use: () => {
        this.inventory.add(id);
        mesh.parent.remove(mesh);
        this.W.interact.remove(mesh);
        this.audio.pickup();
        this.ui.toast(ITEMS[id].desc);
        this.emit('got', id);
        extra?.();
      },
    });
  }

  clue(obj, id, label = 'Read') {
    this.W.interact.add(obj, {
      prompt: () => label,
      use: () => {
        const c = CLUES[id];
        if (!this.clues.find((x) => x.id === id)) this.clues.push({ id, ...c });
        this.audio.paper();
        this.ui.openReader(c.title, c.body);
        this.emit('clue', id);
      },
    });
  }

  placeItems() {
    const W = this.W, m = mats(), s = this.scene;
    const small = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); s.add(o); return o; };
    const paperAt = (x, y, z, id, ry = 0) => { const g = P.paper(); place(W, g, x, y, z, ry, false); this.clue(g.userData.hit, id); return g; };

    // Basement: flashlight on the workbench, key in the storage room, two clues
    const fl = small(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 10), m.metal, 5.15, BASEMENT.y + 0.95, -1.9);
    fl.rotation.z = Math.PI / 2;
    this.pickup(fl, 'flashlight', () => {
      this.player.hasFlash = true;
      this.player.setFlash(true);
      this.ui.hint('F: flashlight');
    });
    const key = small(new THREE.BoxGeometry(0.1, 0.03, 0.05), new THREE.MeshStandardMaterial({ color: 0xb08d3c, metalness: 0.8, roughness: 0.3 }), 15.0, BASEMENT.y + 1.13, 7.2);
    this.pickup(key, 'basementKey');
    paperAt(9.3, BASEMENT.y + 0.77, -0.45, 'basementNote', 0.3);
    this.clue(W.spots.tally, 'tally', 'Look');

    // Master closet dresser: key ring + revolver + ledger
    const dr = W.spots.closetDrawer;
    W.interact.add(dr, {
      prompt: () => (this.flags.drawer ? '' : 'Search the drawers'),
      enabled: () => !this.flags.drawer,
      use: () => {
        this.flags.drawer = true;
        this.inventory.add('garageKey');
        this.inventory.add('revolver');
        this.audio.noiseHit({ pos: dr.position, freq: 300, q: 1, dur: 0.3, gain: 0.3, type: 'lowpass' });
        const c = CLUES.ledger;
        this.clues.push({ id: 'ledger', ...c });
        this.ui.openReader('Bottom drawer',
          `Under folded shirts: a ring of keys, one marked with tape.\n\nWrapped in a cloth beneath them: a revolver. It is heavier than you expected. You do not know how to use it. You take it anyway.\n\n${c.title}:\n${c.body}`);
        this.emit('got', 'garageKey');
      },
    });

    // House clues
    paperAt(px(92), 0.92, pz(460), 'nursery', 1.2);
    paperAt(px(175), 0.77, pz(793), 'boysRoom', 0.4);
    paperAt(px(555), 0.77, pz(430), 'clipping', -0.5);
    // a cup on the kitchen table, still warm: someone was here recently
    small(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10), m.white, px(555) + 0.3, 0.81, pz(430) + 0.1);

    // Shed: crowbar + drainage plan
    const cb = small(new THREE.BoxGeometry(0.03, 0.03, 0.75), m.rust, 25.95, 0.94, -12.6);
    cb.rotation.y = 0.4;
    this.pickup(cb, 'crowbar');
    paperAt(26.0, 0.93, -13.3, 'shed', 0.2);
  }

  wireEvents() {
    this.on('got', (id) => {
      if (id === 'flashlight' && this.objective === 'wake') this.ui.toast('The beam is weak, but it works.');
      if (id === 'garageKey') this.setObjective('Try the keys. The garage has a side door.');
      if (id === 'crowbar') this.setObjective(this.flags.grateFound ? 'enter' : 'outside');
    });
    this.on('doorUnlocked', (d) => {
      if (d === this.W.doorsByName.basement) {
        this.setObjective('explore');
        this.setCheckpoint(px(460), 0, pz(345), Math.PI);
      }
      if (d === this.W.doorsByName.garageSide) {
        this.setObjective('outside');
        this.setCheckpoint(px(657) + 1.2, 0, pz(718), -Math.PI / 2);
      }
    });
    this.on('lockedDoor', (d) => {
      if ((d === this.W.doorsByName.front || d === this.W.doorsByName.garageSide) && !this.inventory.has('garageKey')) this.setObjective('locked');
    });
    this.on('grateFound', () => { this.flags.grateFound = true; if (!this.inventory.has('crowbar')) this.setObjective('culvert'); });
    this.on('grateOpened', () => this.setObjective('enter'));
  }

  // ---------------- zones ----------------
  computeZone() {
    const p = this.player.pos;
    let zone, room = null;
    if (p.z < -20.3 && p.y < 0.5) zone = 'sewer';
    else if (p.y < -0.8 && p.x > BASEMENT.x0 - 0.5 && p.x < BASEMENT.x1 + 0.5 && p.z > BASEMENT.z0 - 0.5 && p.z < BASEMENT.z1 + 0.5) zone = 'basement';
    else {
      for (const [name, r] of Object.entries(ROOMS)) {
        if (p.x >= px(r[0]) && p.x <= px(r[2]) && p.z >= pz(r[1]) && p.z <= pz(r[3])) { room = name.replace(/ \(.*\)/, ''); break; }
      }
      if (!room && p.x > STAIR.x0 && p.x < STAIR.x1 && p.z > STAIR.zBottom && p.z < STAIR.zDoor) room = 'Stairs';
      zone = room ? 'house' : 'exterior';
    }
    if (zone !== this.zone) {
      this.zone = zone;
      this.audio.setZone(zone);
      const L = ZONE_LOOK[zone];
      this.player.flashProfile = { intensity: L.flash[0], distance: L.flash[1] };
      if (this.player.flashOn) this.player.setFlash(true);
      if (zone === 'sewer' && !this.flags.sewerCheckpoint) {
        this.flags.sewerCheckpoint = true;
        this.setCheckpoint(SEWER.x, SEWER.floorY, -26.6, 0);
      }
    }
    this.room = room;
  }

  // ---------------- chase outcomes ----------------
  caught() {
    const pl = this.player;
    pl.frozen = true;
    this.audio.grab();
    this.ui.fade(1, 0.25);
    this.ui.hint('');
    setTimeout(() => {
      this.state = 'dead';
      this.ui.show('death', true);
      this.audio.setBreath(this.chase.pos, 0);
      this.input?.unlock();
    }, 700);
  }

  retry() {
    this.ui.show('death', false);
    this.chase.reset();
    const c = this.checkpoint;
    this.player.spawn(c.x, c.y, c.z, c.yaw);
    this.player.frozen = false;
    this.player.lookBack = 0;
    this.ui.fade(0, 0.8);
    this.state = 'play';
    if (this.zone === 'sewer') this.setObjective('enter');
  }

  beginConfrontation() {
    const pl = this.player;
    pl.frozen = true;
    pl.vel.set(0, 0, 0);
    this.ui.hint('');
    this.ui.toast('');
    this.turning = { from: pl.yaw, to: pl.yaw + Math.PI, t: 0 };
    this.audio.sting(0.1);
  }

  finalBlackout() {
    if (this.state === 'ending') return;
    this.state = 'ending';
    this.ui.fade(1, 0);           // cut to black immediately
    this.ui.el.hud.style.display = 'none';
    this.audio.stopAll();
    this.chase.fig.visible = false;
    const shots = [1400, 2250, 2950];
    shots.forEach((t) => setTimeout(() => this.audio.gunshot(), t));
    this.shotsFired = 0;
    shots.forEach((t) => setTimeout(() => { this.shotsFired++; }, t + 10));
    setTimeout(() => this.playEnding(), 6500);
  }

  async playEnding() {
    this.input?.unlock();
    const ui = this.ui;
    ui.show('ending', true);
    const el = ui.el.endingText;
    for (const card of ENDING) {
      el.textContent = card.text;
      el.classList.add('show');
      await wait(card.hold * 1000);
      el.classList.remove('show');
      await wait(1600);
    }
    el.textContent = 'THE HOUSE IS WATCHING';
    el.classList.add('show');
    ui.el.again.classList.remove('hidden');
    this.endingDone = true;
  }

  // ---------------- per-frame ----------------
  update(dt, input) {
    this.input = input;
    if (this.state !== 'play') return;
    const W = this.W, pl = this.player;

    if (this.ui.readerOpen) {
      if (input.was('interact') || input.was('journal')) this.ui.closeReader();
      pl.frozen = true;
    } else if (this.ui.journalOpen) {
      if (input.was('journal')) this.ui.toggleJournal([], []);
      pl.frozen = true;
    } else if (!this.turning && this.chase.state !== 'confront' && this.chase.state !== 'caught') {
      pl.frozen = false;
      if (input.was('journal')) this.ui.toggleJournal(this.inventory.list(), this.clues);
    }

    pl.update(dt, input);

    // scripted turn to face the pursuer
    if (this.turning) {
      const tr = this.turning;
      tr.t = Math.min(1, tr.t + dt / 1.1);
      const e = tr.t * tr.t * (3 - 2 * tr.t);
      pl.yaw = tr.from + (tr.to - tr.from) * e;
      pl.pitch *= 0.9;
      pl.lookBack = 0;
      pl.updateCamera(dt);
      if (tr.t >= 1) this.turning = null;
    }

    // interaction
    const it = pl.frozen ? null : W.interact.update(this.camera, W.col);
    const label = it ? it.prompt() : '';
    this.ui.setPrompt(label);
    if (it && label && input.was('interact') && !this.ui.readerOpen) it.use();

    for (const d of W.doors) d.update(dt);
    updateSewer(W, dt);
    this.computeZone();
    this.updateLook(dt);
    this.director.update(dt);
    this.chase.update(dt);
    this.flicker(dt);
    this.audio.setListener(this.camera);
    this.audio.update(dt);
    this.ui.update(dt);
  }

  updateLook(dt) {
    const L = ZONE_LOOK[this.zone];
    const k = Math.min(1, dt * 1.5);
    this.scene.fog.density += (L.density - this.scene.fog.density) * k;
    this.scene.fog.color.lerp(new THREE.Color(L.fog), k);
    this.scene.background.copy(this.scene.fog.color);
    this.hemi.intensity += (L.hemi - this.hemi.intensity) * k;
  }

  flicker(dt) {
    for (const l of this.W.lights) {
      const f = l.userData.flicker;
      if (!f || this.director.flickerLight === l && this.director.flickerBurst > 0) continue;
      if (Math.random() < f * dt * 1.5) l.userData.dip = 0.05 + Math.random() * 0.15;
      if (l.userData.dip > 0) { l.userData.dip -= dt; l.intensity = l.userData.base * (Math.random() * 0.3); }
      else l.intensity = l.userData.base;
    }
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
