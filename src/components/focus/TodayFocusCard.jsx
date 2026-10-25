import { Timer } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { formatDuration, formatTimeRange, toDateKey } from '../../utils/dates';
import { getStudiedMinutes } from '../../utils/stats';
import { Card, CardHeader } from '../common/Card';
import EmptyState from '../common/EmptyState';

export default function TodayFocusCard() {
  const { tasks, sessions } = useAppData();
  const todayKey = toDateKey(new Date());

  const done = sessions
    .filter((session) => session.date === todayKey && session.status === 'completed')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const totalMinutes = done.reduce((sum, session) => sum + getStudiedMinutes(session), 0);
  const tasksById = Object.fromEntries(tasks.map((task) => [task.id, task]));

  return (
    <Card>
      <CardHeader title="Studied today" description="Completed sessions recorded today" />
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">Study time</p>
          <p className="mt-0.5 text-lg font-bold">{formatDuration(totalMinutes)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">Sessions</p>
          <p className="mt-0.5 text-lg font-bold">{done.length}</p>
        </div>
      </div>

      {done.length === 0 ? (
        <EmptyState
          compact
          icon={Timer}
          title="Nothing recorded yet"
          description="Finished focus sessions will appear here."
        />
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {done.map((session) => {
            const task = tasksById[session.taskId];
            return (
              <li key={session.id} className="py-2 first:pt-0 last:pb-0">
                <p className="break-words text-sm font-medium">{task ? task.title : 'Deleted task'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatTimeRange(session.start, session.end)} ·{' '}
                  {formatDuration(getStudiedMinutes(session))}
                  {session.source === 'timer' ? ' · Focus timer' : ''}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}