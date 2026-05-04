import { SYNTH_MAP } from './synths.js';

// ─── AUDIO ENGINE ───────────────────────────────────────────────────────────
export class Engine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.droneBus = null;
    this.metBus = null;
    this.fretBus = null;
    this.noiseBus = null;
    this.comp = null;
    this.hp = null;
    this.tilt = null;
    this.lim = null;
    this.noiseBuf = null;
    this.claveNoiseBuf = null;
    this.pinkBuf = null;
    this.voices = [];
    this.ready = false;
    // Noise state
    this.noiseSource = null;
    this.noiseGain = null;
    this.noiseHP = null;
    this.noiseLP = null;
    this.noiseLo = null;
    this.noiseHi = null;
    this.noiseRes = null;
  }

  init() {
    if (this.ready) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // iOS/Safari: AudioContext starts suspended without a user gesture.
    // Resume it on the first tap so all subsequent audio calls work.
    const _unlock = () => this.ctx.resume();
    document.addEventListener('pointerdown', _unlock, { once: true, passive: true });
    document.addEventListener('touchstart',  _unlock, { once: true, passive: true });

    // Prebuilt noise buffers
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    { const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

    this.claveNoiseBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * 0.05), this.ctx.sampleRate);
    { const d = this.claveNoiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

    // Voss-McCartney pink noise
    {
      const len = this.ctx.sampleRate * 10;
      this.pinkBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.pinkBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.012; b6 = w * 0.115926;
      }
    }

    // Glue compressor
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -22; this.comp.knee.value = 18;
    this.comp.ratio.value = 2.0; this.comp.attack.value = 0.01; this.comp.release.value = 0.28;

    // Master volume
    this.master = this.ctx.createGain(); this.master.gain.value = 0.75;

    // Buses
    this.droneBus = this.ctx.createGain(); this.droneBus.gain.value = 0.55;
    this.metBus = this.ctx.createGain(); this.metBus.gain.value = 0.50;
    this.fretBus = this.ctx.createGain(); this.fretBus.gain.value = 0.60;
    this.noiseBus = this.ctx.createGain(); this.noiseBus.gain.value = 0;
    this.droneBus.connect(this.master);
    this.metBus.connect(this.master);
    this.fretBus.connect(this.master);
    this.noiseBus.connect(this.master);

    // Master chain: HP → tilt → comp → limiter → destination
    this.hp = this.ctx.createBiquadFilter(); this.hp.type = "highpass"; this.hp.frequency.value = 28; this.hp.Q.value = 0.7;
    this.tilt = this.ctx.createBiquadFilter(); this.tilt.type = "lowshelf"; this.tilt.frequency.value = 140; this.tilt.gain.value = 1.5;
    this.lim = this.ctx.createDynamicsCompressor();
    this.lim.threshold.value = -10; this.lim.knee.value = 0;
    this.lim.ratio.value = 12; this.lim.attack.value = 0.002; this.lim.release.value = 0.08;

    this.master.connect(this.hp);
    this.hp.connect(this.tilt);
    this.tilt.connect(this.comp);
    this.comp.connect(this.lim);
    this.lim.connect(this.ctx.destination);
    this.ready = true;
  }

  freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  drift() { return (Math.random() - 0.5) * 0.2; }

  partial(freq, vol, dest) {
    const o = this.ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq + this.drift();
    const g = this.ctx.createGain(); g.gain.value = vol; o.connect(g); if (dest) g.connect(dest);
    return { osc: o, gain: g };
  }

  makeSaturator(drive = 1.0) {
    const pre = this.ctx.createGain(); pre.gain.value = drive;
    const ws = this.ctx.createWaveShaper(); const N = 2048; const curve = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; curve[i] = Math.tanh(x * 1.4); }
    ws.curve = curve; ws.oversample = "4x";
    const post = this.ctx.createGain(); post.gain.value = 1 / Math.max(0.9, drive);
    pre.connect(ws); ws.connect(post);
    return { in: pre, out: post, ws };
  }

  // ─── VOICE MANAGEMENT ───────────────────────────────────────────────
  createVoice(f, texture, amp = 0.22) {
    const factory = SYNTH_MAP[texture] || SYNTH_MAP.pureBreath;
    return factory(this, f, amp);
  }

  fadeOutVoice(v) {
    if (!v) return;
    const n = this.ctx.currentTime;
    const rel = 0.9;
    try {
      v.env.gain.cancelScheduledValues(n);
      v.env.gain.setTargetAtTime(0.0001, n, 0.001);
      v.env.gain.setTargetAtTime(0.00001, n + 0.02, rel / 6);
    } catch (e) { /* ignore */ }
    setTimeout(() => {
      v.parts?.forEach(p => { try { p.osc.stop(); p.osc.disconnect(); } catch (e) { /* ignore */ } });
      v.nodes?.forEach(nd => { try { nd.disconnect(); } catch (e) { /* ignore */ } });
      try { v.env.disconnect(); } catch (e) { /* ignore */ }
    }, (rel + 0.25) * 1000);
  }

  killAll() {
    this.voices.forEach(v => this.fadeOutVoice(v));
    this.voices = [];
  }

  startDrone(rootMidi, texture, harmonics) {
    this.killAll();
    const vv = [];
    vv.push(this.createVoice(this.freq(rootMidi), texture, 0.22));
    const map = {
      "fifth": 7, "octave": 12, "octaveDown": -12, "fourth": 5,
      "maj3": 4, "min3": 3,
      "triadMaj": [4, 7], "triadMin": [3, 7], "triadDim": [3, 6], "triadAug": [4, 8],
    };
    harmonics.forEach(h => {
      const v = map[h];
      if (v === undefined) return;
      if (Array.isArray(v)) {
        v.forEach(s => { let m = rootMidi + s; if (m < 48) m += 12; vv.push(this.createVoice(this.freq(m), texture, 0.12)); });
      } else {
        vv.push(this.createVoice(this.freq(rootMidi + v), texture, 0.14));
      }
    });
    this.voices = vv;
  }

  startCustomDrone(midis, texture) {
    this.killAll();
    const amp = Math.min(0.22, 0.55 / Math.max(1, midis.length));
    this.voices = midis.map(m => this.createVoice(this.freq(m), texture, amp));
  }

  // ─── FRETBOARD TAP ──────────────────────────────────────────────────
  playNote(midi, dur = 1.8) {
    if (!this.ctx) return;
    const f = this.freq(midi);
    const n = this.ctx.currentTime;
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(2400, n);
    lp.frequency.exponentialRampToValueAtTime(500, n + 0.6);
    lp.Q.value = 2;
    const oscs = [];
    [1, 2, 3].forEach((h, i) => {
      const o = this.ctx.createOscillator(); o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = f * h + this.drift();
      const g = this.ctx.createGain(); g.gain.value = [0.30, 0.10, 0.04][i];
      o.connect(g); g.connect(lp); oscs.push(o);
    });
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, n);
    env.gain.linearRampToValueAtTime(0.40, n + 0.012);
    env.gain.setTargetAtTime(0.18, n + 0.012, 0.15);
    env.gain.setTargetAtTime(0.001, n + 0.5, dur * 0.35);
    lp.connect(env); env.connect(this.fretBus);
    oscs.forEach(o => { o.start(n); o.stop(n + dur + 0.1); });
  }

  // ─── METRONOME SOUNDS ───────────────────────────────────────────────
  schedClave(when, type = "normal") {
    const isAcc = type === "accent" || type === "count";
    const isGhost = type === "ghost";
    const isCount = type === "count";
    const vol = isGhost ? 0.10 : isAcc ? 0.55 : 0.32;
    const bodyF = isCount ? 1100 : isAcc ? 950 : 800;
    const bpF = isCount ? 3200 : isAcc ? 2800 : 2200;
    const bpQ = isAcc ? 30 : 22;
    const src = this.ctx.createBufferSource(); src.buffer = this.claveNoiseBuf; src.loop = false;
    const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = bpF; bp.Q.value = bpQ;
    const body = this.ctx.createOscillator(); body.type = "sine";
    body.frequency.setValueAtTime(bodyF, when);
    body.frequency.exponentialRampToValueAtTime(bodyF * 0.5, when + 0.02);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(vol * 0.7, when);
    bg.gain.exponentialRampToValueAtTime(0.001, when + 0.055);
    body.connect(bg);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.065);
    src.connect(bp); bp.connect(env); bg.connect(env); env.connect(this.metBus);
    src.start(when); src.stop(when + 0.07); body.start(when); body.stop(when + 0.08);
  }

  schedClaveWood(when, accent = false) {
    if (!this.ctx) return;
    const vol = accent ? 0.42 : 0.35;
    const src = this.ctx.createBufferSource(); src.buffer = this.claveNoiseBuf; src.loop = false;
    const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = accent ? 2600 : 2400; bp.Q.value = 18;
    const body = this.ctx.createOscillator(); body.type = "sine";
    body.frequency.setValueAtTime(accent ? 1100 : 980, when);
    body.frequency.exponentialRampToValueAtTime(accent ? 550 : 480, when + 0.018);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(vol * 0.65, when);
    bg.gain.exponentialRampToValueAtTime(0.001, when + 0.045);
    body.connect(bg);
    const h2 = this.ctx.createOscillator(); h2.type = "sine";
    h2.frequency.setValueAtTime(accent ? 2200 : 1960, when);
    h2.frequency.exponentialRampToValueAtTime(accent ? 1100 : 960, when + 0.012);
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(vol * 0.2, when);
    hg.gain.exponentialRampToValueAtTime(0.001, when + 0.025);
    h2.connect(hg);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.055);
    src.connect(bp); bp.connect(env); bg.connect(env); hg.connect(env);
    env.connect(this.metBus);
    src.start(when); src.stop(when + 0.06); body.start(when); body.stop(when + 0.06);
    h2.start(when); h2.stop(when + 0.04);
  }

  schedClavePulse(when) {
    if (!this.ctx) return;
    const vol = 0.16;
    const body = this.ctx.createOscillator(); body.type = "sine";
    body.frequency.setValueAtTime(420, when);
    body.frequency.exponentialRampToValueAtTime(200, when + 0.025);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(vol, when);
    bg.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
    body.connect(bg); bg.connect(this.metBus);
    body.start(when); body.stop(when + 0.07);
  }

  // ─── TRANSITION CHIMES ──────────────────────────────────────────────
  _chimeTone(freq, when, dur, vol, pan = 0) {
    const ctx = this.ctx;
    const mix = ctx.createGain(); mix.gain.value = 0;
    const panner = ctx.createStereoPanner(); panner.pan.value = pan;
    mix.connect(panner); panner.connect(this.master);
    const oscs = [];
    [{ type: "sine", f: freq, v: vol }, { type: "sine", f: freq * 1.002, v: vol * 0.7 }, { type: "triangle", f: freq * 2, v: vol * 0.15 }].forEach(p => {
      const o = ctx.createOscillator(); o.type = p.type; o.frequency.value = p.f;
      const g = ctx.createGain(); g.gain.value = p.v; o.connect(g); g.connect(mix); oscs.push(o);
    });
    mix.gain.setValueAtTime(0, when);
    mix.gain.linearRampToValueAtTime(vol, when + 0.02);
    mix.gain.setTargetAtTime(vol * 0.6, when + 0.02, dur * 0.2);
    mix.gain.setTargetAtTime(0.0001, when + dur * 0.4, dur * 0.35);
    oscs.forEach(o => { o.start(when); o.stop(when + dur + 0.2); });
  }

  _pentatonic(rootMidi) {
    const pent = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const base = rootMidi % 12;
    const oct4 = base + 60;
    return pent.map(s => this.freq(oct4 + s));
  }

  playBreakChime(rootMidi) {
    if (!this.ctx) return;
    const n = this.ctx.currentTime;
    const freqs = this._pentatonic(rootMidi != null ? rootMidi : 0);
    const starts = [6, 5, 4, 3];
    const si = starts[Math.floor(Math.random() * starts.length)];
    const pat = [freqs[si], freqs[si - 1], freqs[si - 2], freqs[si - 3]];
    pat.forEach((f, i) => { this._chimeTone(f, n + i * 0.22, 1.8 - i * 0.3, 0.12 - i * 0.015, (i - 1.5) / 3); });
  }

  playResumeChime(rootMidi) {
    if (!this.ctx) return;
    const n = this.ctx.currentTime;
    const freqs = this._pentatonic(rootMidi != null ? rootMidi : 0);
    const starts = [0, 1, 2];
    const si = starts[Math.floor(Math.random() * starts.length)];
    const pat = [freqs[si], freqs[si + 1], freqs[si + 2], freqs[si + 3], freqs[si + 4]];
    pat.forEach((f, i) => { this._chimeTone(f, n + i * 0.14, 1.4, 0.08 + i * 0.012, (i - 2) / 4); });
  }

  playCycleChime(rootMidi) {
    if (!this.ctx) return;
    const n = this.ctx.currentTime;
    const freqs = this._pentatonic(rootMidi != null ? rootMidi : 0);
    const chord = [freqs[0], freqs[2], freqs[4], freqs[5]];
    chord.forEach((f, i) => { this._chimeTone(f, n + i * 0.06, 2.2, 0.09, (i - 1.5) / 3); });
    this._chimeTone(freqs[8] || freqs[5] * 2, n + 0.3, 2.5, 0.04, 0);
  }

  // ─── PINK NOISE SYSTEM ──────────────────────────────────────────────
  startNoise(level = 0.25, tone = 0) {
    if (!this.ctx || this.noiseSource) return;
    const n = this.ctx.currentTime;
    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = this.pinkBuf;
    this.noiseSource.loop = true;
    this.noiseHP = this.ctx.createBiquadFilter(); this.noiseHP.type = "highpass"; this.noiseHP.frequency.value = 50; this.noiseHP.Q.value = 0.7;
    this.noiseLP = this.ctx.createBiquadFilter(); this.noiseLP.type = "lowpass"; this.noiseLP.frequency.value = 10000; this.noiseLP.Q.value = 0.5;
    this.noiseLo = this.ctx.createBiquadFilter(); this.noiseLo.type = "lowshelf"; this.noiseLo.frequency.value = 250;
    this.noiseHi = this.ctx.createBiquadFilter(); this.noiseHi.type = "highshelf"; this.noiseHi.frequency.value = 3000;
    this._applyNoiseTone(tone);
    this.noiseRes = this.ctx.createBiquadFilter(); this.noiseRes.type = "peaking";
    this.noiseRes.frequency.value = 80; this.noiseRes.Q.value = 0.8; this.noiseRes.gain.value = 0;
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.setValueAtTime(0, n);
    this.noiseGain.gain.linearRampToValueAtTime(level, n + 0.3);
    this.noiseSource.connect(this.noiseHP);
    this.noiseHP.connect(this.noiseLP);
    this.noiseLP.connect(this.noiseLo);
    this.noiseLo.connect(this.noiseHi);
    this.noiseHi.connect(this.noiseRes);
    this.noiseRes.connect(this.noiseGain);
    this.noiseGain.connect(this.noiseBus);
    this.noiseBus.gain.setValueAtTime(1, n);
    this.noiseSource.start(n);
  }

  stopNoise() {
    if (!this.ctx || !this.noiseSource) return;
    const n = this.ctx.currentTime;
    this.noiseGain.gain.cancelScheduledValues(n);
    this.noiseGain.gain.setValueAtTime(this.noiseGain.gain.value, n);
    this.noiseGain.gain.linearRampToValueAtTime(0, n + 0.3);
    const src = this.noiseSource;
    const nodes = [this.noiseHP, this.noiseLP, this.noiseLo, this.noiseHi, this.noiseRes, this.noiseGain];
    this.noiseSource = null; this.noiseGain = null; this.noiseHP = null;
    this.noiseLP = null; this.noiseLo = null; this.noiseHi = null; this.noiseRes = null;
    setTimeout(() => {
      try { src.stop(); src.disconnect(); } catch (e) { /* ignore */ }
      nodes.forEach(nd => { try { nd.disconnect(); } catch (e) { /* ignore */ } });
    }, 400);
  }

  setNoiseLevel(level) {
    if (!this.noiseGain) return;
    this.noiseGain.gain.linearRampToValueAtTime(level, this.ctx.currentTime + 0.05);
  }

  _applyNoiseTone(tone) {
    const loGain = tone * -8;
    const hiGain = tone > 0 ? tone * 6 : tone * 10;
    if (this.noiseLo) this.noiseLo.gain.value = loGain;
    if (this.noiseHi) this.noiseHi.gain.value = hiGain;
  }

  setNoiseTone(tone) {
    if (!this.noiseLo || !this.noiseHi) return;
    const n = this.ctx.currentTime + 0.08;
    const loGain = tone * -8;
    const hiGain = tone > 0 ? tone * 6 : tone * 10;
    this.noiseLo.gain.linearRampToValueAtTime(loGain, n);
    this.noiseHi.gain.linearRampToValueAtTime(hiGain, n);
  }

  setNoiseRoot(freq) {
    if (!this.noiseRes) return;
    const n = this.ctx.currentTime + 0.15;
    if (freq > 0) {
      this.noiseRes.frequency.linearRampToValueAtTime(freq, n);
      this.noiseRes.Q.linearRampToValueAtTime(0.8, n);
      this.noiseRes.gain.linearRampToValueAtTime(5, n);
    } else {
      this.noiseRes.gain.linearRampToValueAtTime(0, n);
    }
  }
}
