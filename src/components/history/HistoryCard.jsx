import { History } from 'lucide-react';
import { HISTORY_LIMIT } from '../../data/schema';
import useHistory from '../../hooks/useHistory';
import Badge from '../common/Badge';
import { Card, CardHeader } from '../common/Card';
import EmptyState from '../common/EmptyState';
import UndoButton from './UndoButton';

export default function HistoryCard() {
  const { history } = useHistory();

  return (
    <Card>
      <CardHeader
        title="Schedule history"
        description={`The last ${HISTORY_LIMIT} schedule changes. Undo reverses the most recent one.`}
        action={<UndoButton size="sm" />}
      />

      {history.length === 0 ? (
        <EmptyState
          compact
          icon={History}
          title="No changes yet"
          description="Generating a schedule or editing sessions on the calendar will be listed here."
        />
      ) : (
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {history.map((entry, index) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{entry.label}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {new Date(entry.createdAt).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              {index === 0 && (
                <Badge tone="brand" className="shrink-0">
                  Latest
                </Badge>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Undo never removes study time you have already recorded.
      </p>
    </Card>
  );
}