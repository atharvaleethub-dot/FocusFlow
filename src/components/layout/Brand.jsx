import { CalendarClock } from 'lucide-react';
import cn from '../../utils/cn';

export default function Brand({ className }) {
  return (
    <a
      href="#/dashboard"
      aria-label="FocusFlow home"
      className={cn('flex items-center gap-3 rounded-lg', className)}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
        <CalendarClock size={20} aria-hidden="true" />
      </span>
      {/* On very narrow phones only the icon is shown, so the header never overflows. */}
      <span className="hidden text-lg font-bold tracking-tight min-[380px]:inline">FocusFlow</span>
    </a>
  );
}