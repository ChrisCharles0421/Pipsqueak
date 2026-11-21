// Central audio manager (Web Audio API).
// Recorded samples live in public/audio/ and are loaded at start; every sound also has a procedural
// fallback, so the game still works if a file is missing. Spatial sounds use HRTF PannerNodes in world
// space; the listener follows the camera. Each playing source is tracked per key so identical sounds
// cannot pile up, and every node is disconnected when its sound ends.

// file -> how it is used. trimStart skips leading silence; gain normalises loudness.
export const SAMPLES = {
  footsteps: { file: 'audio/footsteps_audio.mp3', slice: 'onsets', gain: 0.62 },
  woodcreak: { file: 'audio/woodcreak_audio.mp3', gain: 1.0 },
  gunshot: { file: 'audio/gunshot_audio.mp3', trimStart: 'auto', gain: 0.62 },
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.volume = 0.8;
    this.samples = {};      // name -> { buffer, slices:[{start,dur}], start }
    this.active = {};       // key -> Set of live sources (for overlap limits)
    this.lastSlice = {};
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
    this.loaded = this.loadSamples();
  }

  async loadSamples() {
    const base = (import.meta.env && import.meta.env.BASE_URL) || './';
    await Promise.all(Object.entries(SAMPLES).map(async ([name, cfg]) => {
      try {
        const res = await fetch(base + cfg.file);
        if (!res.ok) throw new Error(res.status);
        const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
        const info = { buffer, start: 0, slices: null, cfg };
        const onsets = detectOnsets(buffer);
        if (cfg.trimStart === 'auto') info.start = Math.max(0, (onsets[0] ?? 0) - 0.02);
        if (cfg.slice === 'onsets' && onsets.length > 1) {
          info.slices = onsets.map((t, i) => {
            const end = i + 1 < onsets.length ? onsets[i + 1] : buffer.duration;
            return { start: Math.max(0, t - 0.015), dur: Math.min(0.5, end - t - 0.02) };
          });
        }
        this.samples[name] = info;
      } catch (e) {
        console.warn(`[audio] ${cfg.file} unavailable, using procedural fallback`, e.message || e);
      }
    }));
    return Object.keys(this.samples);
  }

  // Play part of a loaded sample. Returns the source or null (not loaded / overlap limit reached).
  playSample(name, { pos = null, gain = 1, rate = 1, offset = 0, dur = null, key = name, maxInstances = 4, wet = 0.2, lowpass = null, highpass = null, fadeOut = 0.08, delay = 0, ref = 2, rolloff = 1.2 } = {}) {
    if (!this.enabled) return null;
    const smp = this.samples[name]; if (!smp) return null;
    const live = (this.active[key] ||= new Set());
    if (live.size >= maxInstances) return null;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = smp.buffer;
    src.playbackRate.value = rate;
    let node = src;
    const chain = [src];
    if (lowpass) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; node.connect(f); node = f; chain.push(f); }
    if (highpass) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = highpass; node.connect(f); node = f; chain.push(f); }
    const g = c.createGain();
    const total = (smp.cfg.gain ?? 1) * gain;
    const length = (dur ?? (smp.buffer.duration - offset)) / rate;
    g.gain.setValueAtTime(total, t);
    if (fadeOut > 0 && length > fadeOut) { g.gain.setValueAtTime(total, t + length - fadeOut); g.gain.linearRampToValueAtTime(0.0001, t + length); }
    node.connect(g); chain.push(g);
    let dest = this.master, pan = null;
    if (pos) { pan = this.panner(pos, ref, rolloff); g.connect(pan); pan.connect(this.master); chain.push(pan); } else g.connect(this.master);
    let send = null;
    if (wet > 0) { send = c.createGain(); send.gain.value = wet; g.connect(send); send.connect(this.reverb); chain.push(send); }
    src.start(t, smp.start + offset, dur ?? undefined);
    live.add(src);
    src.onended = () => { live.delete(src); for (const n of chain) { try { n.disconnect(); } catch { /* already */ } } };
    return src;
  }

  pickSlice(name) {
    const smp = this.samples[name]; if (!smp?.slices) return null;
    let i = Math.floor(Math.random() * smp.slices.length);
    if (i === this.lastSlice[name]) i = (i + 1) % smp.slices.length;
    this.lastSlice[name] = i;
    return smp.slices[i];
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
    this.listenerPos = { x: p.x, y: p.y, z: p.z };
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
  // One footstep, triggered by actual movement (distance walked), never by a timer.
  // who: 'player' | 'occupant'. The occupant's steps are lower-pitched, heavier and positional.
  footstep(surface, loud = 1, pos = null, who = 'player') {
    const sl = this.pickSlice('footsteps');
    if (sl) {
      const occ = who === 'occupant';
      const filt = { carpet: { lowpass: 1400 }, grass: { lowpass: 2200 }, tile: { highpass: 250 }, water: { lowpass: 3000 } }[surface] || {};
      const rate = (occ ? 0.8 : 1.04) * (0.96 + Math.random() * 0.08) * (loud > 1.2 && !occ ? 1.06 : 1);
      this.playSample('footsteps', {
        pos, offset: sl.start, dur: sl.dur, rate, gain: (occ ? 0.75 : 0.32) * loud * (surface === 'carpet' ? 0.6 : 1),
        key: occ ? 'stepsOcc' : 'stepsPlayer', maxInstances: 3, wet: surface === 'concrete' || surface === 'water' ? 0.45 : 0.12,
        ...filt, ...(occ ? { lowpass: Math.min(filt.lowpass || 9000, 2600) } : {}), ref: occ ? 2.5 : 1,
      });
      if (surface === 'water') this.noiseHit({ pos, freq: 1200, q: 0.7, dur: 0.15, gain: 0.06 * loud, wet: 0.5 });
      return;
    }
    const s = {
      wood: { freq: 420, q: 1.2, dur: 0.09 }, carpet: { freq: 250, q: 0.8, dur: 0.06 },
      tile: { freq: 1400, q: 2, dur: 0.05 }, concrete: { freq: 900, q: 1.5, dur: 0.06 },
      grass: { freq: 2500, q: 0.6, dur: 0.12 }, water: { freq: 1200, q: 0.7, dur: 0.18 },
    }[surface] || { freq: 600, q: 1, dur: 0.07 };
    this.noiseHit({ pos, ...s, gain: 0.12 * loud, wet: surface === 'water' || surface === 'concrete' ? 0.5 : 0.15 });
  }
  // Wood creak: a random section of the recording, varied pitch/length, at most two at once.
  creak(pos, gain = 0.08, { len = null, key = 'creak' } = {}) {
    const smp = this.samples.woodcreak;
    if (smp) {
      const d = len ?? (0.45 + Math.random() * 0.6);
      const offset = 0.1 + Math.random() * Math.max(0, smp.buffer.duration - d - 0.2);
      this.playSample('woodcreak', { pos, offset, dur: d, rate: 0.85 + Math.random() * 0.3, gain: gain * 6, key, maxInstances: 2, wet: 0.3, fadeOut: 0.15, delay: Math.random() * 0.06 });
      return;
    }
    this.tone({ pos, f0: 140 + Math.random() * 80, f1: 90 + Math.random() * 60, dur: 0.5, gain, type: 'sawtooth', wet: 0.4 });
  }
  door(open, pos) {
    this.creak(pos, 0.05, { len: open ? 0.7 : 0.4, key: 'doorCreak' });
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
  buzz(pos, dur = 3) {
    if (!this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100;
    const g = c.createGain(); g.gain.setValueAtTime(0, t);
    for (let k = 0; k < dur * 12; k++) g.gain.setValueAtTime(Math.random() < 0.6 ? 0.05 + Math.random() * 0.05 : 0, t + k / 12);
    g.gain.setValueAtTime(0, t + dur);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
    o.connect(f).connect(g).connect(this.out(pos, 0.3));
    o.start(t); o.stop(t + dur + 0.1);
    for (let k = 0; k < 8; k++) setTimeout(() => this.noiseHit({ pos, freq: 3000, q: 4, dur: 0.03, gain: 0.12 }), Math.random() * dur * 1000);
  }
  pop(pos) {
    this.noiseHit({ pos, freq: 4000, q: 0.8, dur: 0.25, gain: 0.5, type: 'highpass', wet: 0.6, attack: 0.001 });
    this.noiseHit({ pos, freq: 6000, q: 2, dur: 0.6, gain: 0.15, wet: 0.5 });
  }
  grab() {
    this.noiseHit({ freq: 300, q: 0.5, dur: 0.4, gain: 0.8, type: 'lowpass', wet: 0.3 });
    this.sting(0.25);
  }
  // Gunshot for the ending. The child fires, so it is not positional; strong reverb for the tunnel.
  gunshot(index = 0) {
    if (!this.enabled) return;
    if (this.samples.gunshot) {
      this.playSample('gunshot', { gain: 1, rate: [1, 0.97, 1.02][index % 3], key: `gunshot${index}`, maxInstances: 1, wet: 0.5, fadeOut: 0.3 });
      return;
    }
    this.noiseHit({ freq: 2500, q: 0.3, dur: 0.35, gain: 1.0, type: 'lowpass', wet: 0.9, attack: 0.001 });
    this.noiseHit({ freq: 120, q: 0.6, dur: 0.6, gain: 1.0, type: 'lowpass', wet: 0.9, attack: 0.001 });
    this.tone({ f0: 90, f1: 30, dur: 0.5, gain: 0.7, type: 'sine', wet: 0.6 });
  }
  // the house settling: occasional distant creaks (no gameplay effect)
  settle(listenerPos) {
    const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 6;
    this.creak({ x: listenerPos.x + Math.cos(a) * d, y: listenerPos.y + 2.2, z: listenerPos.z + Math.sin(a) * d }, 0.04, { len: 0.8 + Math.random() * 0.6, key: 'settle' });
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
    if (this.zone === 'house' || this.zone === 'basement') {
      this.settleT = (this.settleT ?? 20) - dt;
      if (this.settleT <= 0 && this.listenerPos) { this.settleT = 25 + Math.random() * 35; this.settle(this.listenerPos); }
    }
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

// Find sound onsets (start of each footstep / shot) from the RMS envelope.
export function detectOnsets(buffer, { win = 0.01, rel = 0.25, minGap = 0.18 } = {}) {
  const sr = buffer.sampleRate, ch = buffer.getChannelData(0);
  const n = Math.floor(win * sr), rms = [];
  for (let i = 0; i + n <= ch.length; i += n) { let s = 0; for (let k = 0; k < n; k++) s += ch[i + k] * ch[i + k]; rms.push(Math.sqrt(s / n)); }
  const max = Math.max(...rms), thr = max * rel, out = [];
  let last = -1e9;
  for (let i = 1; i < rms.length; i++) if (rms[i] > thr && rms[i - 1] <= thr && (i - last) * win > minGap) { out.push(i * win); last = i; }
  return out;
}
