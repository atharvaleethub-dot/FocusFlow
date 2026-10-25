import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
import AgendaView from '../components/calendar/AgendaView';
import SessionDetailsModal from '../components/calendar/SessionDetailsModal';
import SessionFormModal from '../components/calendar/SessionFormModal';
import WeekCalendar from '../components/calendar/WeekCalendar';
import Button from '../components/common/Button';
import { Card } from '../components/common/Card';
import IconButton from '../components/common/IconButton';
import PageHeader from '../components/common/PageHeader';
import UndoButton from '../components/history/UndoButton';
import MissedSessionsBanner from '../components/schedule/MissedSessionsBanner';
import { useScheduleReview } from '../context/ScheduleReviewContext';
import { useToast } from '../context/ToastContext';
import useFinePointer from '../hooks/useFinePointer';
import useNow from '../hooks/useNow';
import useSessions from '../hooks/useSessions';
import cn from '../utils/cn';
import {
  addDays,
  formatDateLabel,
  formatDuration,
  formatTimeRange,
  getWeekDateKeys,
  minutesToTime,
  startOfWeek,
  toDateKey,
} from '../utils/dates';
import { findCommitmentConflicts, getDefaultSessionTimes } from '../utils/schedulingHelpers';
import { getStalePlannedSessions } from '../utils/scheduleStatus';
import { nudgeCandidate } from '../utils/sessionMove';
import { getWeeklyTotals } from '../utils/stats';

const VIEWS = [
  { value: 'week', label: 'Week' },
  { value: 'agenda', label: 'Agenda' },
];

function getInitialView() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'week';
  return window.matchMedia('(min-width: 768px)').matches ? 'week' : 'agenda';
}

export default function CalendarPage() {
  const now = useNow();
  const toast = useToast();
  const canDrag = useFinePointer();
  const { openScheduleReview } = useScheduleReview();
  const {
    tasks,
    sessions,
    commitments,
    availability,
    settings,
    addSession,
    updateSession,
    deleteSession,
    markCompleted,
    markMissed,
    moveSession,
    setSessionLocked,
  } = useSessions();

  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState(getInitialView);
  const [selectedId, setSelectedId] = useState(null);
  const [formState, setFormState] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const pendingFocusRef = useRef(null);

  // After a keyboard move the block re-renders (possibly in another day column), so focus is restored.
  useEffect(() => {
    if (!pendingFocusRef.current) return;
    const element = document.querySelector(`[data-session-id="${pendingFocusRef.current}"]`);
    if (element) element.focus();
    pendingFocusRef.current = null;
  });

  const todayKey = toDateKey(now);
  const weekStart = addDays(startOfWeek(now, settings.weekStartsOn), weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  const weekKeys = getWeekDateKeys(weekStart);
  const rangeLabel = `${weekStart.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })} - ${weekEnd.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;

  const tasksById = Object.fromEntries(tasks.map((task) => [task.id, task]));
  const conflictIds = new Set(
    sessions
      .filter(
        (session) =>
          session.status === 'planned' && findCommitmentConflicts(commitments, session).length > 0
      )
      .map((session) => session.id)
  );
  const totals = getWeeklyTotals(sessions, weekKeys);
  const staleCount = getStalePlannedSessions(sessions, now).length;
  const selected = selectedId ? sessions.find((session) => session.id === selectedId) : null;
  const state = { tasks, sessions, commitments, availability };

  const openCreate = (dateKey = null, startMinutes = null) => {
    const date = dateKey ?? (weekOffset === 0 ? todayKey : weekKeys[0]);
    let times = getDefaultSessionTimes(date, now, availability);
    if (startMinutes !== null) {
      const endMinutes = Math.min(startMinutes + availability.preferredSessionMinutes, 23 * 60 + 59);
      times = { start: minutesToTime(startMinutes), end: minutesToTime(endMinutes) };
    }
    setFormState({ session: null, defaults: { date, ...times } });
  };

  const handleSave = (values) => {
    const taskTitle = tasksById[values.taskId] ? tasksById[values.taskId].title : 'Session';
    if (formState.session) {
      const result = updateSession(formState.session.id, values);
      if (result.session) {
        toast.success('Session updated', `${taskTitle} on ${formatDateLabel(values.date, now)}.`);
      } else {
        toast.error('Could not update the session', 'Only planned sessions can be edited.');
      }
    } else {
      addSession(values);
      toast.success('Session added', `${taskTitle} on ${formatDateLabel(values.date, now)}.`);
    }
    setFormState(null);
  };

  // Shared by drag-and-drop and the keyboard alternative. The move is validated again before saving.
  const performMove = (session, candidate, viaKeyboard) => {
    const result = moveSession(session.id, candidate);
    const label = tasksById[session.taskId] ? tasksById[session.taskId].title : 'Session';

    if (result.session) {
      const when = `${formatDateLabel(candidate.date, now)}, ${formatTimeRange(
        candidate.start,
        candidate.end
      )}`;
      const { warnings } = result.validation;
      setAnnouncement(
        `Moved ${label} to ${when}.${warnings.length > 0 ? ` Warning: ${warnings.join(' ')}` : ''}`
      );
      if (warnings.length > 0) {
        toast.warning('Session moved', `${when}. ${warnings.join(' ')}`);
      } else if (!viaKeyboard) {
        toast.success('Session moved', `${label}: ${when}.`);
      }
      if (viaKeyboard) pendingFocusRef.current = session.id;
      return;
    }

    if (result.validation.isNoop) return;
    const message = result.validation.errors[0] ?? 'The session could not be moved.';
    setAnnouncement(`Could not move ${label}. ${message}`);
    toast.error('Cannot move this session', message);
  };

  const handleDropMove = (session, candidate) => performMove(session, candidate, false);
  const handleKeyboardMove = (session, move) =>
    performMove(session, nudgeCandidate(session, move), true);

  const handleToggleLock = (locked) => {
    const result = setSessionLocked(selected.id, locked);
    if (result.session) {
      toast.info(
        locked ? 'Session locked' : 'Session unlocked',
        locked
          ? 'Automatic scheduling will not move it.'
          : 'Automatic scheduling may move it again.'
      );
    }
  };

  const handleComplete = () => {
    const result = markCompleted(selected.id);
    if (result.session) {
      toast.success(
        'Session completed',
        `Recorded ${formatDuration(result.session.actualMinutes)} of study time.`
      );
    }
    setSelectedId(null);
  };

  const handleMissed = () => {
    const result = markMissed(selected.id);
    if (result.session) toast.info('Session marked as missed', 'It is kept in your study record.');
    setSelectedId(null);
  };

  const handleDelete = () => {
    const result = deleteSession(selected.id);
    if (result.session) toast.success('Session deleted', 'The planned session was removed.');
    setSelectedId(null);
  };

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Your weekly study schedule and fixed commitments."
        actions={
          <>
            <Button icon={Plus} onClick={() => openCreate()}>
              Add session
            </Button>
            <Button
              variant="secondary"
              icon={Sparkles}
              onClick={() => openScheduleReview('generate')}
            >
              Generate schedule
            </Button>
            <UndoButton />
          </>
        }
      />

      <MissedSessionsBanner
        count={staleCount}
        onReview={() => openScheduleReview('reschedule')}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton
            icon={ChevronLeft}
            label="Previous week"
            onClick={() => setWeekOffset((offset) => offset - 1)}
          />
          <IconButton
            icon={ChevronRight}
            label="Next week"
            onClick={() => setWeekOffset((offset) => offset + 1)}
          />
          <Button
            variant="secondary"
            size="sm"
            className="ml-1"
            disabled={weekOffset === 0}
            onClick={() => setWeekOffset(0)}
          >
            Today
          </Button>
          <p className="ml-2 text-sm font-semibold" aria-live="polite">
            {rangeLabel}
          </p>
        </div>

        <div
          role="group"
          aria-label="Calendar view"
          className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
        >
          {VIEWS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={view === option.value}
              onClick={() => setView(option.value)}
              className={cn(
                'min-h-[40px] rounded-lg px-4 text-sm font-medium transition-colors sm:min-h-0 sm:py-1.5',
                view === option.value
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        This week: {formatDuration(totals.plannedMinutes)} planned,{' '}
        {formatDuration(totals.completedMinutes)} completed.
      </p>

      {view === 'week' ? (
        <>
          <Card padding="p-0" className="overflow-hidden">
            <WeekCalendar
              weekKeys={weekKeys}
              todayKey={todayKey}
              now={now}
              sessions={sessions}
              commitments={commitments}
              availability={availability}
              tasksById={tasksById}
              conflictIds={conflictIds}
              state={state}
              canDrag={canDrag}
              onSelectSession={setSelectedId}
              onCreateAt={openCreate}
              onMoveSession={handleDropMove}
              onMoveByKey={handleKeyboardMove}
            />
          </Card>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Tip: click an empty time slot to add a session.{' '}
            {canDrag
              ? 'To move a session without dragging, focus it and press Shift + arrow keys (up/down: 15 minutes, left/right: one day).'
              : 'To move a session, tap it and choose Edit.'}
          </p>
        </>
      ) : (
        <AgendaView
          weekKeys={weekKeys}
          todayKey={todayKey}
          sessions={sessions}
          commitments={commitments}
          availability={availability}
          tasksById={tasksById}
          conflictIds={conflictIds}
          onSelectSession={setSelectedId}
          onAddSession={(dateKey) => openCreate(dateKey)}
        />
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-brand-300 bg-brand-100" /> Planned
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-100" /> Completed
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-rose-300 bg-rose-50" /> Missed
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-slate-300 bg-slate-200" /> Fixed commitment
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-brand-50 ring-1 ring-brand-100" /> Study window
        </li>
      </ul>

      {selected && (
        <SessionDetailsModal
          key={selected.id}
          session={selected}
          task={tasksById[selected.taskId]}
          hasConflict={conflictIds.has(selected.id)}
          now={now}
          onClose={() => setSelectedId(null)}
          onEdit={() => {
            setSelectedId(null);
            setFormState({ session: selected, defaults: null });
          }}
          onComplete={handleComplete}
          onMissed={handleMissed}
          onDelete={handleDelete}
          onToggleLock={handleToggleLock}
        />
      )}

      {formState && (
        <SessionFormModal
          key={formState.session ? formState.session.id : 'new-session'}
          session={formState.session}
          defaults={formState.defaults}
          state={state}
          now={now}
          onSubmit={handleSave}
          onClose={() => setFormState(null)}
        />
      )}
    </>
  );
}