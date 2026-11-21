// Game state, progression, zones, items/clues placement, hiding, checkpoints and the ending sequence.
import * as THREE from 'three';
import { CollisionWorld } from './systems/collision.js';
import { Interactions, Inventory } from './systems/interact.js';
import { Player } from './systems/player.js';
import { Audio } from './systems/audio.js';
import { UI } from './systems/ui.js';
import { Director } from './systems/director.js';
import { Chase } from './systems/chase.js';
import { NavGrid } from './systems/nav.js';
import { Antagonist } from './systems/antagonist.js';
import { buildHouse, ROOMS, STAIR } from './world/house.js';
import { buildBasement, BASEMENT } from './world/basement.js';
import { buildExterior } from './world/exterior.js';
import { buildSewer, updateSewer, SEWER } from './world/sewer.js';
import { px, pz, mats } from './world/builder.js';
import { P, place } from './world/props.js';
import { mapTexture, drawMap, paperTexture } from './world/evidence.js';
import { animateFigure } from './world/figure.js';
import { ViewModel } from './systems/viewmodel.js';
import { OBJECTIVES, ITEMS, CLUES, ENDING } from './data/story.js';
import { CREAKY_BOARDS_PX, CREAK, SPAWN_PX } from './data/antagonist.js';

const ZONE_LOOK = {
  basementLit: { fog: 0x0a0c0e, density: 0.035, hemi: 0.3, flash: [9, 10] },
  basement: { fog: 0x040506, density: 0.08, hemi: 0.045, flash: [9, 10] },
  house: { fog: 0x060504, density: 0.06, hemi: 0.07, flash: [9, 11] },
  exterior: { fog: 0x0a0d13, density: 0.045, hemi: 0.16, flash: [10, 14] },
  sewer: { fog: 0x000000, density: 0.06, hemi: 0.0, flash: [6, 3.6] }, // ~2-3 m of usable light
};

export class Game {
  constructor(renderer, debug = false) {
    this.renderer = renderer;
    this.debug = debug;
    this.time = 0;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 140);
    scene.add(camera);
    this.scene = scene; this.camera = camera;
    scene.fog = new THREE.FogExp2(0x0a0c0e, 0.035);
    scene.background = new THREE.Color(0x0a0c0e);
    this.hemi = new THREE.HemisphereLight(0x8090a8, 0x2a2018, 0.3);
    scene.add(this.hemi);

    this.ui = new UI();
    this.audio = new Audio();
    this.inventory = new Inventory(ITEMS);
    this.clues = [];
    this.listeners = {};
    this.flags = {};
    const W = this.W = {
      scene, camera, col: new CollisionWorld(), interact: new Interactions(),
      doors: [], lights: [], ceilings: [], spots: {}, doorsByName: {}, bodies: [],
      ui: this.ui, audio: this.audio, inventory: this.inventory,
      events: { emit: (n, a) => this.emit(n, a) },
      noise: (pos, radius, kind) => this.noise(pos, radius, kind),
    };

    buildHouse(W);
    buildBasement(W);
    buildExterior(W);
    buildSewer(W);

    this.player = new Player(W, camera);
    this.viewModel = new ViewModel(this.player);
    W.bodies.push({ pos: this.player.pos, radius: 0.27, height: 1.45 });

    const t0 = performance.now();
    this.nav = new NavGrid(W.col, W.doors, {
      x0: -10, x1: 30.5, z0: -20, z1: 34.5, cell: 0.2, radius: 0.27,
      layers: [
        { probeY: 0, step: 0.45, minY: -3.2, maxY: 0.5 },   // ground floor, stairs, grounds
        { probeY: -2.9, step: 0.2, minY: -3.2, maxY: -2.6 }, // basement
      ],
    });
    this.navBuildMs = performance.now() - t0;
    this.ai = new Antagonist(W, this, this.nav);
    this.director = new Director(W, this);
    this.chase = new Chase(W, this);
    this.setupHiding();
    this.setupCreakyBoards();
    W.stepHook = (pos, mode) => this.floorCreak(pos, 'player', mode);
    this.placeItems();
    this.wireEvents();

    this.state = 'title';
    this.zone = 'basement';
    this.room = null;
    this.checkpoint = { x: 5.6, y: BASEMENT.y, z: -3.2, yaw: -2.3 };
    this.player.spawn(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z, this.checkpoint.yaw);
    this.tvOn = false;
    this.hiding = null;
  }

  // ---------------- events ----------------
  on(n, f) { (this.listeners[n] ||= []).push(f); }
  emit(n, a) { (this.listeners[n] || []).forEach((f) => f(a)); }

  setObjective(key) {
    this.objective = key;
    this.ui.setObjective(OBJECTIVES[key] || key);
  }

  setCheckpoint(x, y, z, yaw) { this.checkpoint = { x, y, z, yaw }; }

  // every gameplay noise goes through here so the occupant can hear it
  noise(pos, radius, kind = 'noise') {
    const p = pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z);
    this.lastNoise = { pos: p, radius, kind, t: this.time };
    if (!this.hiding) this.ai?.hear(p, radius, kind);
  }

  // ---------------- items & clues ----------------
  pickup(mesh, id, extra) {
    // generous invisible pick volume so small items are easy to target
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(mesh.position);
    mesh.parent.add(hit);
    let taken = false;
    const take = () => {
      if (taken) return; // never collectible twice
      taken = true;
      this.inventory.add(id);
      mesh.parent?.remove(mesh); hit.parent?.remove(hit);
      this.W.interact.remove(mesh); this.W.interact.remove(hit);
      this.audio.pickup();
      this.ui.toast(ITEMS[id].desc);
      this.emit('got', id);
      extra?.();
    };
    for (const o of [hit, mesh]) this.W.interact.add(o, { prompt: () => `Take ${ITEMS[id].label}`, use: take, enabled: () => !taken });
  }

  readClue(id) {
    const c = CLUES[id];
    if (!this.clues.find((x) => x.id === id)) this.clues.push({ id, ...c });
    this.audio.paper();
    this.ui.openReader(c.title, c.body, c.image === 'map' ? drawMap().toDataURL() : null);
    this.emit('clue', id);
  }

  clue(obj, id, label = 'Read') {
    this.W.interact.add(obj, { prompt: () => label, use: () => this.readClue(id) });
  }

  hitBox(x, y, z, sx, sy, sz) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ visible: false }));
    h.position.set(x, y, z);
    this.scene.add(h);
    return h;
  }

  placeItems() {
    const W = this.W, m = mats(), s = this.scene, B = BASEMENT;
    const small = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); s.add(o); return o; };
    const paperAt = (x, y, z, id, ry = 0) => { const g = P.paper(); place(W, g, x, y, z, ry, false); this.clue(g.userData.hit, id); return g; };

    // ---- basement: flashlight on the lit table, under the tube ----
    const fl = small(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 10), m.metal, 9.2, B.y + 0.8, -0.45);
    fl.rotation.z = Math.PI / 2; fl.rotation.y = 0.4;
    const flHead = small(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), m.metal, 9.09, B.y + 0.8, -0.5);
    flHead.rotation.z = Math.PI / 2;
    this.pickup(fl, 'flashlight', () => {
      s.remove(flHead);
      this.player.hasFlash = true;
      this.player.setFlash(true);
      this.ui.hint('F: flashlight');
      this.scheduleTubeFailure();
    });

    // ---- basement key: inside the red toolbox in the store room ----
    const tb = W.spots.toolbox;
    const tbHit = this.hitBox(tb.position.x, tb.position.y + 0.15, tb.position.z, 0.6, 0.4, 0.4);
    W.interact.add(tbHit, {
      prompt: () => (this.flags.toolboxOpen ? '' : 'Open the toolbox'),
      enabled: () => !this.flags.toolboxOpen,
      use: () => {
        this.flags.toolboxOpen = true;
        W.spots.toolboxLid.rotation.x = -1.2; W.spots.toolboxLid.position.set(0, 0.32, -0.12);
        this.audio.noiseHit({ pos: tb.position, freq: 1800, q: 2, dur: 0.15, gain: 0.2 });
        const key = small(new THREE.BoxGeometry(0.1, 0.02, 0.04), new THREE.MeshStandardMaterial({ color: 0xb08d3c, metalness: 0.8, roughness: 0.3 }), tb.position.x, tb.position.y + 0.25, tb.position.z);
        this.pickup(key, 'basementKey');
        this.ui.toast('Under a tray of screws: a brass key on a paper tag.');
      },
    });

    // ---- basement clues ----
    this.clue(W.spots.tally, 'tally', 'Look');
    this.clue(this.hitBox(5.2, B.y + 0.95, -1.2, 0.35, 0.12, 0.4), 'clipboard');
    const cage = W.spots.cage;
    this.clue(this.hitBox(cage.position.x, B.y + 0.7, cage.position.z, 1.6, 1.4, 1.3), 'cage', 'Look');
    this.clue(this.hitBox(15.35, B.y + 0.97, -1.35, 0.35, 0.12, 0.3), 'cleaver', 'Inspect');
    this.clue(this.hitBox(15.5, B.y + 0.95, -0.6, 0.3, 0.12, 0.35), 'diary');
    this.clue(this.hitBox(6.55, B.y + 1.55, B.z0 + 0.12, 1.5, 1.0, 0.12), 'corkboard', 'Look');

    // ---- master closet dresser: key ring + revolver + ledger ----
    const dr = W.spots.closetDrawer;
    W.interact.add(dr, {
      prompt: () => (this.flags.drawer ? '' : 'Search the drawers'),
      enabled: () => !this.flags.drawer,
      use: () => {
        this.flags.drawer = true;
        this.inventory.add('garageKey');
        this.inventory.add('revolver');
        this.noise(dr.position, 4, 'drawer');
        this.audio.noiseHit({ pos: dr.position, freq: 300, q: 1, dur: 0.3, gain: 0.3, type: 'lowpass' });
        const c = CLUES.ledger;
        this.clues.push({ id: 'ledger', ...c });
        this.ui.openReader('Bottom drawer',
          `Under folded shirts: a ring of keys, one marked with tape.\n\nWrapped in a cloth beneath them: a revolver. It is heavier than you expected. You do not know how to use it. You take it anyway.\n\n${c.title}:\n${c.body}`);
        this.emit('got', 'garageKey');
      },
    });

    // ---- house clues ----
    paperAt(px(92), 0.92, pz(460), 'nursery', 1.2);
    paperAt(px(175), 0.77, pz(793), 'boysRoom', 0.4);
    paperAt(px(555), 0.77, pz(430), 'clipping', -0.5);
    paperAt(px(98), 0.62, pz(222), 'caseFile', 0.3);
    small(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10), m.white, px(555) + 0.3, 0.81, pz(430) + 0.1);
    // the map, pinned on the garage wall
    const mw = W.spots.garageMapWall;
    const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.9), new THREE.MeshLambertMaterial({ map: mapTexture() }));
    mapMesh.position.set(mw.x, mw.y, mw.z); mapMesh.rotation.y = -Math.PI / 2;
    s.add(mapMesh);
    for (const [dx, dy] of [[-0.58, 0.4], [0.58, 0.4], [-0.58, -0.4], [0.58, -0.4]]) small(new THREE.SphereGeometry(0.015, 6, 4), m.toyRed, mw.x - 0.01, mw.y + dy, mw.z + dx);
    this.clue(this.hitBox(mw.x, mw.y, mw.z, 0.1, 0.9, 1.25), 'map', 'Look at the map');

    // ---- shed: crowbar + drainage plan ----
    const cb = small(new THREE.BoxGeometry(0.03, 0.03, 0.75), m.rust, 25.95, 0.94, -12.6);
    cb.rotation.y = 0.4;
    this.pickup(cb, 'crowbar');
    paperAt(26.0, 0.93, -13.3, 'shed', 0.2);
  }

  // ---------------- loose floorboards ----------------
  setupCreakyBoards() {
    const worn = new THREE.MeshLambertMaterial({ map: mats().wood.map, color: 0x9a8670, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.boards = CREAKY_BOARDS_PX.map(([room, x0, y0, x1, y1]) => {
      const b = { room, x0: px(x0), z0: pz(y0), x1: px(x1), z1: pz(y1), t: -9 };
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b.x1 - b.x0, b.z1 - b.z0), worn);
      m.rotation.x = -Math.PI / 2; m.position.set((b.x0 + b.x1) / 2, 0.004, (b.z0 + b.z1) / 2);
      this.scene.add(m);
      return b;
    });
  }

  // Called on every footstep (player and occupant). Returns true if a board creaked.
  floorCreak(pos, who, mode = 'walk') {
    if (pos.y < -0.5 || pos.y > 0.5) return false;
    const b = this.boards?.find((q) => pos.x > q.x0 && pos.x < q.x1 && pos.z > q.z0 && pos.z < q.z1);
    if (!b || this.time - b.t < CREAK.cooldown) return false;
    if (who === 'player' && mode === 'crouch' && Math.random() > CREAK.crouchChance) return false;
    b.t = this.time;
    const p = { x: pos.x + (Math.random() - 0.5) * 0.3, y: 0.05, z: pos.z + (Math.random() - 0.5) * 0.3 };
    this.audio.creak(p, who === 'occupant' ? 0.06 : mode === 'crouch' ? 0.035 : 0.055, { key: 'floorboard' });
    if (who === 'player') this.noise(new THREE.Vector3(pos.x, pos.y, pos.z), CREAK.noiseRadius[mode] ?? 8, 'creak');
    this.emit('creak', { who, board: b.room });
    return true;
  }

  // ---------------- basement tube light ----------------
  scheduleTubeFailure() {
    if (this.flags.tubeScheduled) return;
    this.flags.tubeScheduled = true;
    this.tube = { t: -4.0, phase: 'wait' }; // starts flickering 4 s after the flashlight is taken
  }

  updateTube(dt) {
    const T = this.tube, tube = this.W.basementTube;
    if (!T || T.phase === 'dead') return;
    T.t += dt;
    if (T.phase === 'wait' && T.t >= 0) { T.phase = 'flicker'; T.t = 0; this.audio.buzz?.(tube.mesh.position, 3.2); }
    if (T.phase === 'flicker') {
      const on = Math.random() < (T.t < 1.5 ? 0.75 : 0.35);
      tube.light.intensity = on ? tube.light.userData.base * (0.4 + Math.random() * 0.6) : 0;
      tube.mat.color.setHex(on ? 0xe8f0ff : 0x2a2c30);
      if (T.t > 3.2) {
        T.phase = 'dead';
        tube.light.intensity = 0;
        tube.light.userData.base = 0;
        tube.mat.color.setHex(0x1c1d20);           // tube no longer glows
        this.flags.tubeBroken = true;
        this.audio.pop?.(tube.mesh.position);
        this.noise(tube.mesh.position, 8, 'glass');
        this.ui.toast('The light dies. Use the flashlight. [F]', 4);
        if (!this.player.equipped) this.ui.hint('F: flashlight');
      }
    }
  }

  // ---------------- hiding (cupboards + under tables) ----------------
  // Hidden = safe: the occupant cannot see, hear or catch the child while hidden (see Antagonist).
  setupHiding() {
    const W = this.W;
    const spots = [];
    for (const h of W.spots.hide || []) {
      const g = h.group, ry = g.rotation.y;
      const fwd = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
      const front = g.position.clone().addScaledVector(fwd, 0.85);
      spots.push({
        type: 'cupboard', name: h.name, group: g, pos: g.position.clone(), front, exits: [front],
        eyeY: 1.2, faceYaw: Math.atan2(-fwd.x, -fwd.z), lookRange: 0.5, prompt: 'Hide in the cupboard',
      });
    }
    this.rejectedTables = [];
    for (const t of W.spots.tables || []) {
      const spot = this.tableSpot(t);
      if (spot) spots.push(spot); else this.rejectedTables.push(t.name);
    }
    this.hidingSpots = spots;
    for (const sp of spots) W.interact.add(sp.group, { prompt: () => sp.prompt, use: () => this.hide(sp), enabled: () => !this.hiding });
  }

  // A table is a valid hiding place only if it is tall and big enough, nothing else occupies the space
  // underneath, and the child can get in/out from at least one side.
  tableSpot(t) {
    const W = this.W, g = t.group;
    if (t.h < 0.68 || Math.min(t.w, t.l) < 0.55 || Math.max(t.w, t.l) < 0.9) return null;
    const ry = g.rotation.y, c = g.position;
    const ax = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry)), az = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    const own = g.userData.col;
    // underneath must be clear of every other obstacle
    const under = { x: c.x, z: c.z };
    const halfMin = Math.min(t.w, t.l) / 2 - 0.08;
    for (const b of W.col.boxes) {
      if (!b.enabled || b === own || b.max.y <= c.y + 0.05 || b.min.y >= c.y + t.h - 0.1) continue;
      const cx = Math.max(b.min.x, Math.min(under.x, b.max.x)), cz = Math.max(b.min.z, Math.min(under.z, b.max.z));
      if (Math.hypot(under.x - cx, under.z - cz) < halfMin) return null;
    }
    // exits: just outside each side, where a standing child fits
    const exits = [];
    for (const [dir, half] of [[ax, t.w / 2], [ax.clone().negate(), t.w / 2], [az, t.l / 2], [az.clone().negate(), t.l / 2]]) {
      const p = c.clone().addScaledVector(dir, half + 0.4); p.y = c.y;
      const q = p.clone();
      W.col.resolveCircle(q, 0.27, p.y, 1.45);
      const ground = W.col.groundAt(q.x, q.z, p.y + 0.1);
      if (q.distanceTo(p) < 0.05 && Math.abs(ground.y - c.y) < 0.2) exits.push(p);
    }
    if (!exits.length) return null;
    return {
      type: 'table', name: t.name, group: g, pos: c.clone(), front: exits[0], exits,
      eyeY: 0.42, faceYaw: null, lookRange: 1.3, prompt: 'Hide under the table',
    };
  }

  hide(spot) {
    if (this.hiding || this.state !== 'play') return;
    const pl = this.player;
    const from = { pos: this.camera.position.clone(), yaw: pl.yaw, pitch: pl.pitch };
    // look out from under a table towards where the child came from
    const yaw = spot.faceYaw ?? Math.atan2(-(from.pos.x - spot.pos.x), -(from.pos.z - spot.pos.z)) + Math.PI;
    this.hiding = { spot, phase: 'enter', t: 0, from, baseYaw: yaw, look: 0, pitch: 0, entry: pl.pos.clone() };
    this.hideStartT = this.time;
    pl.frozen = true; pl.vel.set(0, 0, 0); pl.crouching = false;
    if (spot.type === 'cupboard') this.audio.creak(spot.pos, 0.05, { len: 0.6, key: 'hideCreak' });
    this.noise(spot.pos, 2.5, 'hide');   // the act of getting in can be heard if he is very close
    this.ai.onChildHid(spot);
    this.ui.setPrompt('');
    this.emit('hid', spot);
  }

  unhide() {
    const h = this.hiding; if (!h || h.phase !== 'hidden') return;
    const sp = h.spot;
    // leave on the side nearest to where the child is looking (tables), else the cupboard front
    let exit = sp.exits[0];
    if (sp.type === 'table') {
      const look = h.baseYaw + h.look, dir = new THREE.Vector3(-Math.sin(look), 0, -Math.cos(look));
      exit = sp.exits.slice().sort((a, b) => b.clone().sub(sp.pos).normalize().dot(dir) - a.clone().sub(sp.pos).normalize().dot(dir))[0];
    }
    h.phase = 'exit'; h.t = 0; h.exit = exit;
    h.fromCam = this.camera.position.clone();
    if (sp.type === 'cupboard') this.audio.creak(sp.pos, 0.05, { len: 0.5, key: 'hideCreak' });
    this.ui.show('hidingOverlay', false);
    this.ui.hint('');
  }

  // smooth camera transitions in and out; low, limited look-around while hidden
  updateHiding(dt, input) {
    const h = this.hiding, pl = this.player, sp = h.spot, cam = this.camera;
    const ease = (t) => t * t * (3 - 2 * t);
    const hidePos = new THREE.Vector3(sp.pos.x, sp.pos.y + sp.eyeY, sp.pos.z);
    if (h.phase === 'enter') {
      h.t = Math.min(1, h.t + dt / 0.6);
      const e = ease(h.t);
      cam.position.lerpVectors(h.from.pos, hidePos, e);
      const dy = ((h.baseYaw - h.from.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      cam.rotation.set(h.from.pitch * (1 - e), h.from.yaw + dy * e, 0, 'YXZ');
      if (h.t >= 1) {
        h.phase = 'hidden';
        pl.pos.set(sp.pos.x, sp.pos.y, sp.pos.z);
        if (sp.type === 'cupboard') this.ui.show('hidingOverlay', true);
        this.ui.hint(sp.type === 'cupboard' ? 'Hiding in the cupboard. [E] to come out.' : 'Hiding under the table. [E] to come out.');
      }
      return;
    }
    if (h.phase === 'hidden') {
      h.look = Math.max(-sp.lookRange, Math.min(sp.lookRange, h.look - input.mouseDX * input.sensitivity));
      h.pitch = Math.max(-0.35, Math.min(sp.type === 'table' ? 0.12 : 0.4, h.pitch - input.mouseDY * input.sensitivity));
      cam.position.copy(hidePos);
      cam.rotation.set(h.pitch, h.baseYaw + h.look, 0, 'YXZ');
      if (input.was('interact') && this.time - this.hideStartT > 0.7) this.unhide();
      return;
    }
    if (h.phase === 'exit') {
      h.t = Math.min(1, h.t + dt / 0.5);
      const e = ease(h.t);
      const standPos = new THREE.Vector3(h.exit.x, h.exit.y + 1.33, h.exit.z);
      cam.position.lerpVectors(h.fromCam, standPos, e);
      if (h.t >= 1) {
        const yaw = h.baseYaw + h.look;
        pl.spawn(h.exit.x, h.exit.y, h.exit.z, yaw);
        pl.frozen = false;
        this.noise(sp.pos, 3, 'hide');
        this.hiding = null;
        this.emit('unhid', sp);
      }
    }
  }

  wireEvents() {
    this.on('got', (id) => {
      if (id === 'garageKey') this.setObjective('garage');
      if (id === 'crowbar') this.setObjective(this.flags.grateFound ? 'enter' : 'outside');
      if (id === 'basementKey' && this.flags.triedBasementDoor) this.ui.toast('A brass key. "BSMT". The locked door at the top of the stairs.');
    });
    this.on('clue', (id) => {
      if (id === 'clipboard' && this.objective === 'keyHunt') this.ui.toast('Spare keys: red toolbox, store room.', 3);
    });
    this.on('doorUnlocked', (d) => {
      if (d === this.W.doorsByName.basement) {
        this.setObjective('explore');
        this.setCheckpoint(px(460), 0, pz(345), Math.PI);
        // he comes home a little after the child gets out of the basement
        setTimeout(() => {
          this.audio.knock?.(new THREE.Vector3(px(600), 1, pz(720)));
          this.ai.activate(px(SPAWN_PX[0]), pz(SPAWN_PX[1]));
          this.ui.toast('A door slams somewhere in the house.', 3.5);
        }, 6000);
      }
      if (d === this.W.doorsByName.garageSide) {
        this.setObjective('outside');
        this.setCheckpoint(px(657) + 1.2, 0, pz(718), -Math.PI / 2);
      }
    });
    this.on('lockedDoor', (d) => {
      if (d === this.W.doorsByName.basement) {
        this.flags.triedBasementDoor = true;
        if (!this.inventory.has('basementKey')) this.setObjective('keyHunt');
      }
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
      const L = this.lookFor(zone);
      this.player.flashProfile = { intensity: L.flash[0], distance: L.flash[1] };
      if (zone === 'sewer' && !this.flags.sewerCheckpoint) {
        this.flags.sewerCheckpoint = true;
        this.setCheckpoint(SEWER.x, SEWER.floorY, -26.6, 0);
      }
    }
    this.room = room;
  }

  lookFor(zone) { return zone === 'basement' && !this.flags.tubeBroken ? ZONE_LOOK.basementLit : ZONE_LOOK[zone]; }

  // ---------------- failure / retry ----------------
  // Caught: dedicated capture state -> jumpscare with his real model -> game-over screen. Runs once.
  caught(text = 'He caught you.') {
    if (this.state !== 'play' || this.jump) return;
    if (this.hiding) return;                       // hidden children are never caught
    const pl = this.player;
    this.state = 'dying';
    pl.frozen = true; pl.vel.set(0, 0, 0); pl.lookBack = 0;
    this.ai.capture = true;
    this.ui.setPrompt(''); this.ui.hint(''); this.ui.toast('', 0.01);
    this.ui.el.deathText.textContent = text;
    const fig = this.ai.fig;
    fig.visible = true;
    // where he really is (the chase or the house AI), not where his model was last drawn
    const src = this.chase.state !== 'idle' ? this.chase.pos : this.ai.pos;
    // put him right in front of the camera, coming from the side he caught the child from
    const cam = this.camera.position.clone();
    const dir = new THREE.Vector3(src.x - cam.x, 0, src.z - cam.z);
    if (dir.lengthSq() < 0.01) dir.set(-Math.sin(pl.yaw), 0, -Math.cos(pl.yaw));
    dir.normalize();
    this.jump = { t: 0, dir, startYaw: pl.yaw, startPitch: pl.pitch, targetYaw: Math.atan2(-dir.x, -dir.z), feetY: pl.pos.y, shown: false };
    this.audio.grab();
    this.audio.setBreath(cam, 1.2, 2.2);
    pl.equipped = false;                           // the child drops the light: he is seen in silhouette
    this.ui.el.hud.style.visibility = 'hidden';
    this.input?.unlock();
  }

  updateJumpscare(dt) {
    const J = this.jump, cam = this.camera, fig = this.ai.fig, pl = this.player;
    J.t += dt;
    const t = J.t;
    const eye = new THREE.Vector3(pl.pos.x, pl.pos.y + pl.eye, pl.pos.z);
    // camera snaps round to him (0.12 s), then shakes
    const k = Math.min(1, t / 0.12);
    const dy = ((J.targetYaw - J.startYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const shake = t > 0.1 && t < 0.95 ? (0.95 - t) * 0.045 : 0;
    cam.position.set(eye.x + (Math.random() - 0.5) * shake, eye.y + (Math.random() - 0.5) * shake, eye.z + (Math.random() - 0.5) * shake);
    // frame his head and shoulders against the light behind him; the face stays in shadow under the brim
    cam.rotation.set(J.startPitch * (1 - k) + 0.24 * k, J.startYaw + dy * k, (Math.random() - 0.5) * shake * 2, 'YXZ');
    // he lunges from ~1.4 m to ~0.8 m, arms coming up
    const lunge = Math.min(1, Math.max(0, (t - 0.08) / 0.3));
    const d = 1.4 - 0.6 * (lunge * lunge * (3 - 2 * lunge));
    fig.position.set(eye.x + J.dir.x * d, J.feetY, eye.z + J.dir.z * d);
    fig.rotation.y = Math.atan2(-J.dir.x, -J.dir.z);
    animateFigure(fig, dt, lunge < 1 ? 3 : 0, 1);
    // a dim cold light behind and above him: his outline reads, his face does not
    const L = this.chase.back;
    L.position.set(eye.x + J.dir.x * (d + 1.0), J.feetY + 2.1, eye.z + J.dir.z * (d + 1.0));
    L.intensity = 6; L.distance = 4.5;
    this.ui.el.jumpFlash.style.opacity = t < 0.5 ? String(0.55 * (1 - t / 0.5)) : '0';
    if (t > 0.95 && !J.black) { J.black = true; this.ui.fade(1, 0.05); this.audio.noiseHit({ freq: 90, q: 0.7, dur: 0.6, gain: 0.7, type: 'lowpass', wet: 0.2 }); }
    if (t > 1.7 && !J.shown) {
      J.shown = true;
      this.state = 'dead';
      L.intensity = 0;
      this.audio.setBreath(cam.position, 0);
      this.ui.show('death', true);
    }
  }

  caughtByOccupant(text) { this.caught(text); }

  // Retry from the last checkpoint: every player/AI/chase state involved in the capture is reset.
  retry() {
    this.ui.show('death', false);
    this.jump = null;
    this.ui.el.jumpFlash.style.opacity = '0';
    this.chase.back.intensity = 0; this.chase.back.distance = 5;
    if (this.hiding) { this.hiding = null; this.ui.show('hidingOverlay', false); }
    const c = this.checkpoint;
    this.player.spawn(c.x, c.y, c.z, c.yaw);
    this.player.frozen = false;
    this.player.lookBack = 0;
    this.player.crouching = false;
    this.ai.capture = false;
    if (this.chase.state !== 'idle' || this.zone === 'sewer') this.chase.reset();
    else if (this.ai.state !== 'DORMANT' && this.ai.state !== 'SCRIPTED') this.ai.respawnAwayFrom(this.player.pos);
    this.ui.fade(0, 0.8);
    this.ui.hint('');
    this.ui.el.hud.style.visibility = 'visible';
    if (this.player.hasFlash) this.player.setFlash(true);   // pick the light back up
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
    // exactly three shots, each fired once (guarded against repeated triggers)
    this.shotsFired = 0;
    shots.forEach((t, i) => setTimeout(() => {
      if (this.shotsFired !== i) return;
      this.audio.gunshot(i);
      this.shotsFired = i + 1;
    }, t));
    setTimeout(() => this.playEnding(), 6500);
  }

  async playEnding() {
    this.input?.unlock();
    const ui = this.ui;
    ui.show('ending', true);
    const el = ui.el.endingText, img = ui.el.endingImage;
    for (const card of ENDING) {
      el.textContent = card.text;
      if (card.image === 'map') { img.src = drawMap().toDataURL(); img.classList.remove('hidden'); } else img.classList.add('hidden');
      el.classList.add('show'); img.classList.add('show');
      await wait(card.hold * 1000);
      el.classList.remove('show'); img.classList.remove('show');
      await wait(1600);
    }
    img.classList.add('hidden');
    el.textContent = 'THE HOUSE IS WATCHING';
    el.classList.add('show');
    ui.el.again.classList.remove('hidden');
    this.endingDone = true;
  }

  // ---------------- per-frame ----------------
  update(dt, input) {
    this.input = input;
    if (this.state === 'dying' && this.jump) { this.updateJumpscare(dt); this.viewModel.update(dt, null, this.hemi.intensity); return; }
    if (this.state !== 'play') return;
    this.time += dt;
    const W = this.W, pl = this.player;

    if (this.hiding) {
      this.updateHiding(dt, input);
    } else if (this.ui.readerOpen) {
      if (input.was('interact') || input.was('journal')) this.ui.closeReader();
      pl.frozen = true;
    } else if (this.ui.journalOpen) {
      if (input.was('journal')) this.ui.toggleJournal([], []);
      pl.frozen = true;
    } else if (!this.turning && this.chase.state !== 'confront' && this.chase.state !== 'caught') {
      pl.frozen = false;
      if (input.was('journal')) this.ui.toggleJournal(this.inventory.list(), this.clues, (id) => this.readClue(id));
    }

    if (!this.hiding) pl.update(dt, input);
    else pl.applyBeam();
    this.viewModel.update(dt, input, this.hemi.intensity);

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

    const it = pl.frozen ? null : W.interact.update(this.camera, W.col);
    const label = it ? it.prompt() : '';
    if (!this.hiding) this.ui.setPrompt(label);
    if (it && label && input.was('interact') && !this.ui.readerOpen) it.use();

    for (const d of W.doors) d.update(dt);
    updateSewer(W, dt);
    this.updateTube(dt);
    this.computeZone();
    this.updateLook(dt);
    this.director.update(dt);
    this.ai.update(dt);
    this.chase.update(dt);
    this.flicker(dt);
    this.audio.setListener(this.camera);
    this.audio.update(dt);
    this.ui.update(dt);
  }

  updateLook(dt) {
    const L = this.lookFor(this.zone);
    const k = Math.min(1, dt * 1.5);
    this.scene.fog.density += (L.density - this.scene.fog.density) * k;
    this.scene.fog.color.lerp(new THREE.Color(L.fog), k);
    this.scene.background.copy(this.scene.fog.color);
    this.hemi.intensity += (L.hemi - this.hemi.intensity) * k;
  }

  flicker(dt) {
    for (const l of this.W.lights) {
      const f = l.userData.flicker;
      if (!f || (this.director.flickerLight === l && this.director.flickerBurst > 0)) continue;
      if (Math.random() < f * dt * 1.5) l.userData.dip = 0.05 + Math.random() * 0.15;
      if (l.userData.dip > 0) { l.userData.dip -= dt; l.intensity = l.userData.base * (Math.random() * 0.3); }
      else l.intensity = l.userData.base;
    }
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
