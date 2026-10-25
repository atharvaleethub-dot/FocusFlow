/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import TaskFormModal from '../components/tasks/TaskFormModal';
import useTasks from '../hooks/useTasks';
import { getSubjects, pluralize } from '../utils/taskHelpers';
import { useToast } from './ToastContext';

const TaskFormContext = createContext(null);

// Owns the create/edit dialog so any page (dashboard, tasks) can open it.
export function TaskFormProvider({ children }) {
  const { tasks, addTask, updateTask } = useTasks();
  const toast = useToast();
  const [formState, setFormState] = useState(null); // null = closed, { task } = open

  const openTaskForm = useCallback((task = null) => setFormState({ task }), []);
  const closeTaskForm = useCallback(() => setFormState(null), []);

  const handleSubmit = (values) => {
    if (formState.task) {
      const result = updateTask(formState.task.id, values);
      if (!result.task) {
        toast.error('Task not found', 'It may have been deleted.');
      } else if (result.removedSessions > 0 || result.lockedAfterDeadline > 0) {
        const parts = [];
        if (result.removedSessions > 0) {
          parts.push(
            `${pluralize(result.removedSessions, 'planned session')} after the new deadline ${
              result.removedSessions === 1 ? 'was' : 'were'
            } removed.`
          );
        }
        if (result.lockedAfterDeadline > 0) {
          parts.push(
            `${pluralize(result.lockedAfterDeadline, 'locked session')} now ${
              result.lockedAfterDeadline === 1 ? 'ends' : 'end'
            } after the deadline.`
          );
        }
        toast.warning('Task updated', parts.join(' '));
      } else {
        toast.success('Task updated', `"${result.task.title}" was saved.`);
      }
    } else {
      const task = addTask(values);
      toast.success('Task created', `"${task.title}" was added.`);
    }
    closeTaskForm();
  };

  const value = useMemo(() => ({ openTaskForm }), [openTaskForm]);

  return (
    <TaskFormContext.Provider value={value}>
      {children}
      {formState && (
        <TaskFormModal
          key={formState.task ? formState.task.id : 'new-task'}
          task={formState.task}
          subjects={getSubjects(tasks)}
          onSubmit={handleSubmit}
          onClose={closeTaskForm}
        />
      )}
    </TaskFormContext.Provider>
  );
}

export function useTaskForm() {
  const context = useContext(TaskFormContext);
  if (!context) throw new Error('useTaskForm must be used inside TaskFormProvider');
  return context;
}