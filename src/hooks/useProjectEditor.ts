import { useState, useCallback, useEffect } from 'react';
import { GanttProject, GanttTask } from '../domain/models';
import {
  createNewTask,
  getDescendantIds,
  cleanOrphanedDependencies,
  insertTaskAtPosition,
  moveTaskBranch,
  recomputeSummaryRanges,
  indentTask as utilsIndentTask,
  outdentTask as utilsOutdentTask,
  canIndentTask as utilsCanIndentTask
} from '../domain/taskUtils';

const MAX_HISTORY = 50;

export function useProjectEditor(initialProject: GanttProject) {
  const [project, setProjectState] = useState<GanttProject>(initialProject);
  const [history, setHistory] = useState<GanttProject[]>([]);
  const [future, setFuture] = useState<GanttProject[]>([]);
  const [lastSavedProject, setLastSavedProject] = useState<GanttProject>(initialProject);

  const isDirty = project !== lastSavedProject;

  const setIsDirty = useCallback((dirty: boolean) => {
    if (!dirty) {
      setLastSavedProject(project);
    }
  }, [project]);

  // Expose a way to load manually or reset
  const loadProject = useCallback((newProject: GanttProject) => {
    setProjectState(newProject);
    setHistory([]);
    setFuture([]);
    setLastSavedProject(newProject);
  }, []);

  const pushState = useCallback((newProject: GanttProject) => {
    setHistory(prev => {
      const updated = [...prev, project];
      if (updated.length > MAX_HISTORY) updated.shift();
      return updated;
    });
    setFuture([]);
    setProjectState(newProject);
  }, [project]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture(f => [project, ...f]);
    setHistory(h => h.slice(0, h.length - 1));
    setProjectState(prev);
  }, [history, project]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory(h => [...h, project]);
    setFuture(f => f.slice(1));
    setProjectState(next);
  }, [future, project]);

  // Hook up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const updateTask = useCallback((taskId: string, updates: Partial<GanttTask>) => {
    let newTasks = [...project.tasks];
    const taskIndex = newTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    // Mutate the specific task
    newTasks[taskIndex] = { ...newTasks[taskIndex], ...updates };

    // If we updated a child's dates, recalculate summary ancestors
    if (newTasks[taskIndex].parentId && (updates.start !== undefined || updates.end !== undefined)) {
      newTasks = recomputeSummaryRanges(newTasks);
    }

    pushState({ ...project, tasks: newTasks });
  }, [project, pushState]);

  const updateTasks = useCallback((newTasks: GanttTask[]) => {
    pushState({ ...project, tasks: newTasks });
  }, [project, pushState]);

  /**
   * Rename the project. Atomic Undo/Redo.
   */
  const renameProject = useCallback((newName: string) => {
    if (!newName || !newName.trim()) return;
    pushState({ ...project, name: newName.trim() });
  }, [project, pushState]);

  /**
   * Add a new root task at the end of the project.
   * Returns the UID of the created task so the UI can set it into edit mode.
   */
  const addTask = useCallback((): string => {
    const newTask = createNewTask(project.tasks);
    const newTasks = insertTaskAtPosition(project.tasks, newTask);
    pushState({ ...project, tasks: newTasks });
    return newTask.id;
  }, [project, pushState]);

  /**
   * Add a subtask to a given parent.
   * Returns the UID of the created subtask.
   */
  const addSubtask = useCallback((parentId: string): string => {
    const newTask = createNewTask(project.tasks, parentId);
    const newTasks = recomputeSummaryRanges(insertTaskAtPosition(project.tasks, newTask));
    pushState({ ...project, tasks: newTasks });
    return newTask.id;
  }, [project, pushState]);

  /**
   * Delete a task (and all its descendants). Cleans orphaned dependencies.
   * Slack-friendly: does NOT move any surviving task's dates.
   * Returns true if deletion occurred.
   */
  const deleteTask = useCallback((taskId: string): boolean => {
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return false;

    const descendantIds = getDescendantIds(project.tasks, taskId);
    const deletedIds = new Set([taskId, ...descendantIds]);

    // Remove the tasks
    let newTasks = project.tasks.filter(t => !deletedIds.has(t.id));

    // Clean orphaned dependency references and recalculate surviving summaries
    newTasks = recomputeSummaryRanges(cleanOrphanedDependencies(newTasks, deletedIds));

    pushState({ ...project, tasks: newTasks });
    return true;
  }, [project, pushState]);

  const moveTask = useCallback((sourceId: string, targetId: string, position: 'before' | 'after') => {
    const newTasks = moveTaskBranch(project.tasks, sourceId, targetId, position);
    pushState({ ...project, tasks: newTasks });
  }, [project, pushState]);

  const indentTask = useCallback((taskId: string) => {
    const newTasks = utilsIndentTask(project.tasks, taskId);
    pushState({ ...project, tasks: newTasks });
  }, [project, pushState]);

  const outdentTask = useCallback((taskId: string) => {
    const newTasks = utilsOutdentTask(project.tasks, taskId);
    pushState({ ...project, tasks: newTasks });
  }, [project, pushState]);

  const canIndentTask = useCallback((taskId: string) => {
    return utilsCanIndentTask(project.tasks, taskId);
  }, [project.tasks]);

  return {
    project,
    updateTask,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    isDirty,
    setIsDirty,
    loadProject,
    updateTasks,
    renameProject,
    addTask,
    addSubtask,
    deleteTask,
    moveTask,
    indentTask,
    outdentTask,
    canIndentTask
  };
}

