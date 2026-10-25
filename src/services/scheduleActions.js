import { pluralize } from '../utils/taskHelpers';
import { withHistory } from './history';

// The preview was computed from a "basis" (the data at that moment). A plan is only applied
// if the data is still exactly that, so a stale preview can never overwrite newer changes.
export function isBasisCurrent(state, basis) {
  return (
    state.tasks === basis.tasks &&
    state.sessions === basis.sessions &&
    state.commitments === basis.commitments &&
    state.availability === basis.availability
  );
}

export function hasPlanChanges(plan) {
  return plan.added.length > 0 || plan.removed.length > 0 || plan.newlyMissed.length > 0;
}

export function describePlan(plan, mode) {
  const { summary } = plan;
  const parts = [];
  if (summary.addedCount > 0) parts.push(`${pluralize(summary.addedCount, 'session')} added`);
  if (summary.removedCount > 0) parts.push(`${summary.removedCount} removed`);
  if (summary.newlyMissedCount > 0) parts.push(`${summary.newlyMissedCount} marked missed`);
  const head = mode === 'reschedule' ? 'Rescheduled missed sessions' : 'Generated schedule';
  return parts.length > 0 ? `${head}: ${parts.join(', ')}` : head;
}

// Returns { state, applied }. The plan's session list already contains every kept,
// completed, missed, and new session, so completed records are carried over untouched.
// A history snapshot is saved first, so the change can be undone.
export function applySchedulePlan(state, plan, basis, { mode = 'generate' } = {}) {
  if (!isBasisCurrent(state, basis)) return { state, applied: false };
  if (!hasPlanChanges(plan)) return { state, applied: true };

  const result = withHistory(
    state,
    { action: mode, label: describePlan(plan, mode) },
    { state: { ...state, sessions: plan.sessions } }
  );
  return { state: result.state, applied: true };
}