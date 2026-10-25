import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useScheduleReview } from '../../context/ScheduleReviewContext';
import { pluralize } from '../../utils/taskHelpers';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';

const SEVERITY = {
  danger: {
    icon: XCircle,
    box: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100',
  },
  warning: {
    icon: AlertTriangle,
    box: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
  },
  info: {
    icon: Info,
    box: 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100',
  },
};

// limit: show only the first N warnings with a link to the rest. emptyText: show a message when there are none.
export default function AlertsPanel({ alerts, limit = null, emptyText = null }) {
  const { openScheduleReview } = useScheduleReview();

  if (alerts.length === 0) {
    if (!emptyText) return null;
    return (
      <EmptyState compact icon={CheckCircle2} title="No warnings" description={emptyText} />
    );
  }

  const shown = limit ? alerts.slice(0, limit) : alerts;
  const hidden = alerts.length - shown.length;

  return (
    <section aria-label="Warnings" className={limit ? 'mb-4' : undefined}>
      <ul className="space-y-2">
        {shown.map((item) => {
          const tone = SEVERITY[item.severity];
          const Icon = tone.icon;
          return (
            <li
              key={item.id}
              className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${tone.box}`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                <div className="min-w-0 text-sm">
                  <p className="break-words font-semibold">{item.title}</p>
                  <p className="mt-0.5 break-words opacity-90">{item.message}</p>
                </div>
              </div>
              {item.action === 'generate' && (
                <Button size="sm" className="shrink-0" onClick={() => openScheduleReview('generate')}>
                  Generate schedule
                </Button>
              )}
              {item.action === 'reschedule' && (
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => openScheduleReview('reschedule')}
                >
                  Review and reschedule
                </Button>
              )}
              {!item.action && item.href && (
                <Button size="sm" variant="secondary" className="shrink-0" href={item.href}>
                  Open
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <p className="mt-2 text-sm">
          <a
            href="#/analytics"
            className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300"
          >
            View {pluralize(hidden, 'more warning')}
          </a>
        </p>
      )}
    </section>
  );
}