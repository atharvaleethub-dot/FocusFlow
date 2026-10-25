import { useState } from 'react';
import { CalendarOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import useSchedulingSettings from '../../hooks/useSchedulingSettings';
import {
  COMMITMENT_CATEGORY_LABELS,
  describeCommitmentSchedule,
  findCommitmentConflicts,
} from '../../utils/schedulingHelpers';
import { pluralize } from '../../utils/taskHelpers';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { Card, CardHeader } from '../common/Card';
import ConfirmDialog from '../common/ConfirmDialog';
import EmptyState from '../common/EmptyState';
import IconButton from '../common/IconButton';
import CommitmentFormModal from './CommitmentFormModal';

export default function CommitmentsSettings() {
  const { commitments, sessions, addCommitment, updateCommitment, deleteCommitment } =
    useSchedulingSettings();
  const toast = useToast();

  const [formState, setFormState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sorted = [...commitments].sort(
    (a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title)
  );

  const handleSubmit = (values) => {
    const editing = formState.commitment;
    const result = editing ? updateCommitment(editing.id, values) : addCommitment(values);
    const saved = result.commitment;

    if (!saved) {
      toast.error('Commitment not found', 'It may have been deleted.');
    } else {
      const clashes = sessions.filter(
        (session) =>
          session.status === 'planned' && findCommitmentConflicts([saved], session).length > 0
      ).length;
      const title = editing ? 'Commitment updated' : 'Commitment added';
      if (clashes > 0) {
        toast.warning(
          title,
          `${pluralize(clashes, 'planned session')} now overlap${
            clashes === 1 ? 's' : ''
          } it. Move ${clashes === 1 ? 'it' : 'them'} from the calendar.`
        );
      } else {
        toast.success(title, `"${saved.title}" is now protected time.`);
      }
    }
    setFormState(null);
  };

  const confirmDelete = () => {
    const result = deleteCommitment(deleteTarget.id);
    setDeleteTarget(null);
    if (result.commitment) {
      toast.success('Commitment deleted', `"${result.commitment.title}" no longer blocks study time.`);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Fixed commitments"
        description="Classes, work, meals, and travel. This time is protected and never moved automatically."
        action={
          <Button size="sm" icon={Plus} onClick={() => setFormState({ commitment: null })}>
            Add
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          compact
          icon={CalendarOff}
          title="No fixed commitments"
          description="Add classes or other fixed time so the scheduler plans around them."
        />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((commitment) => (
            <li
              key={commitment.id}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="break-words">{commitment.title}</span>
                  <Badge>{COMMITMENT_CATEGORY_LABELS[commitment.category]}</Badge>
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {describeCommitmentSchedule(commitment)}
                </p>
              </div>
              <div className="-mr-1 flex shrink-0 gap-0.5">
                <IconButton
                  icon={Pencil}
                  label={`Edit "${commitment.title}"`}
                  onClick={() => setFormState({ commitment })}
                />
                <IconButton
                  icon={Trash2}
                  tone="danger"
                  label={`Delete "${commitment.title}"`}
                  onClick={() => setDeleteTarget(commitment)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {formState && (
        <CommitmentFormModal
          key={formState.commitment ? formState.commitment.id : 'new-commitment'}
          commitment={formState.commitment}
          commitments={commitments}
          onSubmit={handleSubmit}
          onClose={() => setFormState(null)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this commitment?"
        description={deleteTarget ? `"${deleteTarget.title}"` : undefined}
        confirmLabel="Delete commitment"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        <p>
          This time will become available for study sessions. Existing sessions are not changed.
        </p>
      </ConfirmDialog>
    </Card>
  );
}