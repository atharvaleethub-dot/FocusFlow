import { AlertTriangle } from 'lucide-react';
import { pluralize } from '../../utils/taskHelpers';
import Button from '../common/Button';

export default function MissedSessionsBanner({ count, onReview }) {
  if (count === 0) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold">
            {pluralize(count, 'planned session')} ended without being completed.
          </p>
          <p className="mt-0.5 opacity-80">
            If you studied, mark them completed on the calendar first. Otherwise, reschedule the
            unfinished time.
          </p>
        </div>
      </div>
      <Button size="sm" onClick={onReview} className="shrink-0">
        Review and reschedule
      </Button>
    </div>
  );
}