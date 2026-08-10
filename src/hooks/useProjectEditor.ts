import { useState, useCallback, useEffect, useRef } from 'react';
import { GanttProject, GanttTask } from '../domain/models';

const MAX_HISTORY = 50;

export function useProjectEditor(initialProject: GanttProject) {
  const [project, setProjectState] = useState<GanttProject>(initialProject);
  const [history, setHistory] = useState<GanttProject[]>([]);
  const [future, setFuture] = useState<GanttProject[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Autosave to localStorage on project change
  useEffect(() => {
    if (isDirty) {
      localStorage.setItem('maxima:autosave', JSON.stringify({
        format: 'project-maxima',
        version: 1,
        project
      }));
    }
  }, [project, isDirty]);

  // Expose a way to load manually or reset
  const loadProject = useCallback((newProject: GanttProject) => {
    setProjectState(newProject);
    setHistory([]);
    setFuture([]);
    setIsDirty(false);
  }, []);

  const pushState = useCallback((newProject: GanttProject) => {
    setHistory(prev => {
      const updated = [...prev, project];
      if (updated.length > MAX_HISTORY) updated.shift();
      return updated;
    });
    setFuture([]);
    setProjectState(newProject);
    setIsDirty(true);
  }, [project]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture(f => [project, ...f]);
    setHistory(h => h.slice(0, h.length - 1));
    setProjectState(prev);
    setIsDirty(true);
  }, [history, project]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory(h => [...h, project]);
    setFuture(f => f.slice(1));
    setProjectState(next);
    setIsDirty(true);
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
    const newTasks = [...project.tasks];
    const taskIndex = newTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    // Mutate the specific task
    newTasks[taskIndex] = { ...newTasks[taskIndex], ...updates };

    // Function to recalculate a summary task based on its children
    const recalculateSummary = (parentId: string) => {
      const children = newTasks.filter(t => t.parentId === parentId);
      if (children.length === 0) return;

      const parentIndex = newTasks.findIndex(t => t.id === parentId);
      if (parentIndex === -1) return;

      let minStart = children[0].start;
      let maxEnd = children[0].end;

      for (const child of children) {
        if (new Date(child.start) < new Date(minStart)) minStart = child.start;
        if (new Date(child.end) > new Date(maxEnd)) maxEnd = child.end;
      }

      const parent = newTasks[parentIndex];
      // Only update if changed to prevent infinite loops / unnecessary renders
      if (parent.start !== minStart || parent.end !== maxEnd) {
        newTasks[parentIndex] = { ...parent, start: minStart, end: maxEnd };
        // bubble up if this parent has a parent
        if (parent.parentId) {
          recalculateSummary(parent.parentId);
        }
      }
    };

    // If we updated a child, trigger bubble up
    const updatedTask = newTasks[taskIndex];
    if (updatedTask.parentId && (updates.start !== undefined || updates.end !== undefined)) {
      recalculateSummary(updatedTask.parentId);
    }

    pushState({ ...project, tasks: newTasks });
  }, [project, pushState]);

  return {
    project,
    updateTask,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    isDirty,
    setIsDirty,
    loadProject
  };
}
