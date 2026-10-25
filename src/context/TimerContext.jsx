/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { recordFocusSession } from '../services/focusActions';
import {
  RESTORE_GRACE_MS,
  createTimer,
  finishRun,
  getElapsedMs,
  getPhaseDurationMs,
  getRemainingMs,
  pauseTimer,
  resetToIdle,
  resumeTimer,
  setTimerTask,
  startRun,
} from '../services/timerEngine';
import { loadTimer, saveTimer } from '../services/timerStorage';
import { createId } from '../utils/ids';
import { pluralize } from '../utils/taskHelpers';
import { useAppData } from './AppDataContext';
import { useToast } from './ToastContext';

const TimerContext = createContext(null);

const MIN_MANUAL_SAVE_MS = 60000;
const TICK_MS = 250;

function restoreTimer() {
  const stored = loadTimer();
  if (!stored) return { timer: createTimer(), discarded: false };
  if (stored.status === 'running' && Date.now() - stored.endsAt > RESTORE_GRACE_MS) {
    return { timer: resetToIdle(stored), discarded: true };
  }
  return { timer: stored, discarded: false };
}

export function TimerProvider({ children }) {
  const { state, updateState } = useAppData();
  const toast = useToast();

  const [restored] = useState(restoreTimer);
  const [timer, setTimer] = useState(restored.timer);
  const [tick, setTick] = useState(() => Date.now());

  // Refs hold the latest values so rapid repeated clicks always see the current state.
  const timerRef = useRef(restored.timer);
  const stateRef = useRef(state);
  const startupHandled = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  });

  const commit = useCallback((next) => {
    timerRef.current = next;
    setTimer(next);
    setTick(Date.now());
    saveTimer(next);
  }, []);

  useEffect(() => {
    if (startupHandled.current) return;
    startupHandled.current = true;
    if (restored.discarded) {
      saveTimer(restored.timer);
      toast.info(
        'Timer discarded',
        'A focus timer that ended while FocusFlow was closed was not recorded.'
      );
    }
  }, [restored, toast]);

  // The only interval. It runs only while the timer is running and is always cleaned up.
  useEffect(() => {
    if (timer.status !== 'running') return undefined;
    const id = setInterval(() => setTick(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [timer.status]);

  const finishFocus = useCallback(
    (mode) => {
      const current = timerRef.current;
      if (current.phase !== 'focus') return;
      if (current.status !== 'running' && current.status !== 'paused') return;

      const nowMs = Date.now();
      const studiedMs = current.durationMs - getRemainingMs(current, nowMs);
      if (mode === 'manual' && studiedMs < MIN_MANUAL_SAVE_MS) {
        toast.info('Keep going', 'Study for at least 1 minute before saving a session.');
        return;
      }

      let result;
      updateState((previous) => {
        result = recordFocusSession(previous, {
          taskId: current.taskId,
          startedAtMs: current.startedAtMs,
          studiedMs,
          runId: current.runId,
        });
        return result.state;
      });

      const outcome = {
        taskId: current.taskId,
        studiedMinutes: Math.round(studiedMs / 60000),
        recorded: Boolean(result.session),
        reason: result.reason ?? null,
        sessionId: result.session ? result.session.id : null,
        linked: Boolean(result.linked),
        reachedEstimate: Boolean(result.reachedEstimate),
      };
      // Moving to "finished" first makes any repeated call a no-op, so no duplicate is recorded.
      commit(finishRun(current, nowMs, outcome));

      const task = stateRef.current.tasks.find((item) => item.id === current.taskId);
      if (outcome.recorded) {
        toast.success(
          'Focus session saved',
          `${pluralize(outcome.studiedMinutes, 'minute')} recorded for "${task ? task.title : 'your task'}".`
        );
      } else if (outcome.reason === 'task-missing') {
        toast.warning('Task not found', 'The time could not be recorded because the task was deleted.');
      } else if (outcome.reason === 'duplicate') {
        toast.info('Already recorded', 'This session was already saved.');
      }
    },
    [commit, toast, updateState]
  );

  const finishBreak = useCallback(() => {
    const current = timerRef.current;
    if (current.phase === 'focus') return;
    if (current.status !== 'running' && current.status !== 'paused') return;
    commit(finishRun(current, Date.now(), null));
    toast.info('Break over', 'Ready for another focus session?');
  }, [commit, toast]);

  // Detects when the countdown reaches zero.
  useEffect(() => {
    if (timer.status !== 'running' || tick < timer.endsAt) return;
    if (timer.phase === 'focus') finishFocus('expired');
    else finishBreak();
  }, [tick, timer, finishFocus, finishBreak]);

  // If the task of an active focus run is deleted, reset the timer.
  useEffect(() => {
    const current = timerRef.current;
    const active = current.status === 'running' || current.status === 'paused';
    if (
      current.phase === 'focus' &&
      active &&
      current.taskId &&
      !state.tasks.some((task) => task.id === current.taskId)
    ) {
      commit(resetToIdle({ ...current, taskId: null }));
      toast.warning('Timer reset', 'The task for the running timer was deleted.');
    }
  }, [state.tasks, commit, toast]);

  const selectTask = useCallback(
    (taskId) => commit(setTimerTask(timerRef.current, taskId)),
    [commit]
  );

  const startFocus = useCallback(() => {
    const current = timerRef.current;
    if (current.status === 'running' || current.status === 'paused') return;
    const task = stateRef.current.tasks.find((item) => item.id === current.taskId && !item.completed);
    if (!task) {
      toast.error('Choose a task first', 'Pick the task you are about to study.');
      return;
    }
    commit(
      startRun(current, {
        phase: 'focus',
        durationMs: getPhaseDurationMs('focus', stateRef.current.settings.focus),
        nowMs: Date.now(),
        runId: createId('run'),
        taskId: task.id,
      })
    );
  }, [commit, toast]);

  const startBreak = useCallback(
    (kind) => {
      const current = timerRef.current;
      if (current.status === 'running' || current.status === 'paused') return;
      commit(
        startRun(current, {
          phase: kind,
          durationMs: getPhaseDurationMs(kind, stateRef.current.settings.focus),
          nowMs: Date.now(),
          runId: createId('run'),
          taskId: current.taskId,
        })
      );
    },
    [commit]
  );

  const pause = useCallback(() => commit(pauseTimer(timerRef.current, Date.now())), [commit]);
  const resume = useCallback(() => commit(resumeTimer(timerRef.current, Date.now())), [commit]);
  const finishEarly = useCallback(() => finishFocus('manual'), [finishFocus]);
  const discard = useCallback(() => commit(resetToIdle(timerRef.current)), [commit]);
  const skipBreak = useCallback(() => {
    if (timerRef.current.phase !== 'focus') commit(resetToIdle(timerRef.current));
  }, [commit]);

  const focus = state.settings.focus;
  const idleDurationMs = getPhaseDurationMs(timer.phase, focus);

  const value = useMemo(
    () => ({
      timer,
      focus,
      remainingMs: getRemainingMs(timer, tick, idleDurationMs),
      durationMs: timer.status === 'idle' ? idleDurationMs : timer.durationMs,
      elapsedMs: getElapsedMs(timer, tick),
      selectTask,
      startFocus,
      startBreak,
      pause,
      resume,
      finishEarly,
      discard,
      skipBreak,
    }),
    [
      timer,
      tick,
      focus,
      idleDurationMs,
      selectTask,
      startFocus,
      startBreak,
      pause,
      resume,
      finishEarly,
      discard,
      skipBreak,
    ]
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) throw new Error('useTimer must be used inside TimerProvider');
  return context;
}