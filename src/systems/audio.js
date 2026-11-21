// Procedural audio (Web Audio API). No external sound files are needed.
// Spatial one-shots use PannerNodes positioned in world space; the listener follows the camera.
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.volume = 0.8;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(c.destination);
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(2.2, 2.5);
    this.revGain = c.createGain();
    this.revGain.gain.value = 0.25;
    this.reverb.connect(this.revGain).connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.brownBuf = this.makeNoise(4, true);
    this.enabled = true;
    this.startAmbience();
  }

  makeNoise(sec, brown = false) {
    const c = this.ctx;
    const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  impulse(sec, decay) {
    const c = this.ctx;
    const len = c.sampleRate * sec;
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  setListener(cam) {
    if (!this.enabled) return;
    const l = this.ctx.listener;
    const p = cam.position;
    const f = cam.getWorldDirection(this._v || (this._v = cam.position.clone()));
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.02); l.positionY.setTargetAtTime(p.y, t, 0.02); l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(f.x, t, 0.02); l.forwardY.setTargetAtTime(f.y, t, 0.02); l.forwardZ.setTargetAtTime(f.z, t, 0.02);
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  panner(pos, ref = 2, rolloff = 1.2) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = rolloff;
    p.maxDistance = 60;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
    return p;
  }

  out(pos, wet = 0.3) {
    // returns a node to connect a source into (spatial if pos given)
    const g = this.ctx.createGain();
    if (pos) g.connect(this.panner(pos)).connect(this.master); else g.connect(this.master);
    if (wet > 0) { const s = this.ctx.createGain(); s.gain.value = wet; g.connect(s).connect(this.reverb); }
    return g;
  }

  noiseHit({ pos = null, dur = 0.08, freq = 800, q = 1, gain = 0.3, type = 'bandpass', wet = 0.2, attack = 0.003, buf = null }) {
    if (!this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = buf || this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(this.out(pos, wet));
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  tone({ pos = null, f0 = 200, f1 = null, dur = 0.3, gain = 0.2, type = 'sine', wet = 0.3, delay = 0 }) {
    if (!this.enabled) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.out(pos, wet));
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- game sounds ----------
  footstep(surface, loud = 1, pos = null) {
    const s = {
      wood: { freq: 420, q: 1.2, dur: 0.09 }, carpet: { freq: 250, q: 0.8, dur: 0.06 },
      tile: { freq: 1400, q: 2, dur: 0.05 }, concrete: { freq: 900, q: 1.5, dur: 0.06 },
      grass: { freq: 2500, q: 0.6, dur: 0.12 }, water: { freq: 1200, q: 0.7, dur: 0.18 },
    }[surface] || { freq: 600, q: 1, dur: 0.07 };
    this.noiseHit({ pos, ...s, gain: 0.12 * loud, wet: surface === 'water' || surface === 'concrete' ? 0.5 : 0.15 });
    if (surface === 'wood' && Math.random() < 0.12) this.creak(pos, 0.05);
  }
  creak(pos, gain = 0.08) {
    this.tone({ pos, f0: 140 + Math.random() * 80, f1: 90 + Math.random() * 60, dur: 0.5, gain, type: 'sawtooth', wet: 0.4 });
  }
  door(open, pos) {
    this.creak(pos, 0.06);
    if (!open) this.noiseHit({ pos, freq: 180, q: 0.8, dur: 0.25, gain: 0.35, type: 'lowpass', wet: 0.4 });
  }
  rattle(pos) {
    for (let i = 0; i < 4; i++) setTimeout(() => this.noiseHit({ pos, freq: 1800, q: 3, dur: 0.05, gain: 0.18 }), i * 70);
  }
  unlock() { this.tone({ f0: 1800, f1: 1200, dur: 0.06, gain: 0.08, type: 'square', wet: 0.1 }); setTimeout(() => this.noiseHit({ freq: 2500, q: 4, dur: 0.05, gain: 0.15 }), 90); }
  pickup() { this.noiseHit({ freq: 3000, q: 0.7, dur: 0.12, gain: 0.08, type: 'highpass', wet: 0.05 }); }
  paper() { this.noiseHit({ freq: 4000, q: 0.5, dur: 0.25, gain: 0.07, type: 'highpass', wet: 0.05 }); }
  click() { this.noiseHit({ freq: 3200, q: 6, dur: 0.02, gain: 0.2, wet: 0 }); }
  pry() {
    this.tone({ f0: 300, f1: 180, dur: 0.8, gain: 0.12, type: 'sawtooth', wet: 0.5 });
    setTimeout(() => this.noiseHit({ freq: 900, q: 3, dur: 0.6, gain: 0.4, wet: 0.6 }), 600);
  }
  knock(pos) { for (let i = 0; i < 3; i++) setTimeout(() => this.noiseHit({ pos, freq: 160, q: 1, dur: 0.15, gain: 0.5, type: 'lowpass', wet: 0.5 }), i * 260); }
  distantSteps(pos, n = 5, gap = 520) { for (let i = 0; i < n; i++) setTimeout(() => this.footstep('wood', 1.6, pos), i * gap); }
  branch(pos) { this.noiseHit({ pos, freq: 1600, q: 2, dur: 0.08, gain: 0.6, wet: 0.6 }); }
  clang(pos) {
    this.noiseHit({ pos, freq: 600, q: 8, dur: 1.4, gain: 0.6, wet: 0.8 });
    this.tone({ pos, f0: 310, dur: 1.5, gain: 0.15, type: 'triangle', wet: 0.8 });
  }
  sting(gain = 0.12) {
    this.tone({ f0: 55, f1: 50, dur: 2.5, gain, type: 'sawtooth', wet: 0.6 });
    this.tone({ f0: 58.3, f1: 52, dur: 2.5, gain: gain * 0.8, type: 'sawtooth', wet: 0.6 });
  }
  grab() {
    this.noiseHit({ freq: 300, q: 0.5, dur: 0.4, gain: 0.8, type: 'lowpass', wet: 0.3 });
    this.sting(0.25);
  }
  gunshot() {
    if (!this.enabled) return;
    this.noiseHit({ freq: 2500, q: 0.3, dur: 0.35, gain: 1.0, type: 'lowpass', wet: 0.9, attack: 0.001 });
    this.noiseHit({ freq: 120, q: 0.6, dur: 0.6, gain: 1.0, type: 'lowpass', wet: 0.9, attack: 0.001 });
    this.tone({ f0: 90, f1: 30, dur: 0.5, gain: 0.7, type: 'sine', wet: 0.6 });
  }

  // ---------- loops ----------
  startAmbience() {
    const c = this.ctx;
    const mk = (buf, freq, type = 'lowpass') => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = c.createGain(); g.gain.value = 0;
      s.connect(f).connect(g).connect(this.master);
      s.start();
      return g;
    };
    this.amb = {
      house: mk(this.brownBuf, 180),
      wind: mk(this.noiseBuf, 500, 'bandpass'),
      sewer: mk(this.brownBuf, 300),
    };
    // pursuer breathing loop (spatial)
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.9;
    const env = c.createGain(); env.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.9;
    const lfoG = c.createGain(); lfoG.gain.value = 0.5;
    const base = c.createConstantSource ? c.createConstantSource() : null;
    lfo.connect(lfoG).connect(env.gain);
    if (base) { base.offset.value = 0.5; base.connect(env.gain); base.start(); }
    this.breathPan = this.panner({ x: 0, y: -100, z: 0 }, 1.5, 1.4);
    this.breathGain = c.createGain(); this.breathGain.gain.value = 0;
    s.connect(f).connect(env).connect(this.breathGain).connect(this.breathPan).connect(this.master);
    s.start(); lfo.start();
    this.breathLfo = lfo;
    this.dripT = 0;
  }

  setZone(zone) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const v = { basement: [0.25, 0, 0], house: [0.18, 0.02, 0], exterior: [0.02, 0.22, 0], sewer: [0, 0, 0.3], silent: [0, 0, 0] }[zone] || [0, 0, 0];
    this.amb.house.gain.setTargetAtTime(v[0], t, 0.8);
    this.amb.wind.gain.setTargetAtTime(v[1], t, 0.8);
    this.amb.sewer.gain.setTargetAtTime(v[2], t, 0.8);
    this.zone = zone;
  }

  setBreath(pos, level, rate = 0.9) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const p = this.breathPan;
    if (p.positionX) { p.positionX.setTargetAtTime(pos.x, t, 0.05); p.positionY.setTargetAtTime(pos.y, t, 0.05); p.positionZ.setTargetAtTime(pos.z, t, 0.05); }
    this.breathGain.gain.setTargetAtTime(level, t, 0.2);
    this.breathLfo.frequency.setTargetAtTime(rate, t, 0.3);
  }

  update(dt) {
    if (!this.enabled) return;
    if (this.zone === 'sewer') {
      this.dripT -= dt;
      if (this.dripT <= 0) {
        this.dripT = 0.4 + Math.random() * 1.6;
        this.tone({ f0: 1400 + Math.random() * 1200, f1: 600, dur: 0.12, gain: 0.05, wet: 0.9 });
      }
    }
  }

  stopAll() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    for (const g of Object.values(this.amb)) g.gain.setValueAtTime(0, t);
    this.breathGain.gain.setValueAtTime(0, t);
    this.zone = 'silent';
  }
}
