import cn from '../../utils/cn';
import Card from '../common/Card';

const tones = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
};

export default function StatCard({ icon: Icon, label, value = '—', hint, tone = 'brand' }) {
  return (
    <Card hover padding="p-4 sm:p-5">
      <span
        className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tones[tone])}
      >
        <Icon size={20} aria-hidden="true" />
      </span>
      <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </Card>
  );
}