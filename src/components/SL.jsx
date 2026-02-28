export function SL({ children, T }) {
  return (
    <div className="lbe-label-fade" style={{ fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: T.dim, marginBottom: 6 }}>
      {children}
    </div>
  );
}
