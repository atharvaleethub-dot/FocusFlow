import { Check, Pause, Timer } from 'lucide-react';
import { useTimer } from '../../context/TimerContext';
import { PHASE_LABELS, formatClock } from '../../services/timerEngine';

// Header chip so a running timer is visible (and reachable) from every page.
export default function MiniTimer() {
  const { timer, remainingMs } = useTimer();
  if (timer.status === 'idle') return null;

  const finished = timer.status === 'finished';
  const paused = timer.status === 'paused';
  const text = finished ? 'Done' : formatClock(remainingMs);
  const Icon = finished ? Check : paused ? Pause : Timer;

  return (
    <a
      href="#/focus"
      aria-label={`${PHASE_LABELS[timer.phase]} timer, ${finished ? 'finished' : paused ? 'paused' : 'running'}, ${text}. Open the focus timer.`}
      className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-semibold tabular-nums text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200 sm:h-10"
    >
      <Icon size={16} aria-hidden="true" />
      <span>{text}</span>
    </a>
  );
}