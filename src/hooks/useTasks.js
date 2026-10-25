import { useCallback, useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import {
  addTaskToState,
  deleteTaskFromState,
  setTaskCompletedInState,
  updateTaskInState,
} from '../services/taskActions';

export default function useTasks() {
  const { tasks, sessions, updateState } = useAppData();

  // Runs an action against the freshest state and returns its info (task, counts, ...).
  const run = useCallback(
    (action) => {
      let result;
      updateState((previous) => {
        result = action(previous);
        return result.state;
      });
      return result;
    },
    [updateState]
  );

  const addTask = useCallback((values) => run((s) => addTaskToState(s, values)).task, [run]);
  const updateTask = useCallback(
    (taskId, values) => run((s) => updateTaskInState(s, taskId, values)),
    [run]
  );
  const setTaskCompleted = useCallback(
    (taskId, completed) => run((s) => setTaskCompletedInState(s, taskId, completed)),
    [run]
  );
  const deleteTask = useCallback((taskId) => run((s) => deleteTaskFromState(s, taskId)), [run]);

  return useMemo(
    () => ({ tasks, sessions, addTask, updateTask, setTaskCompleted, deleteTask }),
    [tasks, sessions, addTask, updateTask, setTaskCompleted, deleteTask]
  );
}