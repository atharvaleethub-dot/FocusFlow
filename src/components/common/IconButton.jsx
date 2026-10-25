import cn from '../../utils/cn';

const tones = {
  neutral:
    'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  danger:
    'text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400',
};

export default function IconButton({ icon: Icon, label, tone = 'neutral', className, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors sm:h-9 sm:w-9',
        tones[tone],
        className
      )}
      {...props}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}