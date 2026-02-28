// ─── SYNTHESIZER VOICE FACTORIES ────────────────────────────────────────────
// Each function receives (engine, freq, amp) and returns { parts[], env, nodes[] }
// engine provides: ctx, droneBus, noiseBuf, claveNoiseBuf, drift(), partial(), makeSaturator()

export function synthDeepEarth(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 180; lp.Q.value = 0.4;
  const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = f * 0.5;
  const g1 = ctx.createGain(); g1.gain.value = 0.35; o1.connect(g1); g1.connect(lp);
  const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f;
  const g2 = ctx.createGain(); g2.gain.value = 0.30; o2.connect(g2); g2.connect(lp);
  const o3 = ctx.createOscillator(); o3.type = "sine"; o3.frequency.value = f * 2;
  const g3 = ctx.createGain(); g3.gain.value = 0.04; o3.connect(g3); g3.connect(lp);
  const fLfo = ctx.createOscillator(); fLfo.type = "sine"; fLfo.frequency.value = 0.03;
  const fLfoG = ctx.createGain(); fLfoG.gain.value = 60;
  fLfo.connect(fLfoG); fLfoG.connect(lp.frequency);
  const ws = ctx.createWaveShaper(); const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.5); }
  ws.curve = curve; ws.oversample = "4x"; lp.connect(ws);
  const tbp = ctx.createBiquadFilter(); tbp.type = "bandpass"; tbp.frequency.value = 220; tbp.Q.value = 0.9;
  const tSat = eng.makeSaturator(1.6);
  lp.connect(tbp); tbp.connect(tSat.in);
  const tLP = ctx.createBiquadFilter(); tLP.type = "lowpass"; tLP.frequency.value = 900; tLP.Q.value = 0.5;
  tSat.out.connect(tLP);
  const tG = ctx.createGain(); tG.gain.value = 0.12; tLP.connect(tG);
  const ls = ctx.createBiquadFilter(); ls.type = "lowshelf"; ls.frequency.value = 80; ls.gain.value = 8;
  ws.connect(ls); tG.connect(ls);
  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.5, n + 1);
  env.gain.linearRampToValueAtTime(amp, n + 4);
  ls.connect(env); env.connect(droneBus);
  [o1, o2, o3, fLfo].forEach(o => o.start(n));
  return { parts: [{ osc: o1, gain: g1 }, { osc: o2, gain: g2 }, { osc: o3, gain: g3 }, { osc: fLfo, gain: fLfoG }], env, nodes: [lp, ws, ls, tbp, tSat.ws, tLP, tG] };
}

export function synthVintageWarmth(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;
  const lp1 = ctx.createBiquadFilter(); lp1.type = "lowpass"; lp1.frequency.value = 1100; lp1.Q.value = 0.65;
  const lp2 = ctx.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 1400; lp2.Q.value = 0.45;
  lp1.connect(lp2);
  const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = f; o1.detune.value = +5;
  const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = f; o2.detune.value = -7;
  const o3 = ctx.createOscillator(); o3.type = "triangle"; o3.frequency.value = f * 0.5;
  const g1 = ctx.createGain(); g1.gain.value = 0.22; o1.connect(g1); g1.connect(lp1);
  const g2 = ctx.createGain(); g2.gain.value = 0.20; o2.connect(g2); g2.connect(lp1);
  const g3 = ctx.createGain(); g3.gain.value = 0.10; o3.connect(g3); g3.connect(lp1);
  const ls = ctx.createBiquadFilter(); ls.type = "lowshelf"; ls.frequency.value = 220; ls.gain.value = 2.5;
  const hs = ctx.createBiquadFilter(); hs.type = "highshelf"; hs.frequency.value = 3200; hs.gain.value = -6;
  lp2.connect(ls); ls.connect(hs);
  const sat = eng.makeSaturator(1.2); hs.connect(sat.in);
  const splitHP = ctx.createBiquadFilter(); splitHP.type = "highpass"; splitHP.frequency.value = 220; splitHP.Q.value = 0.7;
  const d = ctx.createDelay(0.05); d.delayTime.value = 0.012;
  const dMix = ctx.createGain(); dMix.gain.value = 0.18;
  const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.18;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.003;
  lfo.connect(lfoG); lfoG.connect(d.delayTime);
  sat.out.connect(splitHP); splitHP.connect(d); d.connect(dMix);
  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.35, n + 0.25);
  env.gain.linearRampToValueAtTime(amp, n + 1.6);
  sat.out.connect(env); dMix.connect(env); env.connect(droneBus);
  [o1, o2, o3, lfo].forEach(o => o.start(n));
  return { parts: [{ osc: o1, gain: g1 }, { osc: o2, gain: g2 }, { osc: o3, gain: g3 }, { osc: lfo, gain: lfoG }], env, nodes: [lp1, lp2, ls, hs, sat.ws, splitHP, d, dMix] };
}

export function synthSilkBow(eng, f, amp) {
  const { ctx, droneBus, noiseBuf } = eng;
  const n = ctx.currentTime;
  const body = ctx.createBiquadFilter(); body.type = "lowpass"; body.frequency.value = 2800; body.Q.value = 0.3;
  const harms = [[f, 0.32], [f * 2, 0.10], [f * 3, 0.14], [f * 4, 0.05], [f * 5, 0.08], [f * 6, 0.02]];
  const parts = harms.map(([freq, vol]) => eng.partial(freq, vol, body));
  const vib = ctx.createOscillator(); vib.type = "sine"; vib.frequency.value = 5.4;
  const vibD = ctx.createGain(); vibD.gain.setValueAtTime(0, n);
  vibD.gain.linearRampToValueAtTime(f * 0.005, n + 2.5);
  vib.connect(vibD); parts.forEach(p => vibD.connect(p.osc.frequency));
  const noise = ctx.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
  const nbp = ctx.createBiquadFilter(); nbp.type = "bandpass"; nbp.frequency.value = f * 2.5; nbp.Q.value = 0.8;
  const ng = ctx.createGain(); ng.gain.value = 0.015;
  noise.connect(nbp); nbp.connect(ng); ng.connect(body);
  const swLfo = ctx.createOscillator(); swLfo.type = "sine"; swLfo.frequency.value = 0.14;
  const swG = ctx.createGain(); swG.gain.value = 0.05;
  const mix = ctx.createGain(); mix.gain.value = 1.0;
  swLfo.connect(swG); swG.connect(mix.gain); body.connect(mix);
  const pk = ctx.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 450; pk.Q.value = 0.6; pk.gain.value = 3;
  mix.connect(pk);
  const d1 = ctx.createDelay(0.5); d1.delayTime.value = 0.022;
  const fb1 = ctx.createGain(); fb1.gain.value = 0.15;
  const rlp = ctx.createBiquadFilter(); rlp.type = "lowpass"; rlp.frequency.value = 2000;
  pk.connect(d1); d1.connect(fb1); fb1.connect(d1); d1.connect(rlp);
  const rv = ctx.createGain(); rv.gain.value = 0.18; rlp.connect(rv);
  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.3, n + 0.15);
  env.gain.linearRampToValueAtTime(amp, n + 1.8);
  pk.connect(env); rv.connect(env); env.connect(droneBus);
  parts.forEach(p => p.osc.start(n)); vib.start(n); noise.start(n); swLfo.start(n);
  return { parts: [...parts, { osc: vib, gain: vibD }, { osc: noise, gain: ng }, { osc: swLfo, gain: swG }], env, nodes: [body, nbp, mix, pk, d1, fb1, rlp, rv] };
}

export function synthAiryGlass(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;
  const freqs = [[f, 0.26], [f * 2.002, 0.16], [f * 3.01, 0.08], [f * 4.005, 0.05], [f * 5.02, 0.03]];
  const parts = freqs.map(([freq, vol]) => {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol; o.connect(g); return { osc: o, gain: g };
  });
  const mix = ctx.createGain(); mix.gain.value = 1;
  parts.forEach(p => p.gain.connect(mix));
  const hs = ctx.createBiquadFilter(); hs.type = "highshelf"; hs.frequency.value = 3000; hs.gain.value = -4;
  mix.connect(hs);
  const dl = ctx.createDelay(2); dl.delayTime.value = 0.14;
  const dfb = ctx.createGain(); dfb.gain.value = 0.38;
  const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 2800;
  hs.connect(dl); dl.connect(dlp); dlp.connect(dfb); dfb.connect(dl);
  const wet = ctx.createGain(); wet.gain.value = 0.30; dlp.connect(wet);
  const shLfo = ctx.createOscillator(); shLfo.type = "sine"; shLfo.frequency.value = 0.06;
  const shG = ctx.createGain(); shG.gain.value = f * 0.001;
  shLfo.connect(shG); parts.slice(2).forEach(p => shG.connect(p.osc.frequency));
  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.5, n + 0.1);
  env.gain.linearRampToValueAtTime(amp, n + 1.2);
  hs.connect(env); wet.connect(env); env.connect(droneBus);
  parts.forEach(p => p.osc.start(n)); shLfo.start(n);
  return { parts: [...parts, { osc: shLfo, gain: shG }], env, nodes: [mix, hs, dl, dfb, dlp, wet] };
}

export function synthPureBreath(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;
  const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = f * 0.5;
  const g1 = ctx.createGain(); g1.gain.value = 0.14; o1.connect(g1);
  const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f;
  const g2 = ctx.createGain(); g2.gain.value = 0.28; o2.connect(g2);
  const o3 = ctx.createOscillator(); o3.type = "sine"; o3.frequency.value = f * 1.003;
  const g3 = ctx.createGain(); g3.gain.value = 0.18; o3.connect(g3);
  const o4 = ctx.createOscillator(); o4.type = "sine"; o4.frequency.value = f * 0.998;
  const g4 = ctx.createGain(); g4.gain.value = 0.12; o4.connect(g4);
  const o5 = ctx.createOscillator(); o5.type = "sine"; o5.frequency.value = f * 2;
  const g5 = ctx.createGain(); g5.gain.value = 0.08; o5.connect(g5);
  const o6 = ctx.createOscillator(); o6.type = "sine"; o6.frequency.value = f * 2.004;
  const g6 = ctx.createGain(); g6.gain.value = 0.05; o6.connect(g6);
  const vib = ctx.createOscillator(); vib.type = "sine"; vib.frequency.value = 3.2;
  const vibG = ctx.createGain(); vibG.gain.value = f * 0.002;
  vib.connect(vibG); vibG.connect(o2.frequency); vibG.connect(o3.frequency);
  const ls = ctx.createBiquadFilter(); ls.type = "lowshelf"; ls.frequency.value = 180; ls.gain.value = 3;
  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.4, n + 0.4);
  env.gain.linearRampToValueAtTime(amp, n + 2);
  [g1, g2, g3, g4, g5, g6].forEach(g => g.connect(ls));
  ls.connect(env); env.connect(droneBus);
  [o1, o2, o3, o4, o5, o6, vib].forEach(o => o.start(n));
  return { parts: [{ osc: o1, gain: g1 }, { osc: o2, gain: g2 }, { osc: o3, gain: g3 }, { osc: o4, gain: g4 }, { osc: o5, gain: g5 }, { osc: o6, gain: g6 }, { osc: vib, gain: vibG }], env, nodes: [ls] };
}

export function synthOrganPad(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;
  const drawbars = [[f * 0.5, 0.12], [f, 0.28], [f * 1.5, 0.10], [f * 2, 0.18], [f * 3, 0.08], [f * 4, 0.06], [f * 6, 0.02]];
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400; lp.Q.value = 0.5;
  const parts = drawbars.map(([freq, vol]) => eng.partial(freq, vol, lp));
  const chorusLfo = ctx.createOscillator(); chorusLfo.type = "sine"; chorusLfo.frequency.value = 0.8;
  const chorusDepth = ctx.createGain(); chorusDepth.gain.value = f * 0.003;
  chorusLfo.connect(chorusDepth);
  parts.slice(2).forEach(p => chorusDepth.connect(p.osc.frequency));
  const tremLfo = ctx.createOscillator(); tremLfo.type = "sine"; tremLfo.frequency.value = 5.8;
  const tremG = ctx.createGain(); tremG.gain.value = 0.04;
  const tremMix = ctx.createGain(); tremMix.gain.value = 1.0;
  tremLfo.connect(tremG); tremG.connect(tremMix.gain);
  lp.connect(tremMix);
  const clickBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.008), ctx.sampleRate);
  const cd = clickBuf.getChannelData(0); for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (cd.length * 0.15));
  const click = ctx.createBufferSource(); click.buffer = clickBuf;
  const clickF = ctx.createBiquadFilter(); clickF.type = "bandpass"; clickF.frequency.value = 3000; clickF.Q.value = 2;
  const clickG = ctx.createGain(); clickG.gain.value = 0.08;
  click.connect(clickF); clickF.connect(clickG);
  const dl = ctx.createDelay(0.5); dl.delayTime.value = 0.025;
  const dfb = ctx.createGain(); dfb.gain.value = 0.18;
  const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 1800;
  tremMix.connect(dl); dl.connect(dlp); dlp.connect(dfb); dfb.connect(dl);
  const wet = ctx.createGain(); wet.gain.value = 0.15; dlp.connect(wet);
  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.7, n + 0.06);
  env.gain.linearRampToValueAtTime(amp, n + 0.8);
  tremMix.connect(env); wet.connect(env); clickG.connect(env); env.connect(droneBus);
  parts.forEach(p => p.osc.start(n)); chorusLfo.start(n); tremLfo.start(n); click.start(n);
  return { parts: [...parts, { osc: chorusLfo, gain: chorusDepth }, { osc: tremLfo, gain: tremG }], env, nodes: [lp, tremMix, clickF, clickG, dl, dfb, dlp, wet] };
}

export function synthRhodesEP(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;
  const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = f;
  const g1 = ctx.createGain(); g1.gain.value = 0.30; o1.connect(g1);
  const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.10; o2.connect(g2);
  const tine = ctx.createOscillator(); tine.type = "sine"; tine.frequency.value = f * 4.08;
  const tg = ctx.createGain(); tg.gain.setValueAtTime(0.14, n);
  tg.gain.exponentialRampToValueAtTime(0.01, n + 1.2);
  tine.connect(tg);
  const tine2 = ctx.createOscillator(); tine2.type = "sine"; tine2.frequency.value = f * 7.03;
  const tg2 = ctx.createGain(); tg2.gain.setValueAtTime(0.04, n);
  tg2.gain.exponentialRampToValueAtTime(0.001, n + 0.6);
  tine2.connect(tg2);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200; lp.Q.value = 0.4;
  g1.connect(lp); g2.connect(lp); tg.connect(lp); tg2.connect(lp);
  const tremLfo = ctx.createOscillator(); tremLfo.type = "sine"; tremLfo.frequency.value = 4.5;
  const tremG = ctx.createGain(); tremG.gain.value = 0.06;
  const tremMix = ctx.createGain(); tremMix.gain.value = 1.0;
  tremLfo.connect(tremG); tremG.connect(tremMix.gain);
  lp.connect(tremMix);
  const ls = ctx.createBiquadFilter(); ls.type = "lowshelf"; ls.frequency.value = 200; ls.gain.value = 3;
  const hs = ctx.createBiquadFilter(); hs.type = "highshelf"; hs.frequency.value = 3500; hs.gain.value = -3;
  tremMix.connect(ls); ls.connect(hs);
  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.8, n + 0.02);
  env.gain.linearRampToValueAtTime(amp, n + 0.5);
  hs.connect(env); env.connect(droneBus);
  [o1, o2, tine, tine2, tremLfo].forEach(o => o.start(n));
  return { parts: [{ osc: o1, gain: g1 }, { osc: o2, gain: g2 }, { osc: tine, gain: tg }, { osc: tine2, gain: tg2 }, { osc: tremLfo, gain: tremG }], env, nodes: [lp, tremMix, ls, hs] };
}

export function synthBassGuitar(eng, f, amp) {
  const { ctx, droneBus } = eng;
  const n = ctx.currentTime;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
  lp.frequency.setValueAtTime(2400, n);
  lp.frequency.exponentialRampToValueAtTime(800, n + 0.8);
  lp.Q.value = 1.5;
  const o1 = ctx.createOscillator(); o1.type = "triangle"; o1.frequency.value = f;
  const g1 = ctx.createGain(); g1.gain.value = 0.35; o1.connect(g1); g1.connect(lp);
  const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.16; o2.connect(g2); g2.connect(lp);
  const o3 = ctx.createOscillator(); o3.type = "sine"; o3.frequency.value = f * 3;
  const g3 = ctx.createGain(); g3.gain.value = 0.07; o3.connect(g3); g3.connect(lp);
  const o4 = ctx.createOscillator(); o4.type = "sine"; o4.frequency.value = f * 4;
  const g4 = ctx.createGain(); g4.gain.value = 0.03; o4.connect(g4); g4.connect(lp);
  const ls = ctx.createBiquadFilter(); ls.type = "lowshelf"; ls.frequency.value = 150; ls.gain.value = 5;
  lp.connect(ls);
  const mid = ctx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 700; mid.Q.value = 0.8; mid.gain.value = -3;
  ls.connect(mid);
  const hs = ctx.createBiquadFilter(); hs.type = "highshelf"; hs.frequency.value = 3500; hs.gain.value = -4;
  mid.connect(hs);
  const ws = ctx.createWaveShaper(); const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 1.3); }
  ws.curve = curve; hs.connect(ws);
  const env = ctx.createGain(); env.gain.setValueAtTime(0, n);
  env.gain.linearRampToValueAtTime(amp * 0.8, n + 0.012);
  env.gain.linearRampToValueAtTime(amp, n + 0.5);
  ws.connect(env); env.connect(droneBus);
  [o1, o2, o3, o4].forEach(o => o.start(n));
  return { parts: [{ osc: o1, gain: g1 }, { osc: o2, gain: g2 }, { osc: o3, gain: g3 }, { osc: o4, gain: g4 }], env, nodes: [lp, ls, mid, hs, ws] };
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
