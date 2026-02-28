import { useState, useEffect, useRef } from 'react';
import { FOCUS_MODES } from '../constants';

const STORAGE_KEY = 'lbe-focus';

export function useFocusTimer({ onWorkStart, onBreakStart, onSessionComplete } = {}) {
  const [mode, setMode] = useState(FOCUS_MODES[1]);
  const [phase, setPhase] = useState("idle"); // idle | work | break
  const [secsLeft, setSecsLeft] = useState(FOCUS_MODES[1].work * 60);
  const [cycle, setCycle] = useState(1);
  const [todayMins, setTodayMins] = useState(0);
  const [intention, setIntention] = useState("");
  const startTime = useRef(null);
  const endTime = useRef(null);
  const rafRef = useRef(null);

  // Load today's minutes
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (d.date === new Date().toDateString()) setTodayMins(d.mins || 0);
    } catch (e) { /* ignore */ }
  }, []);

  const saveMins = (m) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: new Date().toDateString(), mins: m })); } catch (e) { /* ignore */ }
  };

  // RAF-based timer
  useEffect(() => {
    if (phase === "idle") { cancelAnimationFrame(rafRef.current); return; }
    const tick = () => {
      const now = performance.now();
      const remaining = Math.max(0, Math.ceil((endTime.current - now) / 1000));
      setSecsLeft(remaining);
      if (remaining <= 0) {
        if (phase === "work") {
          const earned = mode.work;
          const newMins = todayMins + earned;
          setTodayMins(newMins); saveMins(newMins);
          onBreakStart?.();
          setPhase("break"); setSecsLeft(mode.brk * 60);
          startTime.current = performance.now();
          endTime.current = performance.now() + mode.brk * 60 * 1000;
        } else {
          onWorkStart?.();
          setCycle(c => c + 1);
          setPhase("work"); setSecsLeft(mode.work * 60);
          startTime.current = performance.now();
          endTime.current = performance.now() + mode.work * 60 * 1000;
        }
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, mode]);

  const start = () => {
    setCycle(1); setPhase("work"); setSecsLeft(mode.work * 60);
    startTime.current = performance.now();
    endTime.current = performance.now() + mode.work * 60 * 1000;
    onWorkStart?.();
  };

  const pause = () => {
    if (phase === "idle") return;
    const remaining = secsLeft;
    setPhase("idle"); setSecsLeft(remaining);
    if (phase === "work") {
      const elapsed = mode.work * 60 - remaining;
      const mins = Math.floor(elapsed / 60);
      if (mins > 0) { const n = todayMins + mins; setTodayMins(n); saveMins(n); }
    }
  };

  const resume = () => {
    if (secsLeft <= 0) return;
    setPhase("work");
    startTime.current = performance.now();
    endTime.current = performance.now() + secsLeft * 1000;
  };

  const reset = () => {
    setPhase("idle"); setSecsLeft(mode.work * 60); setCycle(1);
    onSessionComplete?.();
  };

  const skipBreak = () => {
    if (phase !== "break") return;
    onWorkStart?.();
    setCycle(c => c + 1);
    setPhase("work"); setSecsLeft(mode.work * 60);
    startTime.current = performance.now();
    endTime.current = performance.now() + mode.work * 60 * 1000;
  };

  const selectMode = (m) => {
    setMode(m);
    if (phase === "idle") { setSecsLeft(m.work * 60); setCycle(1); }
  };

  const setCustomTime = (work, brk) => {
    const m = { id: "custom", label: "Custom", work, brk };
    setMode(m);
    if (phase === "idle") { setSecsLeft(work * 60); setCycle(1); }
  };

  const totalSecs = phase === "break" ? mode.brk * 60 : mode.work * 60;
  const progress = totalSecs > 0 ? 1 - (secsLeft / totalSecs) : 0;
  const isPaused = phase === "idle" && secsLeft > 0 && secsLeft !== mode.work * 60;

  return {
    mode, phase, secsLeft, cycle, todayMins, intention, setIntention,
    progress, start, pause, resume, reset, selectMode, setCustomTime,
    isPaused, skipBreak,
  };
}
