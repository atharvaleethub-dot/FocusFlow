import { useState } from 'react';
import { ListChecks, Plus, Search } from 'lucide-react';
import Button from '../components/common/Button';
import { Card } from '../components/common/Card';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import PageHeader from '../components/common/PageHeader';
import TaskCard from '../components/tasks/TaskCard';
import TaskFilters from '../components/tasks/TaskFilters';
import { useTaskForm } from '../context/TaskFormContext';
import { useToast } from '../context/ToastContext';
import useTasks from '../hooks/useTasks';
import {
  DEFAULT_FILTERS,
  filterAndSortTasks,
  getStatusCounts,
  getSubjects,
  getTaskProgress,
  pluralize,
} from '../utils/taskHelpers';

export default function TasksPage() {
  const { tasks, sessions, setTaskCompleted, deleteTask } = useTasks();
  const { openTaskForm } = useTaskForm();
  const toast = useToast();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [taskToComplete, setTaskToComplete] = useState(null);

  const now = new Date();
  const subjects = getSubjects(tasks);
  const counts = getStatusCounts(tasks, now);

  // If the chosen subject no longer exists (for example after a delete), fall back to all.
  const subjectStillExists = subjects.some(
    (subject) => subject.toLowerCase() === filters.subject.toLowerCase()
  );
  const activeFilters = {
    ...filters,
    subject: filters.subject === 'all' || subjectStillExists ? filters.subject : 'all',
  };

  const visibleTasks = filterAndSortTasks(tasks, sessions, activeFilters, now);
  const hasActiveFilters =
    activeFilters.search.trim() !== '' ||
    activeFilters.status !== DEFAULT_FILTERS.status ||
    activeFilters.subject !== 'all' ||
    activeFilters.priority !== 'all';

  const updateFilters = (patch) => setFilters((previous) => ({ ...previous, ...patch }));
  const resetFilters = () => setFilters((previous) => ({ ...DEFAULT_FILTERS, sort: previous.sort }));

  const applyToggle = (task) => {
    const result = setTaskCompleted(task.id, !task.completed);
    if (!result.task) return;
    if (!task.completed) {
      toast.success(
        'Task completed',
        result.removedSessions > 0
          ? `${pluralize(result.removedSessions, 'planned session')} removed. Your recorded study time was kept.`
          : 'Great work!'
      );
    } else {
      toast.info('Task reopened', `"${task.title}" is active again.`);
    }
  };

  // Completing a task removes its planned sessions, so that case asks for confirmation first.
  const handleToggle = (task) => {
    if (!task.completed) {
      const planned = sessions.filter(
        (session) => session.taskId === task.id && session.status === 'planned'
      ).length;
      if (planned > 0) {
        setTaskToComplete({ task, planned });
        return;
      }
    }
    applyToggle(task);
  };

  const confirmComplete = () => {
    applyToggle(taskToComplete.task);
    setTaskToComplete(null);
  };

  const deleteStats = (() => {
    if (!taskToDelete) return { kept: 0, removed: 0 };
    const own = sessions.filter((session) => session.taskId === taskToDelete.id);
    const kept = own.filter((session) => session.status === 'completed').length;
    return { kept, removed: own.length - kept };
  })();

  const confirmDelete = () => {
    const result = deleteTask(taskToDelete.id);
    setTaskToDelete(null);
    if (result.task) {
      toast.success(
        'Task deleted',
        result.keptRecords > 0
          ? `${pluralize(result.keptRecords, 'completed study session')} kept in your history.`
          : `"${result.task.title}" was removed.`
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Create, organize, and track your study tasks."
        actions={
          <Button icon={Plus} onClick={() => openTaskForm()}>
            New task
          </Button>
        }
      />

      {tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description="Add your first task with a deadline and an estimate to get started."
            action={
              <Button icon={Plus} onClick={() => openTaskForm()}>
                Create your first task
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <TaskFilters
            filters={activeFilters}
            subjects={subjects}
            counts={counts}
            hasActiveFilters={hasActiveFilters}
            onChange={updateFilters}
            onReset={resetFilters}
          />

          <p aria-live="polite" className="text-sm text-slate-500 dark:text-slate-400">
            Showing {visibleTasks.length} of {pluralize(tasks.length, 'task')}
          </p>

          {visibleTasks.length === 0 ? (
            <Card>
              <EmptyState
                icon={Search}
                title="No tasks match your filters"
                description="Try a different search or reset the filters."
                action={
                  <Button variant="secondary" onClick={resetFilters}>
                    Reset filters
                  </Button>
                }
              />
            </Card>
          ) : (
            <ul className="space-y-3">
              {visibleTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  progress={getTaskProgress(task, sessions)}
                  now={now}
                  onToggle={() => handleToggle(task)}
                  onEdit={() => openTaskForm(task)}
                  onDelete={() => setTaskToDelete(task)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={taskToComplete !== null}
        title="Mark this task as completed?"
        description={taskToComplete ? `"${taskToComplete.task.title}"` : undefined}
        confirmLabel="Mark completed"
        tone="primary"
        onConfirm={confirmComplete}
        onCancel={() => setTaskToComplete(null)}
      >
        <p>
          {taskToComplete ? pluralize(taskToComplete.planned, 'planned session') : ''} will be
          removed from your calendar. Study time you already recorded is kept.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={taskToDelete !== null}
        title="Delete this task?"
        description={taskToDelete ? `"${taskToDelete.title}"` : undefined}
        confirmLabel="Delete task"
        onConfirm={confirmDelete}
        onCancel={() => setTaskToDelete(null)}
      >
        <p>
          {pluralize(deleteStats.removed, 'planned or missed session')} will be removed.{' '}
          {deleteStats.kept > 0
            ? `${pluralize(deleteStats.kept, 'completed study session')} will be kept in your study history.`
            : 'No completed study time is attached to this task.'}
        </p>
      </ConfirmDialog>
    </>
  );
}