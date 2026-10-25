import cn from '../../utils/cn';
import { navItems } from './navItems';

export default function MobileNav({ route }) {
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
    >
      <ul className="grid grid-cols-6">
        {navItems.map(({ path, short, label, icon: Icon }) => {
          const active = route === path;
          return (
            <li key={path} className="min-w-0">
              <a
                href={`#${path}`}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                className={cn(
                  'flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors',
                  active
                    ? 'text-brand-600 dark:text-brand-300'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                )}
              >
                <Icon size={20} aria-hidden="true" />
                <span className="max-w-full truncate">{short}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}