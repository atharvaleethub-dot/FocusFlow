import { ShieldCheck } from 'lucide-react';
import cn from '../../utils/cn';
import Brand from './Brand';
import { navItems } from './navItems';

export default function Sidebar({ route }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
      <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-6 dark:border-slate-800">
        <Brand />
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = route === path;
          return (
            <a
              key={path}
              href={`#${path}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              )}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </a>
          );
        })}
      </nav>

      <div className="p-4">
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
          <p>Your data stays on this device in your browser. No account needed.</p>
        </div>
      </div>
    </aside>
  );
}