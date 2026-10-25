/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ScheduleReviewModal from '../components/schedule/ScheduleReviewModal';
import useHistory from '../hooks/useHistory';
import { applySchedulePlan } from '../services/scheduleActions';
import { generateSchedule } from '../services/scheduler';
import { formatDuration } from '../utils/dates';
import { pluralize } from '../utils/taskHelpers';
import { useAppData } from './AppDataContext';
import { useToast } from './ToastContext';

const ScheduleReviewContext = createContext(null);

const pickBasis = (state) => ({
  tasks: state.tasks,
  sessions: state.sessions,
  commitments: state.commitments,
  availability: state.availability,
});

// Owns the preview / apply dialog so any page can open it.
export function ScheduleReviewProvider({ children }) {
  const { state, updateState } = useAppData();
  const { undo } = useHistory();
  const toast = useToast();
  const [review, setReview] = useState(null);

  const openScheduleReview = useCallback(
    (mode = 'generate') => {
      const now = new Date();
      const basis = pickBasis(state);
      setReview({
        mode,
        rebuild: false,
        now,
        basis,
        plan: generateSchedule({ ...basis, now }, { rebuild: false }),
        step: 'preview',
      });
    },
    [state]
  );

  const closeReview = () => setReview(null);

  const changeRebuild = (rebuild) => {
    if (!review) return;
    setReview({
      ...review,
      rebuild,
      plan: generateSchedule({ ...review.basis, now: review.now }, { rebuild }),
    });
  };

  const applyReview = () => {
    if (!review) return;

    let outcome;
    updateState((current) => {
      outcome = applySchedulePlan(current, review.plan, review.basis, { mode: review.mode });
      return outcome.state;
    });

    if (!outcome.applied) {
      setReview(null);
      toast.warning(
        'Your data changed',
        'The preview was out of date, so nothing was applied. Open it again to review the latest plan.'
      );
      return;
    }

    const { summary } = review.plan;
    setReview({ ...review, step: 'applied' });
    if (summary.success) {
      toast.success(
        'Schedule updated',
        `${pluralize(summary.addedCount, 'session')} added (${formatDuration(summary.addedMinutes)}).`
      );
    } else {
      toast.warning(
        'Schedule partly updated',
        `${pluralize(summary.unscheduledCount, 'task')} could not be fully scheduled.`
      );
    }
  };

  const undoApplied = () => {
    const result = undo();
    if (result.undone) toast.success('Change undone', result.undone.label);
    setReview(null);
  };

  const value = useMemo(() => ({ openScheduleReview }), [openScheduleReview]);

  return (
    <ScheduleReviewContext.Provider value={value}>
      {children}
      {review && (
        <ScheduleReviewModal
          review={review}
          onRebuildChange={changeRebuild}
          onApply={applyReview}
          onUndo={undoApplied}
          onClose={closeReview}
        />
      )}
    </ScheduleReviewContext.Provider>
  );
}

export function useScheduleReview() {
  const context = useContext(ScheduleReviewContext);
  if (!context) throw new Error('useScheduleReview must be used inside ScheduleReviewProvider');
  return context;
}