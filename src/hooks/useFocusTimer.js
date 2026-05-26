import { useState, useEffect, useRef } from 'react';
import { FOCUS_MODES } from '../constants';

const STORAGE_KEY = 'lbe-focus';
const DEFAULT_MODE = FOCUS_MODES.find(m => m.id === "standard") || FOCUS_MODES[1];

export function useFocusTimer() {
  const [mode, setModeState] = useState(DEFAULT_MODE);
  // phases: idle | work | work_done | break | break_done
  const [phase, setPhase] = useState("idle");
  const [secsLeft, setSecsLeft] = useState(DEFAULT_MODE.work * 60);
  const [cycle, setCycle] = useState(1);
  const [todayMins, setTodayMins] = useState(0);
  const endTime = useRef(null);
  const rafRef = useRef(null);
  const modeRef = useRef(DEFAULT_MODE);
  const todayMinsRef = useRef(0);

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (d.date === new Date().toDateString()) {
        setTodayMins(d.mins || 0);
        todayMinsRef.current = d.mins || 0;
      }
    } catch (e) {}
  }, []);

  const saveMins = (m) => {
    todayMinsRef.current = m;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: new Date().toDateString(), mins: m }));
    } catch (e) {}
  };

  useEffect(() => {
    if (phase !== "work" && phase !== "break") {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTime.current - performance.now()) / 1000));
      setSecsLeft(remaining);
      if (remaining <= 0) {
        const m = modeRef.current;
        if (phase === "work") {
          const newMins = todayMinsRef.current + m.work;
          setTodayMins(newMins);
          saveMins(newMins);
          setSecsLeft(0);
          setPhase("work_done");
        } else {
          setSecsLeft(0);
          setPhase("break_done");
        }
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  const start = () => {
    const m = modeRef.current;
    setCycle(1);
    endTime.current = performance.now() + m.work * 60 * 1000;
    setSecsLeft(m.work * 60);
    setPhase("work");
  };

  // Called when user confirms break start (from work_done screen)
  const startBreak = () => {
    if (phase !== "work_done") return;
    const m = modeRef.current;
    endTime.current = performance.now() + m.brk * 60 * 1000;
    setSecsLeft(m.brk * 60);
    setPhase("break");
  };

  // Called when user confirms next session start (from break_done screen)
  const startNextSession = () => {
    if (phase !== "break_done") return;
    const m = modeRef.current;
    setCycle(c => c + 1);
    endTime.current = performance.now() + m.work * 60 * 1000;
    setSecsLeft(m.work * 60);
    setPhase("work");
  };

  const pause = () => {
    if (phase === "idle") return;
    const remaining = endTime.current
      ? Math.max(0, Math.ceil((endTime.current - performance.now()) / 1000))
      : secsLeft;
    if (phase === "work") {
      const m = modeRef.current;
      const elapsed = m.work * 60 - remaining;
      const mins = Math.floor(elapsed / 60);
      if (mins > 0) { const n = todayMinsRef.current + mins; setTodayMins(n); saveMins(n); }
    }
    setPhase("idle");
    setSecsLeft(remaining);
  };

  const resume = () => {
    if (phase !== "idle" || secsLeft <= 0) return;
    endTime.current = performance.now() + secsLeft * 1000;
    setPhase("work");
  };

  const reset = () => {
    cancelAnimationFrame(rafRef.current);
    setPhase("idle");
    setCycle(1);
    setSecsLeft(modeRef.current.work * 60);
  };

  const skipBreak = () => {
    if (phase !== "break" && phase !== "work_done" && phase !== "break_done") return;
    const m = modeRef.current;
    setCycle(c => c + 1);
    endTime.current = performance.now() + m.work * 60 * 1000;
    setSecsLeft(m.work * 60);
    setPhase("work");
  };

  const selectMode = (m) => {
    modeRef.current = m;
    setModeState(m);
    if (phase === "idle") { setSecsLeft(m.work * 60); setCycle(1); }
  };

  const setCustomTime = (work, brk) => {
    const base = FOCUS_MODES.find(m => m.id === "custom") || { id: "custom", label: "Custom" };
    const m = { ...base, work, brk };
    modeRef.current = m;
    setModeState(m);
    if (phase === "idle") { setSecsLeft(work * 60); setCycle(1); }
  };

  const isBreakPhase = phase === "break" || phase === "break_done";
  const totalSecs = isBreakPhase ? mode.brk * 60 : mode.work * 60;
  const progress = totalSecs > 0 ? 1 - (secsLeft / totalSecs) : 0;
  const running = phase === "work" || phase === "break";
  const inBreak = isBreakPhase;
  const isPaused = phase === "idle" && secsLeft > 0 && secsLeft < mode.work * 60;

  return {
    mode, phase, secsLeft, cycle, todayMins,
    progress, running, inBreak, isPaused,
    start, pause, resume, reset, skipBreak,
    startBreak, startNextSession,
    selectMode, setCustomTime,
    stop: pause,
  };
}
