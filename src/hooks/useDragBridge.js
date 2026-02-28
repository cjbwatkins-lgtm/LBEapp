import { useRef, useEffect } from 'react';

// Global drag bridge — singleton shared across all drag controls
const _db = { move: null, up: null, el: null };

export function dbStart() {
  if (_db.el) _db.el.style.pointerEvents = "all";
}

export function dbEnd() {
  _db.move = null;
  _db.up = null;
  if (_db.el) _db.el.style.pointerEvents = "none";
}

export function dbSetMove(fn) { _db.move = fn; }
export function dbSetUp(fn) { _db.up = fn; }
export function dbGetMove() { return _db.move; }
export function dbGetUp() { return _db.up; }

// Hook to register the overlay element
export function useDragOverlay() {
  const ref = useRef(null);
  useEffect(() => {
    _db.el = ref.current;
    return () => { _db.el = null; };
  }, []);

  const onPointerMove = (e) => { e.preventDefault(); _db.move?.(e); };
  const onPointerUp = () => { _db.up?.(); };
  const onPointerCancel = () => { _db.up?.(); };

  return { ref, onPointerMove, onPointerUp, onPointerCancel };
}
