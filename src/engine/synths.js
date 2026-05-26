// ─── SYNTHESIZER VOICE FACTORIES ────────────────────────────────────────────
// Each function receives (engine, freq, amp) and returns { parts[], env, nodes[] }
// engine provides: ctx, droneBus, noiseBuf, claveNoiseBuf, drift(), partial(), makeSaturator()

export function synthDeepEarth(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;

  // Sub-fundamental layer — rumble
  const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = f * 0.5;
  const g1 = ctx.createGain(); g1.gain.value = 0.38;
  o1.connect(g1);

  // Fundamental
  const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f;
  const g2 = ctx.createGain(); g2.gain.value = 0.28;
  o2.connect(g2);

  // 2nd harmonic — warmth
  const o3 = ctx.createOscillator(); o3.type = "sine"; o3.frequency.value = f * 2;
  const g3 = ctx.createGain(); g3.gain.value = 0.05;
  o3.connect(g3);

  // Very slow filter breath — 0.06Hz is one full cycle per ~17s
  const fLfo = ctx.createOscillator(); fLfo.type = "sine"; fLfo.frequency.value = 0.06;
  const fLfoG = ctx.createGain(); fLfoG.gain.value = 80;
  fLfo.connect(fLfoG);

  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 280; lp.Q.value = 0.5;
  fLfoG.connect(lp.frequency);
  g1.connect(lp); g2.connect(lp); g3.connect(lp);

  // Gentle saturation for warmth, not distortion
  const ws = ctx.createWaveShaper(); const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 1.8); }
  ws.curve = curve; ws.oversample = "4x";
  lp.connect(ws);

  // Sub-bass shelf boost
  const ls = ctx.createBiquadFilter(); ls.type = "lowshelf"; ls.frequency.value = 60; ls.gain.value = 6;
  ws.connect(ls);

  // Slow amplitude swell — deep sounds bloom over 3s
  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.4, n + 0.8);
  env.gain.linearRampToValueAtTime(amp, n + 3.0);
  ls.connect(env); env.connect(droneBus);

  [o1, o2, o3, fLfo].forEach(o => o.start(n));
  return { parts: [{ osc: o1, gain: g1 }, { osc: o2, gain: g2 }, { osc: o3, gain: g3 }, { osc: fLfo, gain: fLfoG }], env, nodes: [lp, ws, ls] };
}

export function synthVintageWarmth(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;

  // Dual slightly-detuned sawtooth for "ensemble" thickness
  const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = f; o1.detune.value = +6;
  const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = f; o2.detune.value = -8;
  const o3 = ctx.createOscillator(); o3.type = "triangle"; o3.frequency.value = f * 0.5;

  const g1 = ctx.createGain(); g1.gain.value = 0.22; o1.connect(g1);
  const g2 = ctx.createGain(); g2.gain.value = 0.20; o2.connect(g2);
  const g3 = ctx.createGain(); g3.gain.value = 0.12; o3.connect(g3);

  // Warm LP — 1400Hz is open enough to sound present, not muffled
  const lp1 = ctx.createBiquadFilter(); lp1.type = "lowpass"; lp1.frequency.value = 1400; lp1.Q.value = 0.6;
  const lp2 = ctx.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 1700; lp2.Q.value = 0.45;
  g1.connect(lp1); g2.connect(lp1); g3.connect(lp1);
  lp1.connect(lp2);

  const ls = ctx.createBiquadFilter(); ls.type = "lowshelf"; ls.frequency.value = 180; ls.gain.value = 2;
  const hs = ctx.createBiquadFilter(); hs.type = "highshelf"; hs.frequency.value = 3500; hs.gain.value = -5;
  lp2.connect(ls); ls.connect(hs);

  // Mild tape-style saturation
  const sat = eng.makeSaturator(1.15); hs.connect(sat.in);

  // Chorus: fixed delay ≈8ms + LFO ±3ms. Fixed Hz range (not proportional to freq)
  const d = ctx.createDelay(0.05); d.delayTime.value = 0.008;
  const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.22;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.003; // ±3ms
  lfo.connect(lfoG); lfoG.connect(d.delayTime);
  const dMix = ctx.createGain(); dMix.gain.value = 0.25;
  sat.out.connect(d); d.connect(dMix);

  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.4, n + 0.3);
  env.gain.linearRampToValueAtTime(amp, n + 2.0);
  sat.out.connect(env); dMix.connect(env); env.connect(droneBus);

  [o1, o2, o3, lfo].forEach(o => o.start(n));
  return { parts: [{ osc: o1, gain: g1 }, { osc: o2, gain: g2 }, { osc: o3, gain: g3 }, { osc: lfo, gain: lfoG }], env, nodes: [lp1, lp2, ls, hs, sat.ws, d, dMix] };
}

export function synthSilkBow(eng, f, amp) {
  const { ctx, droneBus, noiseBuf } = eng;
  const n = ctx.currentTime;

  // Bowed string harmonic series — odd harmonics slightly louder (bowed quality)
  const body = ctx.createBiquadFilter(); body.type = "lowpass"; body.frequency.value = 3000; body.Q.value = 0.3;
  const harms = [[f, 0.30], [f * 2, 0.09], [f * 3, 0.16], [f * 4, 0.04], [f * 5, 0.09], [f * 6, 0.02]];
  const parts = harms.map(([freq, vol]) => eng.partial(freq, vol, body));

  // Vibrato — slow onset, authentic 5.2Hz
  const vib = ctx.createOscillator(); vib.type = "sine"; vib.frequency.value = 5.2;
  const vibD = ctx.createGain(); vibD.gain.setValueAtTime(0, n);
  vibD.gain.linearRampToValueAtTime(f * 0.005, n + 2.2); // gradual onset
  vib.connect(vibD); parts.forEach(p => vibD.connect(p.osc.frequency));

  // Bow noise — bandpass centred at 2nd harmonic, very quiet
  const noise = ctx.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
  const nbp = ctx.createBiquadFilter(); nbp.type = "bandpass"; nbp.frequency.value = f * 2; nbp.Q.value = 0.6;
  const ng = ctx.createGain(); ng.gain.value = 0.012;
  noise.connect(nbp); nbp.connect(ng); ng.connect(body);

  // Bow pressure variation (slow swell)
  const swLfo = ctx.createOscillator(); swLfo.type = "sine"; swLfo.frequency.value = 0.12;
  const swG = ctx.createGain(); swG.gain.value = 0.04;
  const mix = ctx.createGain(); mix.gain.value = 1.0;
  swLfo.connect(swG); swG.connect(mix.gain); body.connect(mix);

  // Presence peak for "body resonance" character
  const pk = ctx.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 380; pk.Q.value = 0.5; pk.gain.value = 2.5;
  mix.connect(pk);

  // Short delay reverb — small room character
  const d1 = ctx.createDelay(0.5); d1.delayTime.value = 0.018;
  const fb1 = ctx.createGain(); fb1.gain.value = 0.12;
  const rlp = ctx.createBiquadFilter(); rlp.type = "lowpass"; rlp.frequency.value = 2200;
  pk.connect(d1); d1.connect(fb1); fb1.connect(d1); d1.connect(rlp);
  const rv = ctx.createGain(); rv.gain.value = 0.14; rlp.connect(rv);

  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.25, n + 0.12);
  env.gain.linearRampToValueAtTime(amp, n + 2.0);
  pk.connect(env); rv.connect(env); env.connect(droneBus);

  parts.forEach(p => p.osc.start(n)); vib.start(n); noise.start(n); swLfo.start(n);
  return { parts: [...parts, { osc: vib, gain: vibD }, { osc: noise, gain: ng }, { osc: swLfo, gain: swG }], env, nodes: [body, nbp, mix, pk, d1, fb1, rlp, rv] };
}

export function synthAiryGlass(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;

  // Slightly inharmonic partials — the acoustic signature of glass
  const freqs = [[f, 0.24], [f * 2.003, 0.14], [f * 3.012, 0.07], [f * 4.007, 0.04], [f * 5.018, 0.02]];
  const parts = freqs.map(([freq, vol]) => {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol; o.connect(g); return { osc: o, gain: g };
  });
  const mix = ctx.createGain(); mix.gain.value = 1;
  parts.forEach(p => p.gain.connect(mix));

  // Gentle air filter
  const hs = ctx.createBiquadFilter(); hs.type = "highshelf"; hs.frequency.value = 3000; hs.gain.value = -5;
  mix.connect(hs);

  // Longer, lush delay reverb — glass rings in a room
  const dl = ctx.createDelay(2); dl.delayTime.value = 0.18;
  const dfb = ctx.createGain(); dfb.gain.value = 0.32;
  const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 3000;
  hs.connect(dl); dl.connect(dlp); dlp.connect(dfb); dfb.connect(dl);
  const wet = ctx.createGain(); wet.gain.value = 0.28; dlp.connect(wet);

  // Very slow shimmer on upper partials
  const shLfo = ctx.createOscillator(); shLfo.type = "sine"; shLfo.frequency.value = 0.07;
  const shG = ctx.createGain(); shG.gain.value = f * 0.0008;
  shLfo.connect(shG); parts.slice(2).forEach(p => shG.connect(p.osc.frequency));

  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.45, n + 0.08);
  env.gain.linearRampToValueAtTime(amp, n + 1.5);
  hs.connect(env); wet.connect(env); env.connect(droneBus);

  parts.forEach(p => p.osc.start(n)); shLfo.start(n);
  return { parts: [...parts, { osc: shLfo, gain: shG }], env, nodes: [mix, hs, dl, dfb, dlp, wet] };
}

export function synthPureBreath(eng, f, amp) {
  const { ctx, droneBus, noiseBuf } = eng;
  const n = ctx.currentTime;

  // Core: fundamental + slight detuning cluster for natural "chorusing"
  const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = f * 0.5;
  const g1 = ctx.createGain(); g1.gain.value = 0.12; o1.connect(g1);

  const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f;
  const g2 = ctx.createGain(); g2.gain.value = 0.26; o2.connect(g2);

  const o3 = ctx.createOscillator(); o3.type = "sine"; o3.frequency.value = f * 1.003;
  const g3 = ctx.createGain(); g3.gain.value = 0.16; o3.connect(g3);

  const o4 = ctx.createOscillator(); o4.type = "sine"; o4.frequency.value = f * 0.998;
  const g4 = ctx.createGain(); g4.gain.value = 0.10; o4.connect(g4);

  const o5 = ctx.createOscillator(); o5.type = "sine"; o5.frequency.value = f * 2;
  const g5 = ctx.createGain(); g5.gain.value = 0.06; o5.connect(g5);

  // Vibrato: 4.5Hz is authentic for breath instruments, delayed onset
  const vib = ctx.createOscillator(); vib.type = "sine"; vib.frequency.value = 4.5;
  const vibG = ctx.createGain(); vibG.gain.value = f * 0.002;
  vib.connect(vibG); vibG.connect(o2.frequency); vibG.connect(o3.frequency);

  // Breath noise — the acoustic signature that makes it feel "alive"
  // Bandpass centred just above the fundamental — sounds like air column resonance
  const noise = ctx.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
  const nbp = ctx.createBiquadFilter(); nbp.type = "bandpass"; nbp.frequency.value = f * 1.8; nbp.Q.value = 0.9;
  const ng = ctx.createGain(); ng.gain.setValueAtTime(0, n);
  ng.gain.linearRampToValueAtTime(0.020, n + 0.8); // breath fades in — like a player settling
  noise.connect(nbp); nbp.connect(ng);

  const ls = ctx.createBiquadFilter(); ls.type = "lowshelf"; ls.frequency.value = 160; ls.gain.value = 3;
  [g1, g2, g3, g4, g5, ng].forEach(g => g.connect(ls));

  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.38, n + 0.5);
  env.gain.linearRampToValueAtTime(amp, n + 2.2);
  ls.connect(env); env.connect(droneBus);

  [o1, o2, o3, o4, o5, vib, noise].forEach(o => o.start(n));
  return { parts: [{ osc: o1, gain: g1 }, { osc: o2, gain: g2 }, { osc: o3, gain: g3 }, { osc: o4, gain: g4 }, { osc: o5, gain: g5 }, { osc: vib, gain: vibG }, { osc: noise, gain: ng }], env, nodes: [ls, nbp] };
}

export function synthOrganPad(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;

  // Drawbar harmonics — classic Hammond B3 registration (16', 8', 5⅓', 4', 2⅔', 2', 1⅓')
  const drawbars = [[f * 0.5, 0.14], [f, 0.30], [f * 1.5, 0.08], [f * 2, 0.20], [f * 3, 0.07], [f * 4, 0.05], [f * 6, 0.02]];
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2800; lp.Q.value = 0.45;
  const parts = drawbars.map(([freq, vol]) => eng.partial(freq, vol, lp));

  // Leslie slow-speed chorus: fixed ±4Hz range for all pitches
  const chorusLfo = ctx.createOscillator(); chorusLfo.type = "sine"; chorusLfo.frequency.value = 0.9;
  const chorusDepth = ctx.createGain(); chorusDepth.gain.value = 4; // 4Hz depth — audible at all frequencies
  chorusLfo.connect(chorusDepth);
  parts.slice(1).forEach(p => chorusDepth.connect(p.osc.frequency));

  // Tremolo: Leslie fast speed ≈6.5Hz
  const tremLfo = ctx.createOscillator(); tremLfo.type = "sine"; tremLfo.frequency.value = 6.5;
  const tremG = ctx.createGain(); tremG.gain.value = 0.035;
  const tremMix = ctx.createGain(); tremMix.gain.value = 1.0;
  tremLfo.connect(tremG); tremG.connect(tremMix.gain);
  lp.connect(tremMix);

  // Organ key click — very short noise burst (authentic Hammond click)
  const clickBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.006), ctx.sampleRate);
  const cd = clickBuf.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (cd.length * 0.12));
  const click = ctx.createBufferSource(); click.buffer = clickBuf;
  const clickF = ctx.createBiquadFilter(); clickF.type = "bandpass"; clickF.frequency.value = 2400; clickF.Q.value = 1.5;
  const clickG = ctx.createGain(); clickG.gain.value = 0.12;
  click.connect(clickF); clickF.connect(clickG);

  // Cabinet simulation: short pre-delay + gentle feedback
  const dl = ctx.createDelay(0.5); dl.delayTime.value = 0.022;
  const dfb = ctx.createGain(); dfb.gain.value = 0.16;
  const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 1600;
  tremMix.connect(dl); dl.connect(dlp); dlp.connect(dfb); dfb.connect(dl);
  const wet = ctx.createGain(); wet.gain.value = 0.14; dlp.connect(wet);

  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.75, n + 0.04);
  env.gain.linearRampToValueAtTime(amp, n + 0.6);
  tremMix.connect(env); wet.connect(env); clickG.connect(env); env.connect(droneBus);

  parts.forEach(p => p.osc.start(n)); chorusLfo.start(n); tremLfo.start(n); click.start(n);
  return { parts: [...parts, { osc: chorusLfo, gain: chorusDepth }, { osc: tremLfo, gain: tremG }], env, nodes: [lp, tremMix, clickF, clickG, dl, dfb, dlp, wet] };
}

export function synthRhodesEP(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;

  // Fundamental (the "tine resonator" fundamental)
  const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = f;
  const g1 = ctx.createGain(); g1.gain.value = 0.32; o1.connect(g1);

  // 2nd partial — octave warmth
  const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.08; o2.connect(g2);

  // Tine strike partial — the characteristic metallic "bell" that decays
  // Real Rhodes: struck tine resonates at ≈4× fundamental with fast decay
  const tine = ctx.createOscillator(); tine.type = "sine"; tine.frequency.value = f * 4.06;
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.18, n);
  tg.gain.exponentialRampToValueAtTime(0.008, n + 1.5);
  tine.connect(tg);

  // Upper inharmonic — gives the "glassy" attack bite
  const tine2 = ctx.createOscillator(); tine2.type = "sine"; tine2.frequency.value = f * 6.92;
  const tg2 = ctx.createGain();
  tg2.gain.setValueAtTime(0.06, n);
  tg2.gain.exponentialRampToValueAtTime(0.001, n + 0.5);
  tine2.connect(tg2);

  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600; lp.Q.value = 0.4;
  g1.connect(lp); g2.connect(lp); tg.connect(lp); tg2.connect(lp);

  // Phaser/tremolo — Rhodes stereo tremolo ≈5Hz
  const tremLfo = ctx.createOscillator(); tremLfo.type = "sine"; tremLfo.frequency.value = 5.0;
  const tremG = ctx.createGain(); tremG.gain.value = 0.055;
  const tremMix = ctx.createGain(); tremMix.gain.value = 1.0;
  tremLfo.connect(tremG); tremG.connect(tremMix.gain);
  lp.connect(tremMix);

  // Rhodes EQ: warm low end, cut the harsh 4kHz+ zone
  const ls = ctx.createBiquadFilter(); ls.type = "lowshelf"; ls.frequency.value = 180; ls.gain.value = 2.5;
  const hs = ctx.createBiquadFilter(); hs.type = "highshelf"; hs.frequency.value = 3800; hs.gain.value = -4;
  tremMix.connect(ls); ls.connect(hs);

  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.85, n + 0.018);
  env.gain.linearRampToValueAtTime(amp, n + 0.6);
  hs.connect(env); env.connect(droneBus);

  [o1, o2, tine, tine2, tremLfo].forEach(o => o.start(n));
  return { parts: [{ osc: o1, gain: g1 }, { osc: o2, gain: g2 }, { osc: tine, gain: tg }, { osc: tine2, gain: tg2 }, { osc: tremLfo, gain: tremG }], env, nodes: [lp, tremMix, ls, hs] };
}

export function synthBassGuitar(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;

  // Sub-octave — adds "weight" below the note fundamental
  const oSub = ctx.createOscillator(); oSub.type = "sine"; oSub.frequency.value = f * 0.5;
  const gSub = ctx.createGain(); gSub.gain.value = 0.10; oSub.connect(gSub);

  // Fundamental — triangle for natural odd-harmonic bass character
  const o1 = ctx.createOscillator(); o1.type = "triangle"; o1.frequency.value = f;
  const g1 = ctx.createGain(); g1.gain.value = 0.42; o1.connect(g1);

  // 2nd harmonic — the "warmth" harmonic (octave above)
  const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.18; o2.connect(g2);

  // 3rd harmonic — some "grit"
  const o3 = ctx.createOscillator(); o3.type = "sine"; o3.frequency.value = f * 3;
  const g3 = ctx.createGain(); g3.gain.value = 0.06; o3.connect(g3);

  // 4th harmonic — definition
  const o4 = ctx.createOscillator(); o4.type = "sine"; o4.frequency.value = f * 4;
  const g4 = ctx.createGain(); g4.gain.value = 0.02; o4.connect(g4);

  // LP filter: starts open (attack transient), settles at warm-but-present cutoff.
  // Slower sweep (1.8s) than a pluck — this is a sustaining drone.
  // Q=0.7 — NO resonant peak, stays clean.
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(2000, n);
  lp.frequency.exponentialRampToValueAtTime(950, n + 1.8);
  gSub.connect(lp); g1.connect(lp); g2.connect(lp); g3.connect(lp); g4.connect(lp);

  // EQ: boost the true sub region, smooth the highs
  const ls = ctx.createBiquadFilter(); ls.type = "lowshelf"; ls.frequency.value = 80; ls.gain.value = 5;
  const hs = ctx.createBiquadFilter(); hs.type = "highshelf"; hs.frequency.value = 3200; hs.gain.value = -4;
  lp.connect(ls); ls.connect(hs);

  // Tube amp saturation — tanh at 2.0 gives the right "harmonic warmth" without distortion
  const ws = ctx.createWaveShaper(); const curve = new Float32Array(512);
  for (let i = 0; i < 512; i++) { const x = (i / 256 - 1); curve[i] = Math.tanh(x * 2.0); }
  ws.curve = curve; ws.oversample = "4x";
  hs.connect(ws);

  // Slow amp LFO — very subtle breathing (0.08Hz = one cycle per 12.5s)
  const aLfo = ctx.createOscillator(); aLfo.type = "sine"; aLfo.frequency.value = 0.08;
  const aLfoG = ctx.createGain(); aLfoG.gain.value = 0.018;
  aLfo.connect(aLfoG);

  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.72, n + 0.010); // fast initial "thump"
  env.gain.linearRampToValueAtTime(amp, n + 1.0);           // bloom to full
  aLfoG.connect(env.gain); // breathing
  ws.connect(env); env.connect(droneBus);

  [oSub, o1, o2, o3, o4, aLfo].forEach(o => o.start(n));
  return { parts: [{ osc: oSub, gain: gSub }, { osc: o1, gain: g1 }, { osc: o2, gain: g2 }, { osc: o3, gain: g3 }, { osc: o4, gain: g4 }, { osc: aLfo, gain: aLfoG }], env, nodes: [lp, ls, hs, ws] };
}

// Map texture IDs to factory functions
export const SYNTH_MAP = {
  bassGuitar: synthBassGuitar,
  organPad: synthOrganPad,
  rhodesEP: synthRhodesEP,
  deepEarth: synthDeepEarth,
  vintageWarmth: synthVintageWarmth,
  silkBow: synthSilkBow,
  airyGlass: synthAiryGlass,
  pureBreath: synthPureBreath,
};
