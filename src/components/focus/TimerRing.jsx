import { formatClock } from '../../services/timerEngine';
import cn from '../../utils/cn';

const RADIUS = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STROKES = {
  focus: 'stroke-brand-600',
  shortBreak: 'stroke-emerald-500',
  longBreak: 'stroke-sky-500',
};

export default function TimerRing({ remainingMs, durationMs, phase, label }) {
  const progress =
    durationMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / durationMs)) : 0;

  return (
    <div
      role="timer"
      aria-label={`${label}: ${formatClock(remainingMs)} remaining`}
      className="relative mx-auto aspect-square w-full max-w-[260px]"
    >
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className={cn('transition-[stroke-dashoffset] duration-300', STROKES[phase])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
          {formatClock(remainingMs)}
        </span>
        <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</span>
      </div>
    </div>
  );
}