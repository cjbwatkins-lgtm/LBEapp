import { useState, useRef } from 'react';

export function ToneKnob({ value, onChange, label, color, T }) {
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const r = 22;
  const rafRef = useRef(0);
  const liveRef = useRef(value);
  const pct = (value + 1) / 2;
  const angle = pct * 280 - 140;
  const c = color || T.cool;
  const toneLabel = value < -0.5 ? "Dark" : value < -0.15 ? "Warm" : value > 0.5 ? "Bright" : value > 0.15 ? "Airy" : "Flat";

  const onDown = (e) => {
    e.preventDefault();
    dragRef.current = { y: e.clientY, v: value };
    liveRef.current = value;
    setDragging(true);

    const onMove = (ev) => {
      ev.preventDefault();
      if (!dragRef.current) return;
      const dy = dragRef.current.y - ev.clientY;
      const nv = Math.round(Math.min(1, Math.max(-1, dragRef.current.v + dy * 0.012)) * 100) / 100;
      liveRef.current = nv;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => onChange(nv));
    };

    const onUp = () => {
      cancelAnimationFrame(rafRef.current);
      onChange(liveRef.current);
      setDragging(false);
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div className="flex flex-col items-center gap-0.5 select-none" style={{ width: 56 }}>
      <span style={{ color: T.dim, fontSize: 7, letterSpacing: "0.15em", textTransform: "uppercase" }}>{label}</span>
      <div onPointerDown={onDown} className="relative cursor-pointer" style={{ width: r * 2 + 6, height: r * 2 + 6, touchAction: "none" }}>
        <svg viewBox={`0 0 ${r * 2 + 6} ${r * 2 + 6}`} className="absolute inset-0">
          <circle cx={r + 3} cy={r + 3} r={r} fill="none" stroke={T.line} strokeWidth={2}
            strokeDasharray={`${r * 2 * Math.PI * .78} ${r * 2 * Math.PI * .22}`}
            transform={`rotate(131 ${r + 3} ${r + 3})`} />
          {Math.abs(value) > 0.02 && (
            <circle cx={r + 3} cy={r + 3} r={r} fill="none" stroke={c} strokeWidth={2.5}
              strokeLinecap="round" opacity={.8}
              strokeDasharray={`${r * 2 * Math.PI * .78 * Math.abs(pct - 0.5)} ${r * 2 * Math.PI}`}
              transform={`rotate(${value >= 0 ? 131 + 280 * 0.5 : 131 + 280 * pct} ${r + 3} ${r + 3})`} />
          )}
        </svg>
        <div className="absolute rounded-full" style={{ inset: 6, background: `radial-gradient(circle at 42% 38%,${T.panel},${T.bg2})`, border: `1px solid ${dragging ? c + "40" : T.line}`, transition: "border-color 180ms ease" }} />
        <div className="absolute" style={{ width: 1, height: 4, background: `${T.dim}50`, left: "50%", top: 3, transform: "translateX(-50%)" }} />
        <div className="absolute" style={{ width: 2, height: r - 6, borderRadius: 1, background: c, boxShadow: `0 0 ${dragging ? 8 : 4}px ${c}${dragging ? "90" : "60"}`, left: "50%", top: 7, transformOrigin: `50% ${r - 3}px`, transform: `translateX(-50%) rotate(${angle}deg)`, transition: dragging ? "none" : "transform 120ms cubic-bezier(.2,0,.3,1)" }} />
      </div>
      <span style={{ color: c, fontSize: 8, fontFamily: "monospace", lineHeight: 1 }}>{toneLabel}</span>
    </div>
  );
}
