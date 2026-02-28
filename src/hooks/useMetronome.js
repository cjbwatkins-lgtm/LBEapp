import { useRef, useCallback } from 'react';
import {
  CLAVE_44, CLAVE_44_PULSE, CLAVE_44_STEPS,
  CLAVE_68, CLAVE_68_PULSE, CLAVE_68_STEPS,
} from '../constants';

export function useMetronome(engine, ready) {
  const timerRef = useRef(null);
  const vis = useRef({
    beat: -1, bar: 0, isGap: false, isCountIn: false,
    currentBpm: 90, totalBars: 0, tick: 0, claveStep: -1,
  });
  const cbRef = useRef(null);
  const configRef = useRef(null);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    vis.current = { beat: -1, bar: 0, isGap: false, isCountIn: false, currentBpm: 90, totalBars: 0, tick: 0, claveStep: -1 };
    cbRef.current?.(vis.current);
  }, []);

  const update = useCallback((config) => { configRef.current = config; }, []);

  const start = useCallback((config) => {
    if (!ready || !engine.current?.ready) return;
    stop();
    configRef.current = config;
    const ctx = engine.current.ctx;

    // ─── CLAVE MODE SCHEDULER ─────────────────────────────────────────
    if (config.claveMode) {
      const is68 = config.claveFeel === "68";
      const totalSteps = is68 ? CLAVE_68_STEPS : CLAVE_44_STEPS;
      const stepsPerBar = is68 ? 6 : 8;
      let pattern, pulseArr;
      if (is68) {
        pattern = CLAVE_68[config.clave68Pat] || CLAVE_68.clave68;
        pulseArr = CLAVE_68_PULSE;
      } else {
        const patKey = (config.claveType === "rumba" ? "rumba" : "son") + (config.claveDir === "23" ? "23" : "32");
        pattern = CLAVE_44[patKey];
        pulseArr = CLAVE_44_PULSE;
      }
      const patSet = new Set(pattern);
      const pulseSet = new Set(pulseArr);
      let countInLeft = config.claveCountIn ? stepsPerBar : 0;
      let nextTime = ctx.currentTime + 0.05, step = 0, cycleCount = 0;

      const sched = () => {
        const c = configRef.current; if (!c) return;
        const stepDur = is68 ? (60.0 / c.bpm / 3) : (60.0 / c.bpm / 4);
        if (countInLeft > 0) {
          const ciPulse = is68 ? (step % 6 === 0) : (step % 4 === 0);
          if (ciPulse) engine.current.schedClave(nextTime, "count");
          const beatInBar = is68 ? Math.floor(step / 3) : Math.floor(step / 4);
          vis.current = { beat: beatInBar, bar: 0, isGap: false, isCountIn: true, currentBpm: c.bpm, totalBars: 0, tick: vis.current.tick + 1, claveStep: -1 };
          const visTrigger = is68 ? (step % 3 === 0) : (step % 4 === 0);
          if (visTrigger) cbRef.current?.(vis.current);
          nextTime += stepDur; step++;
          if (step >= stepsPerBar) { step = 0; countInLeft = 0; }
          return;
        }
        const isClaveHit = patSet.has(step);
        const isPulseHit = c.clavePulse && pulseSet.has(step);
        const isFirst = step === pattern[0];
        if (isClaveHit) engine.current.schedClaveWood(nextTime, isFirst);
        if (isPulseHit) engine.current.schedClavePulse(nextTime);
        const bar = Math.floor(step / stepsPerBar);
        const beatInBar = is68 ? Math.floor((step % stepsPerBar) / 3) : Math.floor((step % stepsPerBar) / 4);
        vis.current = { beat: beatInBar, bar: cycleCount * 2 + bar, isGap: false, isCountIn: false, currentBpm: c.bpm, totalBars: cycleCount * 2 + bar, tick: vis.current.tick + 1, claveStep: step };
        const visTrigger = is68 ? (step % 3 === 0) : (step % 4 === 0);
        if (visTrigger) cbRef.current?.(vis.current);
        nextTime += stepDur; step++;
        if (step >= totalSteps) { step = 0; cycleCount++; }
      };
      timerRef.current = setInterval(() => {
        const ctx2 = engine.current.ctx;
        while (nextTime < ctx2.currentTime + 0.1) sched();
      }, 25);
      return;
    }

    // ─── STANDARD METRONOME SCHEDULER ─────────────────────────────────
    let nextNoteTime = ctx.currentTime + 0.05, currentSubdiv = 0, barCount = 0;
    let countInBarsLeft = config.countIn ? 1 : 0, totalBarsPlayed = 0, currentBpm = config.bpm;

    const sched = () => {
      const c = configRef.current; if (!c) return;
      const beatsPerBar = c.timeSig.n;
      const subdivMult = { none: 1, "8th": 2, trip: 3, "16th": 4, quint: 5, sext: 6, sept: 7, "32nd": 8 }[c.subdiv] || 1;
      const totalSubdivsPerBar = beatsPerBar * subdivMult;
      if (currentSubdiv >= totalSubdivsPerBar) currentSubdiv = 0;
      currentBpm = c.bpm;
      if (c.rampMode !== "off") {
        const p = Math.min(totalBarsPlayed / c.rampBars, 1);
        currentBpm = Math.round(c.bpm + (c.rampEnd - c.bpm) * p);
      }
      const b = Math.floor(currentSubdiv / subdivMult);
      const s = currentSubdiv % subdivMult;
      const isGapBar = (bar) => {
        if (c.gapBars <= 0) return false;
        const silent = c.gapSilent || c.gapBars;
        const cycle = c.gapBars + silent;
        return (bar % cycle) >= c.gapBars;
      };
      const gap = countInBarsLeft <= 0 && isGapBar(barCount);
      const shouldSound = (bt, sb) => {
        if (countInBarsLeft > 0) return sb === 0;
        if (c.clickMode === "all") return true;
        if (c.clickMode === "24") return sb === 0 ? (bt === 1 || bt === 3) : true;
        if (c.clickMode === "13") return sb === 0 ? (bt === 0 || bt === 2) : true;
        if (c.clickMode === "1only") return sb === 0 ? bt === 0 : true;
        if (c.clickMode === "offbeat") return sb === 0 ? bt !== 0 : true;
        if (c.clickMode === "custom") return sb === 0 ? c.customAccents[bt] : true;
        return true;
      };
      const getClickType = (bt, sb) => {
        if (countInBarsLeft > 0) return "count";
        if (sb !== 0) return "ghost";
        const em = c.beatEmphasis?.[bt] || 0;
        if (em === 1) return "accent"; if (em === 2) return "ghost";
        if (c.clickMode === "24" && (bt === 1 || bt === 3)) return "accent";
        if (c.clickMode === "13" && (bt === 0 || bt === 2)) return "accent";
        if (bt === 0) return "accent";
        return "normal";
      };
      if (!gap && shouldSound(b, s)) engine.current.schedClave(nextNoteTime, getClickType(b, s));
      if (s === 0) {
        vis.current = { beat: b, bar: barCount, isGap: gap, isCountIn: countInBarsLeft > 0, currentBpm, totalBars: totalBarsPlayed, tick: vis.current.tick + 1, claveStep: -1 };
        cbRef.current?.(vis.current);
      }
      nextNoteTime += 60.0 / currentBpm / subdivMult;
      currentSubdiv++;
      if (currentSubdiv >= totalSubdivsPerBar) {
        currentSubdiv = 0;
        if (countInBarsLeft > 0) countInBarsLeft--;
        else { barCount++; totalBarsPlayed++; }
      }
    };
    timerRef.current = setInterval(() => {
      const ctx2 = engine.current.ctx;
      while (nextNoteTime < ctx2.currentTime + 0.1) sched();
    }, 25);
  }, [ready, engine, stop]);

  return { vis, start, stop, cbRef, update };
}

export function useTapTempo(onBpm) {
  const taps = useRef([]);
  return useCallback(() => {
    const now = performance.now();
    taps.current.push(now);
    taps.current = taps.current.filter(t => now - t < 2500);
    if (taps.current.length >= 2) {
      const iv = [];
      for (let i = 1; i < taps.current.length; i++) iv.push(taps.current[i] - taps.current[i - 1]);
      const bpm = Math.round(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length));
      if (bpm >= 10 && bpm <= 450) onBpm(bpm);
    }
  }, [onBpm]);
}
