import { Check, Pencil, Trash2 } from 'lucide-react';
import { PRIORITY_META } from '../../data/schema';
import cn from '../../utils/cn';
import { formatDeadline, formatDuration } from '../../utils/dates';
import { getDeadlineInfo, pluralize } from '../../utils/taskHelpers';
import Badge from '../common/Badge';
import { Card } from '../common/Card';
import IconButton from '../common/IconButton';

export default function TaskCard({ task, progress, now, onToggle, onEdit, onDelete }) {
  const priority = PRIORITY_META[task.priority];
  const deadline = getDeadlineInfo(task, now);

  return (
    <li>
      <Card as="div" padding="p-4" hover>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={task.completed}
            aria-label={
              task.completed
                ? `Mark "${task.title}" as not completed`
                : `Mark "${task.title}" as completed`
            }
            className="-m-2.5 shrink-0 rounded-full p-2.5"
          >
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                task.completed
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-slate-300 text-transparent hover:border-brand-500 dark:border-slate-600'
              )}
            >
              <Check size={14} strokeWidth={3} aria-hidden="true" />
            </span>
          </button>

          <div className="ml-1 min-w-0 flex-1">
            <h3
              className={cn(
                'break-words text-sm font-semibold sm:text-base',
                task.completed && 'text-slate-500 line-through dark:text-slate-500'
              )}
            >
              {task.title}
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge>{task.subject}</Badge>
              <Badge tone={priority.tone}>{priority.label}</Badge>
              {task.completed && <Badge tone="success">Completed</Badge>}
              {deadline.label && <Badge tone={deadline.tone}>{deadline.label}</Badge>}
            </div>

            <p
              className={cn(
                'mt-2 text-xs sm:text-sm',
                deadline.state === 'overdue'
                  ? 'font-medium text-rose-600 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-300'
              )}
            >
              Due {formatDeadline(task.deadline, now)}
              {deadline.relative ? ` (${deadline.relative})` : ''}
            </p>

            {task.notes && (
              <p className="mt-2 line-clamp-2 break-words text-sm text-slate-500 dark:text-slate-400">
                {task.notes}
              </p>
            )}

            <div
              role="progressbar"
              aria-label="Study progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  task.completed ? 'bg-emerald-500' : 'bg-brand-600'
                )}
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Estimated {formatDuration(task.estimatedMinutes)} · Studied{' '}
              {formatDuration(progress.studied)}
              {task.completed ? '' : ` · Remaining ${formatDuration(progress.remaining)}`}
              {!task.completed &&
                (progress.plannedSessions > 0
                  ? ` · ${pluralize(progress.plannedSessions, 'planned session')}`
                  : ' · Not scheduled yet')}
            </p>
          </div>

          <div className="-mr-1 -mt-1 flex shrink-0 flex-col gap-0.5 sm:flex-row">
            <IconButton icon={Pencil} label={`Edit "${task.title}"`} onClick={onEdit} />
            <IconButton
              icon={Trash2}
              tone="danger"
              label={`Delete "${task.title}"`}
              onClick={onDelete}
            />
          </div>
        </div>
      </Card>
    </li>
  );
}