import { GanttProject, GanttTask } from './models';
import { calculateEditedDuration, formatCalendarIso, parseCalendarDate } from '../utils/ganttUtils';

/**
 * Generates a unique ID for a new project.
 */
export function generateProjectId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `project_${crypto.randomUUID()}`;
  }
  const hex = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `project_${hex()}-${hex()}`;
}

/**
 * Creates a fresh blank Gantt project ready for editing.
 */
export function createBlankProject(name = 'Proyecto sin título'): GanttProject {
  return {
    id: generateProjectId(),
    name: name.trim() || 'Proyecto sin título',
    tasks: [],
    resources: [],
  };
}

/**
 * Generates a unique, stable UID for tasks created within Maxima.
 * Uses the `maxima_` prefix followed by a random hex string to guarantee
 * no collisions with XML-imported numeric UIDs.
 * 
 * This UID is PERMANENT. It survives rename, reorder, indent, save/load.
 * It is NEVER based on displayId or array position.
 */
export function generateTaskUid(): string {
  // crypto.randomUUID() is available in modern browsers and Node 19+
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `maxima_${crypto.randomUUID()}`;
  }
  // Fallback: manual hex generation
  const hex = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `maxima_${hex()}-${hex()}-${hex()}`;
}

/**
 * Creates a new blank task with sensible defaults.
 * @param existingTasks - Current tasks array, used to derive a reasonable start date.
 * @param parentId - Optional parent UID to create a subtask.
 */
export function createNewTask(existingTasks: GanttTask[], parentId?: string): GanttTask {
  const uid = generateTaskUid();

  // Determine a sensible start date
  let startDate: string;
  if (parentId) {
    // For subtasks, use the parent's start date
    const parent = existingTasks.find(t => t.id === parentId);
    startDate = parent?.start
      ? formatCalendarIso(parseCalendarDate(parent.start))
      : formatCalendarIso(new Date());
  } else if (existingTasks.length > 0) {
    // For root tasks, use the latest end date in the project as start
    const latestEnd = existingTasks.reduce((max, t) => {
      return parseCalendarDate(t.end) > parseCalendarDate(max) ? t.end : max;
    }, existingTasks[0].end);
    const d = parseCalendarDate(latestEnd);
    // Start the day after the latest end
    d.setDate(d.getDate() + 1);
    // Skip weekends
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    startDate = formatCalendarIso(d);
  } else {
    // Empty project: use today
    const now = new Date();
    // Skip to Monday if weekend
    while (now.getDay() === 0 || now.getDay() === 6) {
      now.setDate(now.getDate() + 1);
    }
    startDate = formatCalendarIso(now);
  }

  return {
    id: uid,
    name: 'Nueva tarea',
    start: startDate,
    end: startDate, // duration 1 = start === end
    duration: 1,
    progress: 0,
    milestone: false,
    dependencies: [],
    resourceIds: [],
    ...(parentId ? { parentId } : {})
  };
}

/**
 * Returns all descendant UIDs of a given task (children, grandchildren, etc.).
 */
export function getDescendantIds(tasks: GanttTask[], taskId: string): string[] {
  const result: string[] = [];
  const queue = [taskId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = tasks.filter(t => t.parentId === current);
    for (const child of children) {
      result.push(child.id);
      queue.push(child.id);
    }
  }
  return result;
}

/**
 * Returns true if the task has children in the given tasks array.
 */
export function taskHasChildren(tasks: GanttTask[], taskId: string): boolean {
  return tasks.some(t => t.parentId === taskId);
}

/**
 * Returns info about tasks that depend on a given task (or set of tasks).
 * Used to show warnings before deletion.
 */
export function findDependentTasks(tasks: GanttTask[], targetIds: Set<string>): { taskId: string; taskName: string }[] {
  const dependents: { taskId: string; taskName: string }[] = [];
  for (const task of tasks) {
    if (targetIds.has(task.id)) continue; // skip tasks being deleted
    if (task.dependencies?.some(dep => targetIds.has(dep.taskId))) {
      dependents.push({ taskId: task.id, taskName: task.name });
    }
  }
  return dependents;
}

/**
 * Removes all dependency references to a set of deleted task UIDs.
 * Does NOT move dates (slack-friendly deletion).
 */
export function cleanOrphanedDependencies(tasks: GanttTask[], deletedIds: Set<string>): GanttTask[] {
  return tasks.map(t => {
    if (!t.dependencies || t.dependencies.length === 0) return t;
    const cleaned = t.dependencies.filter(dep => !deletedIds.has(dep.taskId));
    if (cleaned.length === t.dependencies.length) return t;
    return { ...t, dependencies: cleaned };
  });
}

/**
 * Inserts a task into the tasks array at the correct position.
 * - Root tasks: appended at end.
 * - Subtasks: inserted after the parent and all its existing descendants.
 */
export function insertTaskAtPosition(tasks: GanttTask[], newTask: GanttTask): GanttTask[] {
  if (!newTask.parentId) {
    return [...tasks, newTask];
  }

  // Find insert position: after parent + all descendants
  const parentIndex = tasks.findIndex(t => t.id === newTask.parentId);
  if (parentIndex === -1) return [...tasks, newTask]; // fallback

  const descendants = getDescendantIds(tasks, newTask.parentId);
  
  // Find the last descendant's index
  let lastDescendantIndex = parentIndex;
  for (const descId of descendants) {
    const idx = tasks.findIndex(t => t.id === descId);
    if (idx > lastDescendantIndex) lastDescendantIndex = idx;
  }

  const result = [...tasks];
  result.splice(lastDescendantIndex + 1, 0, newTask);
  return result;
}

/**
 * Gets a task and all its descendants.
 */
export function getTaskBranch(tasks: GanttTask[], taskId: string): GanttTask[] {
  const branchIds = new Set([taskId, ...getDescendantIds(tasks, taskId)]);
  return tasks.filter(t => branchIds.has(t.id));
}

/**
 * Re-sorts the array to match the depth-first visual order.
 * This guarantees the persistent order correctly reflects the hierarchy.
 */
export function syncArrayOrder(tasks: GanttTask[]): GanttTask[] {
  const childrenMap = new Map<string, GanttTask[]>();
  tasks.forEach(t => {
    const parentId = t.parentId || 'root';
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(t);
  });

  const result: GanttTask[] = [];
  function traverse(parentId: string) {
    const children = childrenMap.get(parentId) || [];
    for (const child of children) {
      result.push(child);
      traverse(child.id);
    }
  }
  traverse('root');
  return result;
}

/**
 * Recalculates summaries after structure changes.
 */
export function recomputeSummaryRanges(tasks: GanttTask[]): GanttTask[] {
  const newTasks = [...tasks];
  let changed = false;

  const recalculate = () => {
    let iterationChanged = false;
    for (let i = newTasks.length - 1; i >= 0; i--) {
      const parent = newTasks[i];
      const children = newTasks.filter(t => t.parentId === parent.id);
      if (children.length > 0) {
        let minStart = parseCalendarDate(children[0].start);
        let maxEnd = parseCalendarDate(children[0].end);
        for (const child of children) {
          const childStart = parseCalendarDate(child.start);
          const childEnd = parseCalendarDate(child.end);
          if (childStart < minStart) minStart = childStart;
          if (childEnd > maxEnd) maxEnd = childEnd;
        }
        const minStartStr = formatCalendarIso(minStart);
        const maxEndStr = formatCalendarIso(maxEnd);
        const newDuration = calculateEditedDuration(minStartStr, maxEndStr);
        if (parent.start !== minStartStr || parent.end !== maxEndStr || parent.duration !== newDuration) {
          newTasks[i] = { ...parent, start: minStartStr, end: maxEndStr, duration: newDuration };
          iterationChanged = true;
          changed = true;
        }
      }
    }
    return iterationChanged;
  };

  let limit = 20; // prevent infinite loops
  while (recalculate() && limit-- > 0) {}

  return changed ? newTasks : tasks;
}

/**
 * Moves a task branch to a new position.
 */
export function moveTaskBranch(tasks: GanttTask[], sourceId: string, targetId: string, position: 'before' | 'after'): GanttTask[] {
  if (sourceId === targetId) return tasks;
  
  const branch = getTaskBranch(tasks, sourceId);
  const branchIds = new Set(branch.map(t => t.id));
  if (branchIds.has(targetId)) return tasks; // Cannot move inside itself

  const filteredTasks = tasks.filter(t => !branchIds.has(t.id));
  let targetIndex = filteredTasks.findIndex(t => t.id === targetId);
  if (targetIndex === -1) return tasks; 

  if (position === 'after') {
    const targetBranch = getTaskBranch(tasks, targetId);
    const targetBranchIds = new Set(targetBranch.map(t => t.id));
    let lastTargetIdx = targetIndex;
    for (let i = targetIndex; i < filteredTasks.length; i++) {
      if (targetBranchIds.has(filteredTasks[i].id)) {
         lastTargetIdx = i;
      }
    }
    targetIndex = lastTargetIdx + 1;
  }

  const targetTask = tasks.find(t => t.id === targetId);
  const newParentId = targetTask?.parentId;
  
  const updatedBranch = branch.map(t => 
    t.id === sourceId ? { ...t, parentId: newParentId } : t
  );

  const result = [...filteredTasks];
  result.splice(targetIndex, 0, ...updatedBranch);
  
  return recomputeSummaryRanges(syncArrayOrder(result));
}

export function canIndentTask(tasks: GanttTask[], taskId: string): boolean {
  const index = tasks.findIndex(t => t.id === taskId);
  if (index <= 0) return false;
  
  const task = tasks[index];
  for (let i = index - 1; i >= 0; i--) {
    if (tasks[i].parentId === task.parentId) return true;
    if (!tasks[i].parentId && !task.parentId) return true;
  }
  return false;
}

export function indentTask(tasks: GanttTask[], taskId: string): GanttTask[] {
  const index = tasks.findIndex(t => t.id === taskId);
  if (index <= 0) return tasks;
  
  const task = tasks[index];
  let prevSibling: GanttTask | undefined;
  for (let i = index - 1; i >= 0; i--) {
    if (tasks[i].parentId === task.parentId) {
      prevSibling = tasks[i];
      break;
    }
  }

  if (!prevSibling) return tasks;

  const newTasks = [...tasks];
  newTasks[index] = { ...task, parentId: prevSibling.id };
  return recomputeSummaryRanges(syncArrayOrder(newTasks));
}

export function outdentTask(tasks: GanttTask[], taskId: string): GanttTask[] {
  const index = tasks.findIndex(t => t.id === taskId);
  if (index === -1) return tasks;
  
  const task = tasks[index];
  if (!task.parentId) return tasks;

  const parent = tasks.find(t => t.id === task.parentId);
  if (!parent) return tasks;

  const newTasks = [...tasks];
  newTasks[index] = { ...task, parentId: parent.parentId };
  return recomputeSummaryRanges(syncArrayOrder(newTasks));
}

