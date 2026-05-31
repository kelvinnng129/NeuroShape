import { useEffect, useRef } from 'react';

export interface ShortcutMap {
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onControls: () => void;
  onDark: () => void;
  onAnimate: () => void;
  onResetView: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutMap, enabled: boolean) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const fn = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const h = ref.current;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 'z') { e.preventDefault(); e.shiftKey ? h.onRedo() : h.onUndo(); return; }
      if (mod && e.key === 'y') { e.preventDefault(); h.onRedo(); return; }

      switch (e.key.toLowerCase()) {
        case 'e': h.onExport(); break;
        case ' ': e.preventDefault(); h.onControls(); break;
        case 'd': h.onDark(); break;
        case 'a': h.onAnimate(); break;
        case 'r': h.onResetView(); break;
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [enabled]);
}