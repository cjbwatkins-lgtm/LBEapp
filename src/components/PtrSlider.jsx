import { useState, useRef, useCallback } from 'react';

export function PtrSlider({ value, onChange, label, color, defaultValue = 0.75, T }) {
  const c = color || T.accent;
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const rafRef = useRef(0);
  const liveRef = useRef(value);
  const pct = value * 100;

  const calcVal = useCallback((cy) => {
    if (!trackRef.current) return liveRef.current;
    const r = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, 1 - ((cy - r.top) / r.height)));
  }, []);

  const onDown = (e) => {
    e.preventDefault();
    liveRef.current = calcVal(e.clientY);
    onChange(liveRef.current);
    setDragging(true);

    const onMove = (ev) => {
      ev.preventDefault();
      const nv = calcVal(ev.clientY);
      liveRef.current = nv;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => onChange(nv));
    };

    const onUp = () => {
      cancelAnimationFrame(rafRef.current);
      onChange(liveRef.current);
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none" style={{ width: 56 }}>
      <span style={{ color: T.dim, fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase" }}>{label}</span>
      <div
        ref={trackRef}
        className="relative cursor-pointer"
        style={{ height: 100, width: 44, touchAction: "none" }}
        onPointerDown={onDown}
        onDoubleClick={(e) => { e.preventDefault(); onChange(defaultValue); }}
      >
        <div className="absolute rounded-full" style={{ width: 3, height: 80, background: T.line, bottom: 6, left: "50%", transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", width: 3, height: `${pct * 0.8}%`, borderRadius: 2, background: `linear-gradient(to top,${c}90,${c}30)`, bottom: 6, left: "50%", transform: "translateX(-50%)", transition: dragging ? "none" : "height 80ms ease-out" }} />
        <div style={{ width: dragging ? 18 : 16, height: dragging ? 18 : 16, borderRadius: "50%", background: T.bg3, border: `2px solid ${c}`, boxShadow: `0 0 ${dragging ? 14 : 6}px ${c}${dragging ? "60" : "30"}`, position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: `calc(${pct * 0.82}% - 2px)`, pointerEvents: "none", transition: dragging ? "none" : "all 120ms ease-out" }} />
        {dragging && (
          <div className="absolute rounded-md px-2 py-0.5 pointer-events-none"
            style={{ fontSize: 9, fontFamily: "monospace", color: c, background: T.bg2, border: `1px solid ${c}40`, whiteSpace: "nowrap", right: -52, bottom: `calc(${pct * 0.82}% - 6px)`, zIndex: 20 }}>
            {Math.round(pct)}%
          </div>
        )}
      </div>
      <span style={{ color: c, fontSize: 10, fontFamily: "monospace" }}>{Math.round(pct)}%</span>
    </div>
  );
}
