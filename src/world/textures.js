// Procedural canvas textures. No external image assets are required.
import * as THREE from 'three';

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function speckle(ctx, size, r, count, colorFn) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colorFn(r());
    const s = 1 + r() * 3;
    ctx.fillRect(r() * size, r() * size, s, s);
  }
}

function finish(canvas, repeat = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const cache = {};
function cached(name, fn) {
  if (!cache[name]) cache[name] = fn();
  return cache[name];
}

export const tex = {
  wood: () => cached('wood', () => {
    const [c, g] = makeCanvas(256);
    const r = rand(1);
    for (let i = 0; i < 8; i++) {
      const base = 70 + r() * 25;
      g.fillStyle = `rgb(${base},${base * 0.66},${base * 0.42})`;
      g.fillRect(0, i * 32, 256, 32);
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `rgba(30,18,10,${0.08 + r() * 0.12})`;
        g.beginPath();
        const y = i * 32 + r() * 32;
        g.moveTo(0, y);
        g.bezierCurveTo(80, y + r() * 4 - 2, 170, y + r() * 4 - 2, 256, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(10,6,3,0.7)';
      g.fillRect(0, i * 32, 256, 1.5);
      g.fillRect(((i * 97) % 256), i * 32, 1.5, 32);
    }
    speckle(g, 256, r, 600, (v) => `rgba(0,0,0,${v * 0.25})`);
    return finish(c);
  }),
  wallpaper: () => cached('wallpaper', () => {
    const [c, g] = makeCanvas(256);
    const r = rand(2);
    g.fillStyle = '#6d6650';
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 32) {
      g.fillStyle = 'rgba(60,52,36,0.5)';
      g.fillRect(x, 0, 10, 256);
      for (let y = 0; y < 256; y += 32) {
        g.fillStyle = 'rgba(90,80,58,0.6)';
        g.beginPath();
        g.arc(x + 21, y + 16, 4, 0, Math.PI * 2);
        g.fill();
      }
    }
    // water stains and grime
    for (let i = 0; i < 6; i++) {
      const gx = r() * 256, gy = r() * 256;
      const grd = g.createRadialGradient(gx, gy, 2, gx, gy, 60 + r() * 60);
      grd.addColorStop(0, 'rgba(40,30,15,0.35)');
      grd.addColorStop(1, 'rgba(40,30,15,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
    }
    speckle(g, 256, r, 800, (v) => `rgba(20,15,5,${v * 0.2})`);
    return finish(c);
  }),
  plaster: () => cached('plaster', () => {
    const [c, g] = makeCanvas(256);
    const r = rand(3);
    g.fillStyle = '#8a8478';
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, r, 3000, (v) => `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},0.05)`);
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = 'rgba(40,35,30,0.35)';
      g.beginPath();
      let x = r() * 256, y = r() * 256;
      g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += r() * 20 - 10; y += r() * 20; g.lineTo(x, y); }
      g.stroke();
    }
    return finish(c);
  }),
  siding: () => cached('siding', () => {
    const [c, g] = makeCanvas(256);
    const r = rand(4);
    for (let y = 0; y < 256; y += 21) {
      const v = 70 + r() * 12;
      g.fillStyle = `rgb(${v},${v * 0.98},${v * 0.92})`;
      g.fillRect(0, y, 256, 21);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(0, y + 19, 256, 2);
    }
    speckle(g, 256, r, 1500, (v) => `rgba(20,25,15,${v * 0.25})`);
    return finish(c);
  }),
  concrete: () => cached('concrete', () => {
    const [c, g] = makeCanvas(256);
    const r = rand(5);
    g.fillStyle = '#5b5a56';
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, r, 5000, (v) => `rgba(${v > 0.5 ? 200 : 20},${v > 0.5 ? 200 : 20},${v > 0.5 ? 190 : 20},0.08)`);
    for (let i = 0; i < 8; i++) {
      const gx = r() * 256, gy = r() * 256;
      const grd = g.createRadialGradient(gx, gy, 1, gx, gy, 40 + r() * 80);
      grd.addColorStop(0, 'rgba(25,22,18,0.4)');
      grd.addColorStop(1, 'rgba(25,22,18,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
    }
    return finish(c);
  }),
  tile: () => cached('tile', () => {
    const [c, g] = makeCanvas(256);
    const r = rand(6);
    for (let x = 0; x < 256; x += 32) for (let y = 0; y < 256; y += 32) {
      const v = 150 + r() * 20;
      g.fillStyle = `rgb(${v},${v},${v * 0.95})`;
      g.fillRect(x, y, 32, 32);
    }
    g.fillStyle = 'rgba(40,38,30,0.9)';
    for (let i = 0; i <= 256; i += 32) { g.fillRect(i - 1, 0, 2, 256); g.fillRect(0, i - 1, 256, 2); }
    speckle(g, 256, r, 1200, (v) => `rgba(40,30,10,${v * 0.25})`);
    return finish(c);
  }),
  grass: () => cached('grass', () => {
    const [c, g] = makeCanvas(256);
    const r = rand(7);
    g.fillStyle = '#26301c';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
      const v = r();
      g.strokeStyle = `rgba(${40 + v * 40},${55 + v * 45},${25 + v * 20},0.6)`;
      const x = r() * 256, y = r() * 256;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + r() * 3 - 1.5, y - 3 - r() * 4); g.stroke();
    }
    speckle(g, 256, r, 600, () => 'rgba(30,22,12,0.5)');
    return finish(c);
  }),
  dirt: () => cached('dirt', () => {
    const [c, g] = makeCanvas(256);
    const r = rand(8);
    g.fillStyle = '#3a3024';
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, r, 5000, (v) => `rgba(${v * 90},${v * 70},${v * 50},0.25)`);
    return finish(c);
  }),
  brick: () => cached('brick', () => {
    const [c, g] = makeCanvas(256);
    const r = rand(9);
    g.fillStyle = '#2b2722';
    g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 16; row++) {
      for (let col = -1; col < 5; col++) {
        const x = col * 64 + (row % 2) * 32, y = row * 16;
        const v = 70 + r() * 30;
        g.fillStyle = `rgb(${v},${v * 0.55},${v * 0.42})`;
        g.fillRect(x + 1, y + 1, 62, 14);
      }
    }
    speckle(g, 256, r, 1500, (v) => `rgba(0,0,0,${v * 0.3})`);
    return finish(c);
  }),
  carpet: () => cached('carpet', () => {
    const [c, g] = makeCanvas(128);
    const r = rand(10);
    g.fillStyle = '#4a2f2c';
    g.fillRect(0, 0, 128, 128);
    speckle(g, 128, r, 3000, (v) => `rgba(${v * 60},${v * 30},${v * 30},0.3)`);
    return finish(c);
  }),
  paper: (text, title) => {
    const [c, g] = makeCanvas(256);
    g.fillStyle = '#cfc6ad';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#3a3428';
    g.font = 'bold 22px serif';
    g.fillText(title || '', 14, 34);
    g.fillStyle = 'rgba(50,45,35,0.55)';
    for (let y = 56; y < 240; y += 14) g.fillRect(14, y, 180 + ((y * 37) % 50), 4);
    return finish(c);
  },
};
