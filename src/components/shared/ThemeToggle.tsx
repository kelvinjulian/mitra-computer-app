'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/10 animate-pulse" />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center shadow-sm"
      aria-label="Ubah Tema"
      title={isDark ? "Ganti ke Tema Terang" : "Ganti ke Tema Gelap"}
    >
      {isDark ? (
        <Sun size={18} className="text-amber-500 transition-transform duration-300 rotate-0 hover:rotate-12" />
      ) : (
        <Moon size={18} className="text-slate-650 dark:text-slate-400 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}
