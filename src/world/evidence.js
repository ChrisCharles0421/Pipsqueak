// Hand-drawn-looking canvas art for evidence: the occupant's map, photographs, clippings, notes.
// Everything is generated at runtime; no image files are needed. Text content comes from data/story.js.
import * as THREE from 'three';
import { MAP } from '../data/story.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const HAND = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";

// A rough, multi-stroke pen line so marks look drawn by hand.
function handLine(g, r, x0, y0, x1, y1, passes = 2, wobble = 2.5) {
  for (let p = 0; p < passes; p++) {
    g.beginPath();
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t + (r() - 0.5) * wobble;
      const y = y0 + (y1 - y0) * t + (r() - 0.5) * wobble;
      if (i === 0) g.moveTo(x + (r() - 0.5) * 3, y + (r() - 0.5) * 3); else g.lineTo(x, y);
    }
    g.stroke();
  }
}

function handX(g, r, x, y, s) {
  g.strokeStyle = 'rgba(165,12,10,0.92)';
  g.lineCap = 'round';
  g.lineWidth = 7;
  handLine(g, r, x - s, y - s * 0.9, x + s * 1.05, y + s, 3, 4);
  handLine(g, r, x + s, y - s, x - s * 0.95, y + s * 1.08, 3, 4);
}

function handCircle(g, r, x, y, rad) {
  g.strokeStyle = 'rgba(160,15,12,0.85)';
  g.lineWidth = 3.5;
  for (let p = 0; p < 2; p++) {
    g.beginPath();
    const a0 = r() * Math.PI * 2;
    for (let i = 0; i <= 26; i++) {
      const a = a0 + (i / 24) * Math.PI * 2;
      const rr = rad * (1 + (r() - 0.5) * 0.12);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.85;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
  }
}

let mapCanvas = null;
export function drawMap() {
  if (mapCanvas) return mapCanvas;
  const W = 1200, H = 860;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rng(42);
  // paper
  g.fillStyle = '#d9cfb2'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(90,70,40,${r() * 0.06})`; g.fillRect(r() * W, r() * H, 2, 2); }
  for (let i = 0; i < 5; i++) {
    const x = r() * W, y = r() * H, gr = g.createRadialGradient(x, y, 5, x, y, 120 + r() * 160);
    gr.addColorStop(0, 'rgba(120,90,40,0.18)'); gr.addColorStop(1, 'rgba(120,90,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  // folds
  g.strokeStyle = 'rgba(80,60,30,0.25)'; g.lineWidth = 2;
  for (const x of [W / 3, (2 * W) / 3]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  // woods
  for (const [x, y, s] of MAP.woods) {
    g.fillStyle = 'rgba(70,100,60,0.28)';
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(x + (r() - 0.5) * s, y + (r() - 0.5) * s * 0.7, 6 + r() * 10, 0, 7); g.fill(); }
  }
  // river
  g.strokeStyle = 'rgba(60,90,130,0.7)'; g.lineWidth = 9;
  g.beginPath();
  MAP.river.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  // roads
  g.strokeStyle = 'rgba(70,60,50,0.75)'; g.lineWidth = 4;
  for (const road of MAP.roads) { g.beginPath(); road.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  // printed labels
  g.fillStyle = 'rgba(40,35,28,0.85)'; g.font = 'bold 22px Georgia, serif';
  for (const [name, x, y] of MAP.towns) { g.fillRect(x - 5, y - 5, 10, 10); g.fillText(name.toUpperCase(), x + 12, y + 8); }
  g.font = 'italic 17px Georgia, serif';
  for (const [name, x, y] of MAP.features) g.fillText(name, x, y);
  g.font = 'bold 26px Georgia, serif'; g.fillText('COUNTY ROAD MAP', 40, 50);

  // the house: a small pencilled square, unlabelled
  const [hx, hy] = MAP.house;
  g.strokeStyle = 'rgba(30,30,30,0.8)'; g.lineWidth = 2.5;
  handLine(g, r, hx - 10, hy - 10, hx + 10, hy - 10, 2, 1.5); handLine(g, r, hx + 10, hy - 10, hx + 10, hy + 10, 2, 1.5);
  handLine(g, r, hx + 10, hy + 10, hx - 10, hy + 10, 2, 1.5); handLine(g, r, hx - 10, hy + 10, hx - 10, hy - 10, 2, 1.5);

  // faint pencil lines: every circle -> the house -> every X
  g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 1.5; g.setLineDash([7, 6]);
  for (const t of MAP.taken) handLine(g, r, t.x, t.y, hx, hy, 1, 2);
  for (const d of MAP.found) handLine(g, r, hx, hy, d.x, d.y, 1, 2);
  g.setLineDash([]);

  // red circles (where children were taken) with handwritten notes
  for (const t of MAP.taken) {
    handCircle(g, r, t.x, t.y, 30);
    g.fillStyle = 'rgba(40,30,30,0.9)'; g.font = `20px ${HAND}`;
    g.save(); g.translate(t.x + 34, t.y - 18); g.rotate((r() - 0.5) * 0.15); g.fillText(t.note, 0, 0); g.restore();
  }
  // large red X marks (where remains were left)
  for (const d of MAP.found) {
    handX(g, r, d.x, d.y, 26);
    if (d.note) {
      g.fillStyle = 'rgba(120,15,12,0.9)'; g.font = `19px ${HAND}`;
      g.save(); g.translate(d.x + 30, d.y + 34); g.rotate((r() - 0.5) * 0.2); g.fillText(d.note, 0, 0); g.restore();
    }
  }
  mapCanvas = c;
  return c;
}

export function mapTexture() {
  const t = new THREE.CanvasTexture(drawMap());
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Corkboard: polaroids taken from a distance (children's figures only as small silhouettes) and clippings.
export function corkboardTexture() {
  const W = 768, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); const r = rng(7);
  g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${r() > 0.5 ? 40 : 160},${r() > 0.5 ? 25 : 120},10,0.15)`; g.fillRect(r() * W, r() * H, 2, 2); }
  g.strokeStyle = '#3b2a18'; g.lineWidth = 18; g.strokeRect(0, 0, W, H);
  const notes = ['always smiling', 'swings. sat.', 'laughing', 'with her dad', 'happy', 'every day at 3'];
  for (let i = 0; i < 6; i++) {
    const x = 40 + (i % 3) * 170 + r() * 20, y = 40 + Math.floor(i / 3) * 215 + r() * 20;
    g.save(); g.translate(x + 70, y + 85); g.rotate((r() - 0.5) * 0.25); g.translate(-70, -85);
    g.fillStyle = '#e9e4d8'; g.fillRect(0, 0, 140, 170);
    // washed-out outdoor scene, shot from far away
    const sky = g.createLinearGradient(0, 10, 0, 130); sky.addColorStop(0, '#8d9aa0'); sky.addColorStop(1, '#6c7a5a');
    g.fillStyle = sky; g.fillRect(10, 10, 120, 120);
    g.fillStyle = '#4a5a3a'; g.fillRect(10, 100, 120, 30);
    // playground frame + a tiny figure
    g.strokeStyle = '#3a3a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(30, 100); g.lineTo(50, 45); g.lineTo(90, 45); g.lineTo(110, 100); g.stroke();
    g.fillStyle = '#2a2420'; g.beginPath(); g.arc(68 + r() * 10, 70, 4, 0, 7); g.fill(); g.fillRect(64 + r() * 10, 74, 8, 14);
    // red marker circle around the figure
    g.strokeStyle = 'rgba(170,20,15,0.85)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(70, 78, 16, 20, 0, 0, 7); g.stroke();
    g.fillStyle = '#2a2622'; g.font = `16px ${HAND}`; g.fillText(notes[i], 14, 156);
    g.restore();
    g.fillStyle = '#b02020'; g.beginPath(); g.arc(x + 70, y + 6, 6, 0, 7); g.fill();
  }
  // clippings
  const heads = ['GIRL, 8, STILL MISSING', 'SEARCH FOR BOY ENDS', 'FAIRGROUND DISAPPEARANCE'];
  for (let i = 0; i < 3; i++) {
    const x = 560 + r() * 20, y = 30 + i * 155;
    g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.2);
    g.fillStyle = '#d8d2c0'; g.fillRect(0, 0, 180, 135);
    g.fillStyle = '#1e1e1e'; g.font = 'bold 15px Georgia'; g.fillText(heads[i], 8, 24);
    g.fillStyle = 'rgba(40,40,40,0.55)'; for (let k = 0; k < 7; k++) g.fillRect(8, 38 + k * 13, 160 - (k % 3) * 25, 5);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function paperTexture(title, lines = 9, color = '#cfc6ad', ink = 'rgba(40,40,55,0.6)') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 340;
  const g = c.getContext('2d'); const r = rng(title.length * 13);
  g.fillStyle = color; g.fillRect(0, 0, 256, 340);
  g.fillStyle = 'rgba(30,30,40,0.85)'; g.font = `20px ${HAND}`; g.fillText(title, 16, 36);
  g.strokeStyle = ink; g.lineWidth = 2;
  for (let i = 0; i < lines; i++) handLine(g, r, 16, 64 + i * 26, 60 + r() * 170, 64 + i * 26, 1, 1.5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
