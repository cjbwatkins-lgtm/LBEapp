import { SYNTH_MAP } from './synths.js';
import {
  CLAVE_44, CLAVE_44_PULSE, CLAVE_44_STEPS,
  CLAVE_68, CLAVE_68_PULSE, CLAVE_68_STEPS,
} from '../constants/metro.js';

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SUBDIV_MULT = { none: 1, "8th": 2, trip: 3, "16th": 4, quint: 5, sext: 6, sept: 7, "32nd": 8 };

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
    // Drone tone
    this.droneToneLo = null;
    this.droneToneHi = null;
    // Met tone
    this.metToneLo = null;
    this.metToneHi = null;
    // Drone state
    this._droneTimer = null;
    // Metronome state
    this._metTimer = null;
    this._metConfig = null;
    this._metCb = null;
  }

  init() {
    if (this.ready) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // iOS/Safari: AudioContext starts suspended — resume on first user gesture.
    // Uses a persistent listener so late boots still catch the first tap.
    const _unlock = () => {
      if (this.ctx?.state === 'suspended') this.ctx.resume();
    };
    document.addEventListener('pointerdown', _unlock, { passive: true });
    document.addEventListener('touchstart',  _unlock, { passive: true });
    // Clean up once running
    const _cleanup = () => {
      if (this.ctx?.state === 'running') {
        document.removeEventListener('pointerdown', _unlock);
        document.removeEventListener('touchstart',  _unlock);
        document.removeEventListener('statechange', _cleanup);
      }
    };
    this.ctx.addEventListener('statechange', _cleanup);

    // Noise buffers
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    { const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

    this.claveNoiseBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * 0.05), this.ctx.sampleRate);
    { const d = this.claveNoiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

    // Medical-grade pink noise: extended Voss-McCartney with 7 poles + DC block
    {
      const len = this.ctx.sampleRate * 30;
      this.pinkBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.pinkBuf.getChannelData(0);
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,b7=0,b8=0;
      let dcPrev = 0, dcOut = 0;
      let peak = 0;
      // First pass: generate raw pink
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886*b0 + w*0.0555179;
        b1 = 0.99332*b1 + w*0.0750759;
        b2 = 0.96900*b2 + w*0.1538520;
        b3 = 0.86650*b3 + w*0.3104856;
        b4 = 0.55000*b4 + w*0.5329522;
        b5 = -0.7616*b5 - w*0.0168980;
        b7 = 0.99780*b7 + w*0.0108690;
        b8 = 0.99980*b8 + w*0.0022230;
        const raw = (b0+b1+b2+b3+b4+b5+b6+b7+b8+w*0.5362)*0.011;
        b6 = w*0.115926;
        // DC blocking filter
        dcOut = raw - dcPrev + 0.9999*dcOut;
        dcPrev = raw;
        d[i] = dcOut;
        if (Math.abs(dcOut) > peak) peak = Math.abs(dcOut);
      }
      // Normalize to -3dBFS
      const norm = 0.707 / (peak || 1);
      for (let i = 0; i < len; i++) d[i] *= norm;
    }

    // Glue compressor — gentle "glue", not limiting
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -24; this.comp.knee.value = 22;
    this.comp.ratio.value = 1.6; this.comp.attack.value = 0.012; this.comp.release.value = 0.32;

    // Master volume
    this.master = this.ctx.createGain(); this.master.gain.value = 0.72;

    // Buses — metronome sits slightly hotter so clicks cut through any drone texture
    this.droneBus = this.ctx.createGain(); this.droneBus.gain.value = 0.50;
    this.metBus   = this.ctx.createGain(); this.metBus.gain.value   = 0.60;
    this.fretBus  = this.ctx.createGain(); this.fretBus.gain.value  = 0.52;
    this.noiseBus = this.ctx.createGain(); this.noiseBus.gain.value = 0;

    // Drone tone: sub-weight shelf (150Hz) + harmonic-presence shelf (3kHz)
    // Placed at the true spectral extremes of bass — lo controls sub weight,
    // hi controls harmonic shimmer; midrange (200Hz-2.5kHz) stays untouched at center
    this.droneToneLo = this.ctx.createBiquadFilter();
    this.droneToneLo.type = "lowshelf"; this.droneToneLo.frequency.value = 150; this.droneToneLo.gain.value = 0;
    this.droneToneHi = this.ctx.createBiquadFilter();
    this.droneToneHi.type = "highshelf"; this.droneToneHi.frequency.value = 3000; this.droneToneHi.gain.value = 0;

    // Met tone: body shelf (400Hz) + snap shelf (4kHz)
    // Click energy is 800-3000Hz; shelves bracket it cleanly
    this.metToneLo = this.ctx.createBiquadFilter();
    this.metToneLo.type = "lowshelf"; this.metToneLo.frequency.value = 400; this.metToneLo.gain.value = 0;
    this.metToneHi = this.ctx.createBiquadFilter();
    this.metToneHi.type = "highshelf"; this.metToneHi.frequency.value = 4000; this.metToneHi.gain.value = 0;

    this.droneBus.connect(this.droneToneLo);
    this.droneToneLo.connect(this.droneToneHi);
    this.droneToneHi.connect(this.master);

    this.metBus.connect(this.metToneLo);
    this.metToneLo.connect(this.metToneHi);
    this.metToneHi.connect(this.master);

    this.fretBus.connect(this.master);
    this.noiseBus.connect(this.master);

    // Master chain: HP → tilt → comp → limiter → destination
    this.hp   = this.ctx.createBiquadFilter(); this.hp.type = "highpass"; this.hp.frequency.value = 28; this.hp.Q.value = 0.7;
    this.tilt = this.ctx.createBiquadFilter(); this.tilt.type = "lowshelf"; this.tilt.frequency.value = 140; this.tilt.gain.value = 1.5;
    this.lim  = this.ctx.createDynamicsCompressor();
    this.lim.threshold.value = -7; this.lim.knee.value = 1;
    this.lim.ratio.value = 18; this.lim.attack.value = 0.001; this.lim.release.value = 0.06;

    this.master.connect(this.hp);
    this.hp.connect(this.tilt);
    this.tilt.connect(this.comp);
    this.comp.connect(this.lim);
    this.lim.connect(this.ctx.destination);
    this.ready = true;
  }

  // ─── VOLUME CONTROLS ────────────────────────────────────────────────
  setMasterVolume(v) { if (this.master) this.master.gain.value = v; }
  setDroneVolume(v)  { if (this.droneBus) this.droneBus.gain.value = v; }
  setMetVolume(v)    { if (this.metBus) this.metBus.gain.value = v; }

  // ─── TONE CONTROLS ──────────────────────────────────────────────────
  // Symmetric complementary tilt EQ: dark = lo+GAIN/hi-GAIN, bright = lo-GAIN/hi+GAIN.
  // Midrange energy is preserved in both directions.
  // Direct .value assignment — filter coefficient updates are inherently artifact-free;
  // no scheduled ramps needed and they cause zipper noise during knob dragging.

  setDroneTone(tone) {
    if (!this.droneToneLo) return;
    this.droneToneLo.gain.value = -tone * 12;
    this.droneToneHi.gain.value =  tone * 12;
  }

  setMetTone(tone) {
    if (!this.metToneLo) return;
    this.metToneLo.gain.value = -tone * 12;
    this.metToneHi.gain.value =  tone * 12;
  }

  // ─── HELPERS ────────────────────────────────────────────────────────
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

  fadeOutVoice(v, fast = false) {
    if (!v) return;
    const n = this.ctx.currentTime;
    const rel = fast ? 0.05 : 0.9;
    try {
      v.env.gain.cancelScheduledValues(n);
      v.env.gain.linearRampToValueAtTime(0.0001, n + rel);
    } catch (e) { /* ignore */ }
    setTimeout(() => {
      v.parts?.forEach(p => { try { p.osc.stop(); p.osc.disconnect(); } catch (e) { /* ignore */ } });
      v.nodes?.forEach(nd => { try { nd.disconnect(); } catch (e) { /* ignore */ } });
      try { v.env.disconnect(); } catch (e) { /* ignore */ }
    }, (rel + 0.15) * 1000);
  }

  killAll(fast = false) {
    this.voices.forEach(v => this.fadeOutVoice(v, fast));
    this.voices = [];
  }

  // ─── DRONE ──────────────────────────────────────────────────────────
  startDrone(root, oct, texture, notes, mode) {
    if (this._droneTimer) { clearTimeout(this._droneTimer); this._droneTimer = null; }
    this.killAll(true); // fast fade so old sound clears before new one begins

    const noteI = NOTES.indexOf(root);
    const rootMidi = noteI >= 0 ? noteI + 12 * (oct + 1) : 40;

    const noteToMidi = (name) => {
      const ni = NOTES.indexOf(name);
      if (ni < 0) return null;
      let m = ni + 12 * (oct + 1);
      while (m <= rootMidi) m += 12;
      return m;
    };

    this._droneTimer = setTimeout(() => {
      this._droneTimer = null;
      const vv = [];

      if (mode === "custom" && notes && notes.length > 0) {
        const amp = Math.min(0.22, 0.55 / notes.length);
        notes.forEach(n => {
          const m = typeof n === "number" ? n : (() => {
            const ni = NOTES.indexOf(n);
            if (ni < 0) return null;
            let v = ni + 12 * (oct + 1);
            while (v < rootMidi - 6) v += 12;
            while (v > rootMidi + 18) v -= 12;
            return v;
          })();
          if (m === null) return;
          vv.push(this.createVoice(this.freq(m), texture, amp));
        });
      } else {
        vv.push(this.createVoice(this.freq(rootMidi), texture, 0.22));
        if (notes && notes.length > 0) {
          const seen = new Set([rootMidi % 12]);
          const harmNotes = notes.filter(Boolean);
          const amp = Math.min(0.14, 0.42 / Math.max(1, harmNotes.length));
          harmNotes.forEach(n => {
            const m = noteToMidi(n);
            if (m === null) return;
            const pc = m % 12;
            if (seen.has(pc)) return; // skip octave duplicates of existing voices
            seen.add(pc);
            vv.push(this.createVoice(this.freq(m), texture, amp));
          });
        }
      }

      if (vv.length === 0) vv.push(this.createVoice(this.freq(rootMidi), texture, 0.22));
      this.voices = vv;
    }, 60);
  }

  stopDrone() {
    if (this._droneTimer) { clearTimeout(this._droneTimer); this._droneTimer = null; }
    this.killAll();
  }

  // ─── FRETBOARD TAP ──────────────────────────────────────────────────
  playNote(midi, dur = 1.8) {
    if (!this.ctx) return;
    const f = this.freq(midi);
    const n = this.ctx.currentTime;

    // LP filter sweep — open bright attack, settles to warm sustain
    // Less aggressive sweep than before: doesn't get so dark so fast
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(2200, n);
    lp.frequency.exponentialRampToValueAtTime(700, n + 0.9);

    // Harmonic series: triangle fundamental + sine harmonics
    [[1, "triangle", 0.28], [2, "sine", 0.10], [3, "sine", 0.04]].forEach(([h, type, vol]) => {
      const o = this.ctx.createOscillator(); o.type = type;
      o.frequency.value = f * h + this.drift();
      const g = this.ctx.createGain(); g.gain.value = vol;
      o.connect(g); g.connect(lp);
      o.start(n); o.stop(n + dur + 0.15);
    });

    // Gentle body resonance — gives the note some "wood" character
    const pk = this.ctx.createBiquadFilter(); pk.type = "peaking";
    pk.frequency.value = Math.min(f * 1.5, 800); pk.Q.value = 0.9; pk.gain.value = 3;
    lp.connect(pk);

    // Envelope: punchy attack, quick initial settle, natural decay
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, n);
    env.gain.linearRampToValueAtTime(0.34, n + 0.010);    // snap
    env.gain.setTargetAtTime(0.16, n + 0.010, 0.12);      // settle
    env.gain.setTargetAtTime(0.001, n + 0.45, dur * 0.28); // decay
    pk.connect(env); env.connect(this.fretBus);
  }

  // noteClass is 0-11 (C=0 … B=11), played in bass register
  playChime(noteClass, dur = 1.0) {
    if (!this.ctx) return;
    this.playNote(36 + (((noteClass % 12) + 12) % 12), dur);
  }

  // ─── PAUSE / RESUME ─────────────────────────────────────────────────
  pauseAll()  { if (this.ctx) this.ctx.suspend(); }
  resumeAll() { if (this.ctx) this.ctx.resume(); }

  // ─── METRONOME ──────────────────────────────────────────────────────
  setMetronomeCallback(cb) { this._metCb = cb; }

  configMetronome(config) { this._metConfig = config; }

  startMetronome() {
    this.stopMetronome();
    if (!this.ctx || !this._metConfig) return;
    if (this._metConfig.clave) {
      this._startClaveScheduler();
    } else {
      this._startStandardScheduler();
    }
  }

  stopMetronome() {
    if (this._metTimer) { clearInterval(this._metTimer); this._metTimer = null; }
  }

  _startStandardScheduler() {
    let nextNoteTime = this.ctx.currentTime + 0.05;
    let currentSubdiv = 0;
    let barCount = 0;
    let countInBarsLeft = this._metConfig.countIn ? 1 : 0;
    let totalBarsPlayed = 0;
    let currentBpm = this._metConfig.bpm;

    const sched = () => {
      const c = this._metConfig;
      if (!c) return;
      const beatsPerBar = c.n || 4;
      const subdivMult = SUBDIV_MULT[c.subdiv] || 1;
      const totalSubdivsPerBar = beatsPerBar * subdivMult;
      if (currentSubdiv >= totalSubdivsPerBar) currentSubdiv = 0;

      currentBpm = c.bpm;
      if (c.rampMode !== "off") {
        const p = Math.min(totalBarsPlayed / c.rampBars, 1);
        const curve = c.rampMode === "expo" ? p * p : p;
        currentBpm = Math.round(c.bpm + (c.rampEnd - c.bpm) * curve);
      }

      const b = Math.floor(currentSubdiv / subdivMult);
      const s = currentSubdiv % subdivMult;

      const isGapBar = (bar) => {
        if (c.gapBars <= 0) return false;
        const silent = c.gapSilent || c.gapBars;
        return (bar % (c.gapBars + silent)) >= c.gapBars;
      };
      const gap = countInBarsLeft <= 0 && isGapBar(barCount);

      const shouldSound = (bt, sb) => {
        if (countInBarsLeft > 0) return sb === 0;
        // Dot state 0 = silent on main beats in all modes
        if (sb === 0 && c.customAccents?.[bt] === 0) return false;
        if (c.clickMode === "all") return true;
        if (c.clickMode === "24")     return sb === 0 ? (bt === 1 || bt === 3) : true;
        if (c.clickMode === "13")     return sb === 0 ? (bt === 0 || bt === 2) : true;
        if (c.clickMode === "1only")  return sb === 0 ? bt === 0 : true;
        if (c.clickMode === "offbeat") return sb === 0 ? bt !== 0 : true;
        if (c.clickMode === "custom") return true;
        return true;
      };

      const getClickType = (bt, sb) => {
        if (countInBarsLeft > 0) return "count";
        if (sb !== 0) return "ghost";
        const em = c.beatEmphasis?.[bt] || 0;
        if (em === 1) return "accent";
        if (em === 2) return "ghost";
        // Dot state controls accent in all modes
        if (c.customAccents?.[bt] !== undefined)
          return c.customAccents[bt] === 2 ? "accent" : "normal";
        if (c.clickMode === "24" && (bt === 1 || bt === 3)) return "accent";
        if (c.clickMode === "13" && (bt === 0 || bt === 2)) return "accent";
        if (bt === 0) return "accent";
        return "normal";
      };

      if (!gap && shouldSound(b, s)) this.schedClave(nextNoteTime, getClickType(b, s));

      if (s === 0) {
        this._metCb?.(b, barCount, { rampBpm: currentBpm });
      }

      nextNoteTime += 60.0 / currentBpm / subdivMult;
      currentSubdiv++;
      if (currentSubdiv >= totalSubdivsPerBar) {
        currentSubdiv = 0;
        if (countInBarsLeft > 0) countInBarsLeft--;
        else { barCount++; totalBarsPlayed++; }
      }
    };

    this._metTimer = setInterval(() => {
      while (nextNoteTime < this.ctx.currentTime + 0.1) sched();
    }, 25);
  }

  _startClaveScheduler() {
    const c0 = this._metConfig;
    const is68 = c0.clave?.feel === "68";
    const totalSteps = is68 ? CLAVE_68_STEPS : CLAVE_44_STEPS;
    const stepsPerBar = is68 ? 6 : 8;

    const getPattern = (c) => {
      if (is68) return CLAVE_68[c.clave?.pat68] || CLAVE_68.clave68;
      const key = (c.clave?.type === "rumba" ? "rumba" : "son") + (c.clave?.dir === "23" ? "23" : "32");
      return CLAVE_44[key] || CLAVE_44.son32;
    };
    const pulseArr = is68 ? CLAVE_68_PULSE : CLAVE_44_PULSE;
    const pulseSet = new Set(pulseArr);

    let countInLeft = c0.clave?.countIn ? stepsPerBar : 0;
    let nextTime = this.ctx.currentTime + 0.05;
    let step = 0;
    let cycleCount = 0;

    const sched = () => {
      const c = this._metConfig;
      if (!c || !c.clave) return;
      const stepDur = is68 ? (60.0 / c.bpm / 3) : (60.0 / c.bpm / 4);
      const pattern = getPattern(c);
      const patSet = new Set(pattern);

      if (countInLeft > 0) {
        const ciPulse = is68 ? (step % 6 === 0) : (step % 4 === 0);
        if (ciPulse) this.schedClave(nextTime, "count");
        const beatInBar = is68 ? Math.floor(step / 3) : Math.floor(step / 4);
        const visTrigger = is68 ? (step % 3 === 0) : (step % 4 === 0);
        if (visTrigger) this._metCb?.(beatInBar, 0, { clave: 0 });
        nextTime += stepDur; step++;
        if (step >= stepsPerBar) { step = 0; countInLeft = 0; }
        return;
      }

      const isClaveHit = patSet.has(step);
      const isPulseHit = c.clave.pulse && pulseSet.has(step);
      const isFirst = step === pattern[0];
      if (isClaveHit) this.schedClaveWood(nextTime, isFirst);
      if (isPulseHit) this.schedClavePulse(nextTime);

      const bar = Math.floor(step / stepsPerBar);
      const beatInBar = is68 ? Math.floor((step % stepsPerBar) / 3) : Math.floor((step % stepsPerBar) / 4);
      const visTrigger = is68 ? (step % 3 === 0) : (step % 4 === 0);
      if (visTrigger) this._metCb?.(beatInBar, cycleCount * 2 + bar, { clave: bar + 1 });

      nextTime += stepDur; step++;
      if (step >= totalSteps) { step = 0; cycleCount++; }
    };

    this._metTimer = setInterval(() => {
      while (nextTime < this.ctx.currentTime + 0.1) sched();
    }, 25);
  }

  // ─── METRONOME SOUNDS ───────────────────────────────────────────────
  schedClave(when, type = "normal") {
    const isAcc = type === "accent" || type === "count";
    const isGhost = type === "ghost";
    const isCount = type === "count";

    // Volume — ghosts are clearly audible subdivisions, not invisible
    const vol = isGhost ? 0.14 : isAcc ? 0.52 : 0.28;

    // Noise transient: the "attack" of the click
    // Wide Q (7-10) sounds natural — narrow Q creates annoying ring
    const src = this.ctx.createBufferSource(); src.buffer = this.claveNoiseBuf; src.loop = false;
    const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.value = isAcc ? 2400 : isGhost ? 1200 : 1700;
    bp.Q.value = isGhost ? 5 : 8;

    // Sine body: the pitched "thock" character
    const body = this.ctx.createOscillator(); body.type = "sine";
    const bodyF = isCount ? 1080 : isAcc ? 920 : 740;
    body.frequency.setValueAtTime(bodyF, when);
    body.frequency.exponentialRampToValueAtTime(bodyF * 0.42, when + 0.016);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(vol * 0.52, when);
    bg.gain.exponentialRampToValueAtTime(0.001, when + 0.038);
    body.connect(bg);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + (isGhost ? 0.040 : 0.055));
    src.connect(bp); bp.connect(env); bg.connect(env);

    // Accent/count only: sub-thump gives physical weight without harshness
    if (isAcc) {
      const sub = this.ctx.createOscillator(); sub.type = "sine";
      sub.frequency.setValueAtTime(isCount ? 115 : 88, when);
      sub.frequency.exponentialRampToValueAtTime(38, when + 0.028);
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0.22, when);
      sg.gain.exponentialRampToValueAtTime(0.001, when + 0.050);
      sub.connect(sg); sg.connect(env);
      sub.start(when); sub.stop(when + 0.055);
    }

    env.connect(this.metBus);
    src.start(when); src.stop(when + 0.060);
    body.start(when); body.stop(when + 0.060);
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
    // HP removes sub rumble; LP keeps it below Nyquist without colouring
    this.noiseHP  = this.ctx.createBiquadFilter(); this.noiseHP.type = "highpass"; this.noiseHP.frequency.value = 30; this.noiseHP.Q.value = 0.5;
    this.noiseLP  = this.ctx.createBiquadFilter(); this.noiseLP.type = "lowpass"; this.noiseLP.frequency.value = 18000; this.noiseLP.Q.value = 0.5;
    // Tone tilt: lo shelf at 500Hz (rumble weight), hi shelf at 4kHz (hiss/air)
    // No mid-peaking filter — it adds resonance coloration to noise
    this.noiseLo  = this.ctx.createBiquadFilter(); this.noiseLo.type = "lowshelf"; this.noiseLo.frequency.value = 500;
    this.noiseHi  = this.ctx.createBiquadFilter(); this.noiseHi.type = "highshelf"; this.noiseHi.frequency.value = 4000;
    this._applyNoiseTone(tone);
    // Root-tracking resonance bump (subtle, follows drone root)
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
    if (this.noiseLo) this.noiseLo.gain.value = -tone * 14;
    if (this.noiseHi) this.noiseHi.gain.value =  tone * 14;
  }

  setNoiseTone(tone) {
    if (!this.noiseLo) return;
    this._applyNoiseTone(tone);
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
