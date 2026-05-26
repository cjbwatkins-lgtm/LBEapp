export function Pill({ active, onClick, children, color, small = false, T }) {
  const c = color || T.accent;
  return (
    <button onClick={onClick}
      className={`lbe-t lbe-theme rounded-full font-mono uppercase tracking-wider ${small ? "text-[8px] px-2 py-0.5" : "text-[10px] px-3 py-1.5"}`}
      style={{
        background: active ? c + "22" : "transparent",
        border: `1px solid ${active ? c + "70" : T.line}`,
        color: active ? c : T.muted,
        boxShadow: active ? `0 0 10px ${c}28` : "none",
        minHeight: 32,
      }}>
      {children}
    </button>
  );
}
