import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import MiniTimer from '../focus/MiniTimer';
import Brand from './Brand';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <Brand className="lg:hidden" />
        <p className="hidden truncate text-sm font-medium text-slate-500 dark:text-slate-400 sm:block">
          {today}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <MiniTimer />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:h-10 sm:w-10"
        >
          {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}