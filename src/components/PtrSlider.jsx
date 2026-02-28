import { useState, useRef, useCallback } from 'react';
import { dbStart, dbEnd, dbSetMove, dbSetUp } from '../hooks';

export function PtrSlider({ value, onChange, label, color, defaultValue = 0.75, T }) {
  const c = color || T.accent;
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const rafRef = useRef(0);
  const liveRef = useRef(value);
  const display = dragging && preview !== null ? preview : value;
  const pct = display * 100;

  const calcVal = useCallback((cy) => {
    if (!trackRef.current) return liveRef.current;
    const r = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, 1 - ((cy - r.top) / r.height)));
  }, []);

  const onDown = (e) => {
    e.preventDefault();
    const v = calcVal(e.clientY); liveRef.current = v; setPreview(v); onChange(v); setDragging(true);
    dbSetMove((ev) => {
      ev.preventDefault(); const nv = calcVal(ev.clientY); liveRef.current = nv;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => { setPreview(nv); onChange(nv); });
    });
    dbSetUp(() => {
      cancelAnimationFrame(rafRef.current); onChange(liveRef.current);
      setPreview(null); setDragging(false); dbEnd();
    });
    dbStart();
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none" style={{ width: 56 }}>
      <span style={{ color: T.dim, fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase" }}>{label}</span>
      <div ref={trackRef} className="relative cursor-pointer" style={{ height: 100, width: 44, touchAction: "none" }}
        onPointerDown={onDown} onDoubleClick={(e) => { e.preventDefault(); onChange(defaultValue); }}>
        <div className="absolute rounded-full" style={{ width: 3, height: 80, background: T.line, bottom: 6, left: "50%", transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", width: 3, height: `${pct * 0.8}%`, borderRadius: 2, background: `linear-gradient(to top,${c}90,${c}30)`, bottom: 6, left: "50%", transform: "translateX(-50%)", transition: dragging ? "none" : "height 120ms cubic-bezier(.2,0,.3,1)" }} />
        <div style={{ width: dragging ? 18 : 16, height: dragging ? 18 : 16, borderRadius: "50%", background: T.bg3, border: `2px solid ${c}`, boxShadow: `0 0 ${dragging ? 14 : 6}px ${c}${dragging ? "60" : "30"}`, position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: `calc(${pct * 0.82}% - 2px)`, pointerEvents: "none", transition: dragging ? "none" : "all 180ms cubic-bezier(.2,0,.3,1)" }} />
        {dragging && (
          <div className="absolute rounded-md px-2 py-0.5 pointer-events-none"
            style={{ fontSize: 9, fontFamily: "monospace", color: c, background: T.bg1, border: `1px solid ${c}40`, whiteSpace: "nowrap", right: -52, bottom: `calc(${pct * 0.82}% - 6px)`, zIndex: 20 }}>
            {label} {Math.round(pct)}%
          </div>
        )}
      </div>
      <span style={{ color: c, fontSize: 10, fontFamily: "monospace" }}>{Math.round(pct)}%</span>
    </div>
  );
}
