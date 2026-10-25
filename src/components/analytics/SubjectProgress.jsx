import { BookOpen } from 'lucide-react';
import { formatDuration } from '../../utils/dates';
import { pluralize } from '../../utils/taskHelpers';
import EmptyState from '../common/EmptyState';

export default function SubjectProgress({ subjects }) {
  if (subjects.length === 0) {
    return (
      <EmptyState
        compact
        icon={BookOpen}
        title="No subjects yet"
        description="Add tasks to see your progress by subject."
      />
    );
  }

  return (
    <ul className="space-y-4">
      {subjects.map((subject) => (
        <li key={subject.subject}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 break-words text-sm font-medium">{subject.subject}</p>
            <p className="shrink-0 text-sm font-semibold">{subject.percent}%</p>
          </div>
          <div
            role="progressbar"
            aria-label={`${subject.subject} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={subject.percent}
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <div
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${subject.percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {subject.completedCount} of {pluralize(subject.taskCount, 'task')} done ·{' '}
            {formatDuration(subject.studiedMinutes)} studied of{' '}
            {formatDuration(subject.targetMinutes)} planned
          </p>
        </li>
      ))}
    </ul>
  );
}