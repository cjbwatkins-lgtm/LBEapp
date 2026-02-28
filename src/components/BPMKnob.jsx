import { useState, useRef } from 'react';
import { dbStart, dbEnd, dbSetMove, dbSetUp } from '../hooks';

export function BPMKnob({ value, min, max, onChange, T }) {
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const rafRef = useRef(0);
  const liveRef = useRef(value);
  const display = dragging && preview !== null ? preview : value;
  const pct = (display - min) / (max - min);
  const angle = pct * 280 - 140;
  const r = 44;

  const onDown = (e) => {
    e.preventDefault();
    dragRef.current = { y: e.clientY, v: value }; liveRef.current = value; setDragging(true);
    dbSetMove((ev) => {
      ev.preventDefault(); if (!dragRef.current) return;
      const dy = dragRef.current.y - ev.clientY;
      const nv = Math.round(Math.min(max, Math.max(min, dragRef.current.v + dy * 1.5)));
      liveRef.current = nv;
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
    <div className="flex flex-col items-center gap-1 select-none">
      <div onPointerDown={onDown} className="relative cursor-pointer" style={{ width: r * 2 + 8, height: r * 2 + 8, touchAction: "none" }}>
        <svg viewBox={`0 0 ${r * 2 + 8} ${r * 2 + 8}`} className="absolute inset-0">
          <circle cx={r + 4} cy={r + 4} r={r} fill="none" stroke={T.line} strokeWidth={3}
            strokeDasharray={`${r * 2 * Math.PI * .78} ${r * 2 * Math.PI * .22}`}
            transform={`rotate(131 ${r + 4} ${r + 4})`} />
          <circle cx={r + 4} cy={r + 4} r={r} fill="none" stroke={T.accent} strokeWidth={3}
            strokeLinecap="round" opacity={.85}
            strokeDasharray={`${r * 2 * Math.PI * .78 * pct} ${r * 2 * Math.PI}`}
            transform={`rotate(131 ${r + 4} ${r + 4})`} />
        </svg>
        <div className="absolute rounded-full" style={{ inset: 10, background: `radial-gradient(circle at 42% 38%,${T.panel},${T.bg2})`, border: `1px solid ${dragging ? T.accent + "40" : T.line}`, transition: "border-color 180ms ease" }} />
        <div className="absolute" style={{ width: 3, height: r - 10, borderRadius: 2, background: T.accent, boxShadow: `0 0 ${dragging ? 10 : 6}px ${T.accent}${dragging ? "a0" : "80"}`, left: "50%", top: 12, transformOrigin: `50% ${r - 2}px`, transform: `translateX(-50%) rotate(${angle}deg)`, transition: dragging ? "none" : "transform 120ms cubic-bezier(.2,0,.3,1)" }} />
      </div>
      <span style={{ color: T.accent, fontSize: 24, fontFamily: "monospace", fontWeight: 700, lineHeight: 1 }}>{display}</span>
      <span style={{ color: T.dim, fontSize: 8, letterSpacing: "0.25em" }}>BPM</span>
    </div>
  );
}
