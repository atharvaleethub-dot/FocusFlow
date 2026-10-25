import { PRIORITY_META } from '../../data/schema';
import { formatDeadline } from '../../utils/dates';
import Badge from '../common/Badge';

export default function DeadlineList({ tasks, now, flagFor }) {
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {tasks.map((task) => {
        const priority = PRIORITY_META[task.priority];
        const flag = flagFor ? flagFor(task) : null;
        return (
          <li
            key={task.id}
            className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{task.title}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {task.subject} · Due {formatDeadline(task.deadline, now)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {flag && <Badge tone={flag.tone}>{flag.label}</Badge>}
              <Badge tone={priority.tone}>{priority.label}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}