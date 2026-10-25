import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PRIORITY_META } from '../../data/schema';
import {
  combineDateAndTime,
  formatDateLabel,
  formatDeadline,
  formatDuration,
  formatTimeRange,
  parseDateKey,
  toDateKey,
} from '../../utils/dates';
import { getSessionMinutes } from '../../utils/stats';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Checkbox from '../common/Checkbox';
import Modal from '../common/Modal';
import { SESSION_STYLES } from './sessionStyles';

const SOURCE_LABELS = {
  manual: 'Added or placed manually',
  auto: 'Scheduled automatically',
  timer: 'Recorded by the focus timer',
};

function Row({ label, children }) {
  return (
    <>
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="col-span-2 break-words font-medium">{children}</dd>
    </>
  );
}

export default function SessionDetailsModal({
  session,
  task,
  hasConflict,
  now,
  onClose,
  onEdit,
  onComplete,
  onMissed,
  onDelete,
  onToggleLock,
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const styles = SESSION_STYLES[session.status];
  const planned = session.status === 'planned';
  const canComplete = session.date <= toDateKey(now);
  const canMiss = combineDateAndTime(session.date, session.end) <= now;
  const date = parseDateKey(session.date);

  let footer;
  if (!planned) {
    footer = (
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    );
  } else if (confirmingDelete) {
    footer = (
      <>
        <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
          Keep session
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Delete session
        </Button>
      </>
    );
  } else {
    footer = (
      <>
        <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
          Delete
        </Button>
        <Button variant="secondary" disabled={!canMiss} onClick={onMissed}>
          Mark missed
        </Button>
        <Button variant="secondary" disabled={!canComplete} onClick={onComplete}>
          Mark completed
        </Button>
        <Button disabled={session.locked} onClick={onEdit}>
          Edit
        </Button>
      </>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={task ? task.title : 'Deleted task'}
      description={`${formatDateLabel(session.date, now)}, ${formatTimeRange(
        session.start,
        session.end
      )}`}
      footer={footer}
    >
      <dl className="grid grid-cols-3 gap-x-3 gap-y-3 text-sm">
        <Row label="Status">
          <Badge tone={styles.tone}>{styles.label}</Badge>
          {session.locked && <span className="ml-2 text-xs text-slate-500">Locked</span>}
        </Row>
        {task && (
          <>
            <Row label="Subject">{task.subject}</Row>
            <Row label="Priority">
              <Badge tone={PRIORITY_META[task.priority].tone}>
                {PRIORITY_META[task.priority].label}
              </Badge>
            </Row>
            <Row label="Deadline">{formatDeadline(task.deadline, now)}</Row>
          </>
        )}
        <Row label="Date">
          {date
            ? date.toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : session.date}
        </Row>
        <Row label="Planned length">{formatDuration(getSessionMinutes(session))}</Row>
        {session.status === 'completed' && (
          <Row label="Studied">
            {formatDuration(session.actualMinutes ?? getSessionMinutes(session))}
          </Row>
        )}
        <Row label="Source">{SOURCE_LABELS[session.source]}</Row>
      </dl>

      {planned && !confirmingDelete && (
        <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <Checkbox
            label="Lock this session"
            checked={session.locked}
            onChange={(event) => onToggleLock(event.target.checked)}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Locked sessions are protected from automatic scheduling and cannot be dragged or edited
            until you unlock them.
          </p>
        </div>
      )}

      {hasConflict && planned && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          This session overlaps a fixed commitment. Unlock and edit it to move it to free time.
        </p>
      )}

      {planned && !confirmingDelete && (!canComplete || !canMiss) && (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          {!canComplete && 'You can mark a session completed on or after its day. '}
          {!canMiss && 'A session can be marked missed once it has ended.'}
        </p>
      )}

      {planned && confirmingDelete && (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Delete this planned session? The task and its other sessions are not affected.
        </p>
      )}

      {!planned && (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Completed and missed sessions are kept as study records and cannot be edited or deleted.
        </p>
      )}
    </Modal>
  );
}