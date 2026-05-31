import { useCallback, useRef, useState } from 'react';
import type { SliderState } from '@/types';

const MAX = 50;

export function useHistory(initial: SliderState) {
  const [past, setPast] = useState<SliderState[]>([]);
  const [future, setFuture] = useState<SliderState[]>([]);
  const cur = useRef<SliderState>(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Call this every time sliders change — it debounces 400 ms */
  const push = useCallback((s: SliderState) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPast(p => [...p.slice(-(MAX - 1)), cur.current]);
      setFuture([]);
      cur.current = s;
    }, 400);
    cur.current = s;
  }, []);

  const undo = useCallback((): SliderState | null => {
    if (past.length === 0) return null;
    const prev = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [cur.current, ...f]);
    cur.current = prev;
    return prev;
  }, [past]);

  const redo = useCallback((): SliderState | null => {
    if (future.length === 0) return null;
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p, cur.current]);
    cur.current = next;
    return next;
  }, [future]);

  return { push, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}