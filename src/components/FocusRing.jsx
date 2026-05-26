import { pad2 } from '../constants';

export function FocusRing({ progress, phase, T, secsLeft, isPaused, justStarted }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const stroke = circ * progress;
  const workColor = T.accent;
  const breakColor = T.ok;
  const isBreakPhase = phase === "break" || phase === "break_done";
  const ringColor = isPaused ? T.muted : isBreakPhase ? breakColor : workColor;
  const mm = pad2(Math.floor(secsLeft / 60));
  const ss = pad2(secsLeft % 60);
  const label = isPaused ? "Paused"
    : phase === "work_done"  ? "Done!"
    : phase === "break_done" ? "Ready"
    : phase === "break"      ? "Break"
    : phase === "work"       ? "Focus"
    : "Ready";
  const labelColor = isPaused ? T.muted : isBreakPhase ? breakColor : phase === "work" ? workColor : T.dim;
  const ringStroke = phase === "work" && !isPaused ? 5 : 4;

  return (
    <div className={`relative flex items-center justify-center ${phase === "work" && !isPaused ? "lbe-focus-breathe" : ""} ${phase === "work_done" || phase === "break_done" ? "lbe-ring-done" : ""} ${justStarted ? "lbe-ring-lock" : ""} ${isPaused ? "lbe-ring-paused" : ""}`}
      style={{ width: 180, height: 180 }}>
      <svg viewBox="0 0 160 160" className="absolute inset-0 lbe-ring-glow" style={{ width: "100%", height: "100%" }}>
        <circle cx="80" cy="80" r={r} fill="none" stroke={T.line} strokeWidth={4} opacity={0.5} />
        <circle cx="80" cy="80" r={r} fill="none" stroke={ringColor} strokeLinecap="round"
          className="lbe-ring-progress" strokeWidth={ringStroke}
          strokeDasharray={`${stroke} ${circ}`} transform="rotate(-90 80 80)"
          style={{ transition: "stroke-dasharray 0.95s linear,stroke 400ms ease,stroke-width 250ms ease" }} />
        {progress > 0.01 && progress < 0.99 && (
          <circle cx="80" cy="80" r={r} fill="none" stroke={ringColor} strokeWidth={8}
            strokeLinecap="round" opacity={0.12} className="lbe-ring-progress"
            strokeDasharray={`${Math.min(stroke, 8)} ${circ}`} transform="rotate(-90 80 80)"
            style={{ transition: "stroke-dasharray 0.95s linear", filter: "blur(3px)" }} />
        )}
      </svg>
      <div className="flex flex-col items-center z-10">
        <div className="font-mono font-bold lbe-digits" style={{ fontSize: 36, color: isPaused ? T.muted : T.text, letterSpacing: "0.05em", lineHeight: 1 }}>
          {mm}<span className={phase !== "idle" && !isPaused ? "lbe-colon" : ""} style={{ color: T.dim }}>:</span>{ss}
        </div>
        <span className="lbe-theme mt-1" style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: labelColor, fontWeight: 600 }}>
          {label}
        </span>
      </div>
    </div>
  );
}
