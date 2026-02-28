import { useState, useRef, useCallback } from 'react';
import { dbStart, dbEnd, dbSetMove, dbSetUp } from '../hooks';

export function HSlider({ value, min, max, onChange, color, T }) {
  const c = color || T.accent;
  const trackRef = useRef(null);
  const [active, setActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const rafRef = useRef(0);
  const liveRef = useRef(value);
  const display = active && preview !== null ? preview : value;
  const pct = Math.max(0, Math.min(100, ((display - min) / (max - min)) * 100));

  const calcVal = useCallback((cx) => {
    if (!trackRef.current) return liveRef.current;
    const r = trackRef.current.getBoundingClientRect();
    const raw = (cx - r.left) / r.width;
    return Math.round(min + (max - min) * Math.max(0, Math.min(1, raw)));
  }, [min, max]);

  const onDown = (e) => {
    e.preventDefault();
    const v = calcVal(e.clientX); liveRef.current = v; setPreview(v); onChange(v); setActive(true);
    dbSetMove((ev) => {
      ev.preventDefault(); const nv = calcVal(ev.clientX); liveRef.current = nv;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => { setPreview(nv); onChange(nv); });
    });
    dbSetUp(() => {
      cancelAnimationFrame(rafRef.current); onChange(liveRef.current);
      setPreview(null); setActive(false); dbEnd();
    });
    dbStart();
  };

  return (
    <div className="relative flex-1" style={{ minWidth: 60 }}>
      <div ref={trackRef} className="relative cursor-pointer" style={{ height: 28, touchAction: "pan-y" }} onPointerDown={onDown}>
        <div className="absolute rounded-full" style={{ left: 0, right: 0, top: "50%", height: 3, transform: "translateY(-50%)", background: T.line }} />
        <div className="absolute rounded-full" style={{ left: 0, width: `${pct}%`, top: "50%", height: 3, transform: "translateY(-50%)", background: `${c}60`, transition: active ? "none" : "width 120ms cubic-bezier(.2,0,.3,1)" }} />
        <div style={{ position: "absolute", left: `${pct}%`, top: "50%", transform: "translate(-50%,-50%)", width: active ? 20 : 18, height: active ? 20 : 18, borderRadius: "50%", background: T.bg3, border: `2px solid ${c}`, boxShadow: `0 1px 4px rgba(0,0,0,0.3)${active ? `,0 0 10px ${c}40` : ""}`, pointerEvents: "none", transition: active ? "none" : "all 180ms cubic-bezier(.2,0,.3,1)" }} />
      </div>
    </div>
  );
}
