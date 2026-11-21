import * as THREE from 'three';
import { Game } from './game.js';
import { Input } from './systems/input.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const game = new Game(renderer, DEBUG);
const input = new Input(canvas);
const ui = game.ui;

function begin() {
  game.audio.start();
  game.audio.setZone('basement');
  ui.show('title', false);
  game.state = 'play';
  game.setObjective('wake');
  ui.fade(1, 0);
  setTimeout(() => ui.fade(0, 3), 300);
  setTimeout(() => ui.toast('Your head hurts. The floor is cold concrete. You do not know where you are.', 6), 1500);
  if (!DEBUG) input.lock();
}

document.getElementById('start').onclick = begin;
document.getElementById('resume').onclick = () => { ui.show('pause', false); game.state = 'play'; input.lock(); };
document.getElementById('restart-checkpoint').onclick = () => { ui.show('pause', false); game.retry(); input.lock(); };
document.getElementById('retry').onclick = () => { game.retry(); input.lock(); };
document.getElementById('again').onclick = () => location.reload();
document.getElementById('sens').oninput = (e) => { input.sensitivity = 0.0022 * Number(e.target.value); };
document.getElementById('vol').oninput = (e) => { game.audio.volume = Number(e.target.value); if (game.audio.master) game.audio.master.gain.value = game.audio.volume; };
document.getElementById('reader').onclick = () => ui.closeReader();

input.onLockChange = (locked) => {
  if (!locked && game.state === 'play' && !DEBUG) {
    game.state = 'paused';
    ui.show('pause', true);
  }
};
canvas.addEventListener('click', () => { if (game.state === 'play' && !input.locked && !DEBUG) input.lock(); });

addEventListener('resize', () => {
  game.camera.aspect = innerWidth / innerHeight;
  game.camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt, input);
  input.endFrame();
  if (DEBUG && window.__renderOverride) window.__renderOverride();
  else renderer.render(game.scene, game.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- debug / test hooks (only with ?debug) ----
if (DEBUG) {
  window.__game = {
    game, input, THREE,
    begin,
    teleport(x, y, z, yaw = 0) { game.player.spawn(x, y, z, yaw); },
    state() {
      const p = game.player.pos;
      return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), zone: game.zone, room: game.room, objective: game.objective,
        chase: game.chase.state, gap: +(game.chase.pos.z - p.z).toFixed(2), state: game.state, inv: [...game.inventory.items], prompt: document.getElementById('prompt').textContent };
    },
    give(id) { game.inventory.add(id); if (id === 'flashlight') { game.player.hasFlash = true; game.player.setFlash(true); } },
    look(yaw, pitch = 0) { game.player.yaw = yaw; game.player.pitch = pitch; },
    press(code) { input.pressed.add(code); },
    topDown(cx, cz, size, y = 2.6) {
      const cam = new THREE.OrthographicCamera(-size / 2 * innerWidth / innerHeight, size / 2 * innerWidth / innerHeight, size / 2, -size / 2, 0.1, 60);
      cam.position.set(cx, y, cz); cam.up.set(0, 0, -1); cam.lookAt(cx, -10, cz);
      game.W.ceilings.forEach((c) => (c.visible = false));
      const fog = game.scene.fog; game.scene.fog = null;
      const amb = new THREE.AmbientLight(0xffffff, 2.5); game.scene.add(amb);
      renderer.render(game.scene, cam);
      game.scene.remove(amb); game.scene.fog = fog;
      game.W.ceilings.forEach((c) => (c.visible = true));
    },
    hold(code, on) { if (on) input.down.add(code); else input.down.delete(code); },
  };
}
