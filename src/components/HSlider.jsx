import { useState, useRef, useCallback } from 'react';

export function HSlider({ value, min, max, step, onChange, color, T }) {
  const c = color || T.accent;
  const trackRef = useRef(null);
  const [active, setActive] = useState(false);
  const rafRef = useRef(0);
  const liveRef = useRef(value);
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  // Auto step: integers with range ≥ 2 → step 1; small/float range → step 0.01
  const resolvedStep = step ?? (Number.isInteger(min) && Number.isInteger(max) && (max - min) >= 2 ? 1 : 0.01);

  const calcVal = useCallback((cx) => {
    if (!trackRef.current) return liveRef.current;
    const r = trackRef.current.getBoundingClientRect();
    const raw = min + (max - min) * Math.max(0, Math.min(1, (cx - r.left) / r.width));
    return Math.round(raw / resolvedStep) * resolvedStep;
  }, [min, max, resolvedStep]);

  const onDown = (e) => {
    e.preventDefault();
    liveRef.current = calcVal(e.clientX);
    onChange(liveRef.current);
    setActive(true);

    const onMove = (ev) => {
      ev.preventDefault();
      const nv = calcVal(ev.clientX);
      liveRef.current = nv;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => onChange(nv));
    };

    const onUp = () => {
      cancelAnimationFrame(rafRef.current);
      onChange(liveRef.current);
      setActive(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div className="relative flex-1" style={{ minWidth: 60 }}>
      <div
        ref={trackRef}
        className="relative cursor-pointer"
        style={{ height: 28, touchAction: "pan-y" }}
        onPointerDown={onDown}
      >
        <div className="absolute rounded-full" style={{ left: 0, right: 0, top: "50%", height: 3, transform: "translateY(-50%)", background: T.line }} />
        <div className="absolute rounded-full" style={{ left: 0, width: `${pct}%`, top: "50%", height: 3, transform: "translateY(-50%)", background: `${c}60`, transition: active ? "none" : "width 80ms ease-out" }} />
        <div style={{
          position: "absolute", left: `${pct}%`, top: "50%",
          transform: "translate(-50%,-50%)",
          width: active ? 20 : 18, height: active ? 20 : 18,
          borderRadius: "50%",
          background: T.bg3,
          border: `2px solid ${c}`,
          boxShadow: `0 1px 4px rgba(0,0,0,0.3)${active ? `,0 0 10px ${c}40` : ""}`,
          pointerEvents: "none",
          transition: active ? "none" : "all 120ms ease-out",
        }} />
      </div>
    </div>
  );
}
