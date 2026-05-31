'use client';

import { Sun, Moon } from 'lucide-react';
import { useNS } from './context';

export default function ThemeToggle() {
  const { dark, setDark, t } = useNS();
  return (
    <button
      onClick={() => setDark(d => !d)}
      className={`p-2.5 rounded-xl border ${t.border} ${t.bgCard} transition-all hover:scale-105`}
    >
      {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-gray-400" />}
    </button>
  );
}