import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { hasPlanChanges } from '../../services/scheduleActions';
import { combineDateAndTime, formatDuration } from '../../utils/dates';
import { pluralize } from '../../utils/taskHelpers';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Checkbox from '../common/Checkbox';
import Modal from '../common/Modal';
import SessionChangeList from './SessionChangeList';
import UnscheduledList from './UnscheduledList';

const BANNER_STYLES = {
  success: {
    icon: CheckCircle2,
    box: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  },
  warning: {
    icon: AlertTriangle,
    box: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  },
};

// Never claims success while any task is left unscheduled.
function getBanner({ summary, hasChanges, applied }) {
  if (applied) {
    return summary.success
      ? {
          tone: 'success',
          title: 'Schedule updated',
          text: 'All outstanding work now fits before its deadlines.',
        }
      : {
          tone: 'warning',
          title: 'Schedule partly updated',
          text: `${pluralize(
            summary.unscheduledCount,
            'task'
          )} could not be fully scheduled. See why below.`,
        };
  }
  if (!hasChanges) {
    return summary.success
      ? { tone: 'success', title: 'Nothing to change', text: 'Your schedule is already up to date.' }
      : {
          tone: 'warning',
          title: 'No changes possible',
          text: 'The tasks below cannot be fitted with your current availability.',
        };
  }
  return summary.success
    ? {
        tone: 'success',
        title: 'Ready to apply',
        text: 'All outstanding work fits before its deadlines.',
      }
    : {
        tone: 'warning',
        title: 'Only part of your work fits',
        text: 'Review the tasks below that cannot be fully scheduled before applying.',
      };
}

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

function ReviewSection({ title, count, open, children }) {
  if (count === 0) return null;
  return (
    <details open={open} className="rounded-xl border border-slate-200 dark:border-slate-700">
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold">
        <span>{title}</span>
        <Badge>{count}</Badge>
      </summary>
      <div className="border-t border-slate-200 p-3 dark:border-slate-700">{children}</div>
    </details>
  );
}

export default function ScheduleReviewModal({
  review,
  onRebuildChange,
  onApply,
  onUndo,
  onClose,
}) {
  const { plan, basis, mode, rebuild, step, now } = review;
  const { summary } = plan;
  const applied = step === 'applied';
  const hasChanges = hasPlanChanges(plan);
  const banner = getBanner({ summary, hasChanges, applied });
  const BannerIcon = BANNER_STYLES[banner.tone].icon;
  const tasksById = Object.fromEntries(basis.tasks.map((task) => [task.id, task]));

  const lockedCount = basis.sessions.filter(
    (session) =>
      session.status === 'planned' &&
      session.locked &&
      combineDateAndTime(session.date, session.end) > now
  ).length;

  let title = 'Generate schedule';
  if (applied) title = 'Schedule updated';
  else if (mode === 'reschedule') title = 'Reschedule missed sessions';

  const footer = applied ? (
    <>
      {hasChanges && (
        <Button variant="secondary" onClick={onUndo}>
          Undo this change
        </Button>
      )}
      <Button onClick={onClose}>Close</Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={onApply} disabled={!hasChanges}>
        Apply changes
      </Button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={
        applied
          ? 'Your calendar has been updated. You can undo this change.'
          : 'Review the proposed changes. Nothing is saved until you apply them.'
      }
      size="lg"
      footer={footer}
    >
      <div className="space-y-4">
        <div
          role="status"
          className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${
            BANNER_STYLES[banner.tone].box
          }`}
        >
          <BannerIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{banner.title}</p>
            <p className="mt-0.5 opacity-90">{banner.text}</p>
          </div>
        </div>

        {!applied && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile
                label="New sessions"
                value={summary.addedCount}
                hint={formatDuration(summary.addedMinutes)}
              />
              <StatTile label="Removed" value={summary.removedCount} />
              <StatTile label="Newly missed" value={summary.newlyMissedCount} />
              <StatTile
                label="Cannot fit"
                value={summary.unscheduledCount}
                hint={
                  summary.shortfallMinutes > 0
                    ? `${formatDuration(summary.shortfallMinutes)} short`
                    : undefined
                }
              />
            </div>

            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <Checkbox
                label="Also replan unlocked automatic sessions"
                checked={rebuild}
                onChange={(event) => onRebuildChange(event.target.checked)}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Re-optimizes the plan by priority and deadline. Locked sessions, manual sessions,
                and completed work are never moved.
              </p>
            </div>

            {lockedCount > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {pluralize(lockedCount, 'locked session')} will stay exactly where{' '}
                {lockedCount === 1 ? 'it is' : 'they are'}.
              </p>
            )}
          </>
        )}

        <ReviewSection
          title="Cannot be fully scheduled"
          count={plan.unscheduled.length}
          open
        >
          <UnscheduledList items={plan.unscheduled} now={now} />
        </ReviewSection>

        <ReviewSection title="Warnings" count={plan.warnings.length} open>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {plan.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.sessionId}`}>{warning.message}</li>
            ))}
          </ul>
        </ReviewSection>

        {!applied && (
          <>
            <ReviewSection
              title="New sessions"
              count={plan.added.length}
              open={plan.added.length <= 8}
            >
              <SessionChangeList
                items={plan.added.map((session) => ({ session }))}
                tasksById={tasksById}
                now={now}
              />
            </ReviewSection>

            <ReviewSection title="Sessions to remove" count={plan.removed.length} open>
              <SessionChangeList
                items={plan.removed.map(({ session, message }) => ({ session, note: message }))}
                tasksById={tasksById}
                now={now}
              />
            </ReviewSection>

            <ReviewSection title="Newly missed" count={plan.newlyMissed.length} open>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                These sessions ended without being completed. If you actually studied, close this
                window and mark them completed on the calendar first.
              </p>
              <SessionChangeList
                items={plan.newlyMissed.map((session) => ({
                  session,
                  note: 'Will be recorded as missed. The unfinished time is replanned.',
                }))}
                tasksById={tasksById}
                now={now}
              />
            </ReviewSection>
          </>
        )}
      </div>
    </Modal>
  );
}