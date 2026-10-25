import { useState } from 'react';
import { Check, Coffee, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useTimer } from '../../context/TimerContext';
import { useToast } from '../../context/ToastContext';
import useTasks from '../../hooks/useTasks';
import { PHASE_LABELS } from '../../services/timerEngine';
import cn from '../../utils/cn';
import { formatDuration } from '../../utils/dates';
import { getTaskStudiedMinutes } from '../../utils/stats';
import { pluralize } from '../../utils/taskHelpers';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { Card } from '../common/Card';
import ConfirmDialog from '../common/ConfirmDialog';
import EmptyState from '../common/EmptyState';
import Select from '../common/Select';
import TimerRing from './TimerRing';

const REASON_MESSAGES = {
  'too-short': 'The session was shorter than 1 minute, so nothing was recorded.',
  'task-missing': 'The task was deleted, so the time could not be recorded.',
  duplicate: 'This session was already recorded.',
};

export default function TimerPanel() {
  const { tasks, sessions } = useAppData();
  const { setTaskCompleted } = useTasks();
  const toast = useToast();
  const {
    timer,
    focus,
    remainingMs,
    durationMs,
    elapsedMs,
    selectTask,
    startFocus,
    startBreak,
    pause,
    resume,
    finishEarly,
    discard,
    skipBreak,
  } = useTimer();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const activeTasks = tasks
    .filter((task) => !task.completed)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const selectedTask = activeTasks.find((task) => task.id === timer.taskId) ?? null;

  const { status, phase, outcome } = timer;
  const isFocus = phase === 'focus';
  const active = status === 'running' || status === 'paused';
  const canSave = elapsedMs >= 60000;
  const cycleSize = focus.sessionsBeforeLongBreak;
  const cycleDone = Math.min(timer.cycleCount, cycleSize);
  const longBreakDue = timer.cycleCount >= cycleSize;

  const outcomeTask = outcome ? tasks.find((task) => task.id === outcome.taskId) : null;
  const outcomeStudied = outcomeTask ? getTaskStudiedMinutes(outcomeTask.id, sessions) : 0;
  const outcomePercent = outcomeTask
    ? Math.min(100, Math.round((outcomeStudied / outcomeTask.estimatedMinutes) * 100))
    : 0;

  const statusMessage = {
    idle: 'Timer ready.',
    running: `${PHASE_LABELS[phase]} running.`,
    paused: `${PHASE_LABELS[phase]} paused.`,
    finished: `${PHASE_LABELS[phase]} finished.`,
  }[status];

  const handleDiscard = () => {
    if (isFocus && canSave) setConfirmDiscard(true);
    else discard();
  };

  const confirmDiscardRun = () => {
    setConfirmDiscard(false);
    discard();
  };

  const handleMarkCompleted = () => {
    const result = setTaskCompleted(outcome.taskId, true);
    if (result.task) {
      toast.success(
        'Task completed',
        result.removedSessions > 0
          ? `${pluralize(result.removedSessions, 'planned session')} removed. Your recorded study time was kept.`
          : 'Great work!'
      );
    }
  };

  const phaseTone = phase === 'focus' ? 'brand' : 'success';

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone={phaseTone}>{PHASE_LABELS[phase]}</Badge>
        <div
          role="img"
          aria-label={`${cycleDone} of ${cycleSize} focus sessions done in this cycle`}
          className="flex items-center gap-1.5"
        >
          {Array.from({ length: cycleSize }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                index < cycleDone ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'
              )}
            />
          ))}
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>

      <TimerRing
        remainingMs={remainingMs}
        durationMs={durationMs ?? 0}
        phase={phase}
        label={PHASE_LABELS[phase]}
      />

      {activeTasks.length === 0 && status === 'idle' ? (
        <EmptyState
          compact
          title="No active tasks"
          description="Create a task first, then choose it here to start a focus session."
          action={
            <Button variant="secondary" href="#/tasks">
              Go to tasks
            </Button>
          }
        />
      ) : (
        <Select
          label="Task"
          value={selectedTask ? selectedTask.id : ''}
          disabled={active}
          onChange={(event) => selectTask(event.target.value || null)}
          hint={active ? 'The task is fixed while the timer is running.' : undefined}
        >
          <option value="">Choose a task</option>
          {activeTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </Select>
      )}

      {status === 'finished' && isFocus && outcome && (
        <div
          className={cn(
            'rounded-xl border p-3 text-sm',
            outcome.recorded
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
              : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
          )}
        >
          {outcome.recorded ? (
            <>
              <p className="font-semibold">
                Saved {pluralize(outcome.studiedMinutes, 'minute')} for{' '}
                {outcomeTask ? `"${outcomeTask.title}"` : 'your task'}.
              </p>
              {outcome.linked && (
                <p className="mt-0.5 opacity-90">
                  This completed the matching planned session on your calendar.
                </p>
              )}
              {outcomeTask && (
                <div className="mt-2">
                  <div
                    role="progressbar"
                    aria-label="Task progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={outcomePercent}
                    className="h-1.5 overflow-hidden rounded-full bg-white/70 dark:bg-slate-900/50"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${outcomePercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs opacity-90">
                    {formatDuration(outcomeStudied)} of {formatDuration(outcomeTask.estimatedMinutes)}{' '}
                    studied
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="font-semibold">
              {REASON_MESSAGES[outcome.reason] ?? 'The session was not recorded.'}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {status === 'idle' && (
          <>
            <Button size="lg" icon={Play} onClick={startFocus} disabled={!selectedTask}>
              Start focus
            </Button>
            <Button variant="secondary" size="lg" icon={Coffee} onClick={() => startBreak('shortBreak')}>
              Short break
            </Button>
            <Button variant="secondary" size="lg" icon={Coffee} onClick={() => startBreak('longBreak')}>
              Long break
            </Button>
          </>
        )}

        {active && (
          <>
            {status === 'running' ? (
              <Button size="lg" icon={Pause} onClick={pause}>
                Pause
              </Button>
            ) : (
              <Button size="lg" icon={Play} onClick={resume}>
                Resume
              </Button>
            )}
            {isFocus ? (
              <Button
                variant="secondary"
                size="lg"
                icon={Check}
                onClick={finishEarly}
                disabled={!canSave}
              >
                Finish and save
              </Button>
            ) : (
              <Button variant="secondary" size="lg" icon={SkipForward} onClick={skipBreak}>
                Skip break
              </Button>
            )}
            <Button variant="ghost" size="lg" icon={RotateCcw} onClick={handleDiscard}>
              Reset
            </Button>
          </>
        )}

        {status === 'finished' && isFocus && (
          <>
            <Button
              size="lg"
              icon={Coffee}
              variant={longBreakDue ? 'secondary' : 'primary'}
              onClick={() => startBreak('shortBreak')}
            >
              Short break
            </Button>
            <Button
              size="lg"
              icon={Coffee}
              variant={longBreakDue ? 'primary' : 'secondary'}
              onClick={() => startBreak('longBreak')}
            >
              {longBreakDue ? 'Long break (due)' : 'Long break'}
            </Button>
            <Button variant="secondary" size="lg" icon={Play} onClick={startFocus} disabled={!selectedTask}>
              Another focus session
            </Button>
            {outcome && outcome.reachedEstimate && outcomeTask && !outcomeTask.completed && (
              <Button variant="secondary" size="lg" icon={Check} onClick={handleMarkCompleted}>
                Mark task completed
              </Button>
            )}
          </>
        )}

        {status === 'finished' && !isFocus && (
          <>
            <Button size="lg" icon={Play} onClick={startFocus} disabled={!selectedTask}>
              Start focus
            </Button>
            <Button variant="ghost" size="lg" onClick={skipBreak}>
              Done
            </Button>
          </>
        )}
      </div>

      {active && isFocus && !canSave && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Study for at least 1 minute to be able to save this session early.
        </p>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this focus session?"
        confirmLabel="Discard"
        onConfirm={confirmDiscardRun}
        onCancel={() => setConfirmDiscard(false)}
      >
        <p>
          The {formatDuration(Math.floor(elapsedMs / 60000))} you studied so far will not be saved.
          Use "Finish and save" to keep it.
        </p>
      </ConfirmDialog>
    </Card>
  );
}