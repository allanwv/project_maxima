import { addBusinessDays, isWeekend, isBefore, isAfter, subBusinessDays } from 'date-fns';
import { GanttTask } from '../models';
import { calculateEditedDuration, formatCalendarIso, parseCalendarDate } from '../../utils/ganttUtils';

export interface ScheduleOptions {
  /**
   * UID of the task that was manually changed by the user (its successors will be evaluated).
   */
  changedTaskUid?: string;
  /**
   * UIDs of tasks that should be evaluated directly (e.g. because their dependencies changed).
   */
  evaluateTaskUids?: string[];
}

const parseLocalDate = parseCalendarDate;
const formatLocalDate = formatCalendarIso;

/**
 * Snaps a date forward to the next Monday if it falls on a weekend.
 */
function snapToWorkingDayForward(date: Date): Date {
  if (isWeekend(date)) {
    return addBusinessDays(date, 1);
  }
  return date;
}

/**
 * Snaps a date backward to the previous Friday if it falls on a weekend.
 */
function snapToWorkingDayBackward(date: Date): Date {
  if (isWeekend(date)) {
    return subBusinessDays(date, 1);
  }
  return date;
}

/**
 * Helper to add business days safely.
 */
export function addWorkingDays(date: Date, days: number): Date {
  // If we add 0 days, just snap to working day.
  if (days === 0) return snapToWorkingDayForward(date);
  return snapToWorkingDayForward(addBusinessDays(date, days));
}

/**
 * Recalculate end date from start and duration.
 * Convention: 1 day duration means end is on the SAME day as start.
 * 0 day duration (milestone) means start === end.
 */
function calculateEndFromStart(start: Date, durationDays: number): Date {
  if (durationDays === 0) return start;
  // duration 1 -> add 0 days.
  return addWorkingDays(start, Math.max(0, Math.ceil(durationDays) - 1));
}

/**
 * Recalculate start date from end and duration (used for FF/SF).
 */
function calculateStartFromEnd(end: Date, durationDays: number): Date {
  if (durationDays === 0) return end;
  // If duration is 1, start = end.
  const diff = Math.max(0, Math.ceil(durationDays) - 1);
  return snapToWorkingDayBackward(subBusinessDays(end, diff));
}

/**
 * Recalculates summary tasks start/end dates based on their children.
 */
function recalculateSummaryTasks(tasks: Map<string, GanttTask>) {
  const allTasks = Array.from(tasks.values());
  const summaryTasks = allTasks.filter(t => allTasks.some(child => child.parentId === t.id));

  // Sort by depth descending (deepest first) to correctly propagate up
  // But we don't have depth directly in GanttTask, so we loop until no changes are made.
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 100) {
    changed = false;
    iterations++;

    for (const summary of summaryTasks) {
      const children = allTasks.filter(t => t.parentId === summary.id);
      if (children.length === 0) continue;

      let minStart: Date | null = null;
      let maxEnd: Date | null = null;

      for (const child of children) {
        const childStart = parseLocalDate(child.start);
        const childEnd = parseLocalDate(child.end);
        
        if (!minStart || isBefore(childStart, minStart)) minStart = childStart;
        if (!maxEnd || isAfter(childEnd, maxEnd)) maxEnd = childEnd;
      }

      if (minStart && maxEnd) {
        const newStartStr = formatLocalDate(minStart);
        const newEndStr = formatLocalDate(maxEnd);
        const newDuration = calculateEditedDuration(newStartStr, newEndStr);

        if (summary.start !== newStartStr || summary.end !== newEndStr || summary.duration !== newDuration) {
          summary.start = newStartStr;
          summary.end = newEndStr;
          summary.duration = newDuration;
          changed = true;
        }
      }
    }
  }
}

/**
 * Applies the dependency scheduling engine to propagate changes.
 * 
 * Rules for constraints (A is predecessor, B is successor):
 * - FS: B.start >= addWorkingDays(A.end, 1 + lag)
 * - SS: B.start >= addWorkingDays(A.start, lag)
 * - FF: B.end >= addWorkingDays(A.end, lag)
 * - SF: B.end >= addWorkingDays(A.start, 1 + lag)
 * 
 * If B is pushed, we maintain B's duration.
 * We only push B FORWARD if the constraint is violated. We do NOT pull B backward to destroy slack
 * (unless we implement a strict mode, but for now we preserve manual slack).
 */
export function scheduleProjectAfterTaskChange(
  tasks: GanttTask[],
  options: ScheduleOptions
): GanttTask[] {
  // Deep clone to avoid mutating the original until we are done
  const clonedTasks = tasks.map(t => ({ ...t }));
  const taskMap = new Map<string, GanttTask>();
  clonedTasks.forEach(t => taskMap.set(t.id, t));

  const { changedTaskUid, evaluateTaskUids } = options;

  // Build successor graph: predecessorId -> successorIds
  const successorsGraph = new Map<string, string[]>();
  clonedTasks.forEach(t => {
    if (t.dependencies) {
      t.dependencies.forEach(dep => {
        if (!successorsGraph.has(dep.taskId)) {
          successorsGraph.set(dep.taskId, []);
        }
        successorsGraph.get(dep.taskId)!.push(t.id);
      });
    }
  });

  // evaluationQueue holds tasks that need their dates checked against their predecessors.
  const evaluationQueue: string[] = [];
  const inQueue = new Set<string>();

  const enqueue = (uid: string) => {
    if (!inQueue.has(uid) && taskMap.has(uid)) {
      evaluationQueue.push(uid);
      inQueue.add(uid);
    }
  };

  if (changedTaskUid) {
    const successors = successorsGraph.get(changedTaskUid) || [];
    successors.forEach(enqueue);
  }

  if (evaluateTaskUids) {
    evaluateTaskUids.forEach(enqueue);
  }
  
  // Track how many times a task has been processed to prevent infinite loops 
  const processCount = new Map<string, number>();

  while (evaluationQueue.length > 0) {
    const successorUid = evaluationQueue.shift()!;
    inQueue.delete(successorUid);

    const count = (processCount.get(successorUid) || 0) + 1;
    if (count > clonedTasks.length) {
      console.warn(`[SchedulingEngine] Force-breaking possible infinite loop on task ${successorUid}`);
      continue;
    }
    processCount.set(successorUid, count);

    const successorTask = taskMap.get(successorUid)!;
    let startChanged = false;
    let endChanged = false;

      const currentStart = parseLocalDate(successorTask.start);
      const currentEnd = parseLocalDate(successorTask.end);
      
      let requiredStart = currentStart;
      let requiredEnd = currentEnd;

      // Check ALL dependencies of the successor to find the most restrictive constraint
      if (successorTask.dependencies) {
        for (const dep of successorTask.dependencies) {
          const pred = taskMap.get(dep.taskId);
          if (!pred) continue;

          const predStart = parseLocalDate(pred.start);
          const predEnd = parseLocalDate(pred.end);
          const lag = dep.lag || 0;

          if (dep.type === 'FS' || dep.type === 'SS') {
            let candidateStart = requiredStart;
            if (dep.type === 'FS') {
              // B starts after A finishes (+ lag)
              // Since A.end is inclusive, B starts the NEXT day. So 1 + lag.
              candidateStart = addWorkingDays(predEnd, 1 + lag);
            } else if (dep.type === 'SS') {
              candidateStart = addWorkingDays(predStart, lag);
            }
            if (isAfter(candidateStart, requiredStart)) {
              requiredStart = candidateStart;
            }
          } else {
            // FF or SF
            let candidateEnd = requiredEnd;
            if (dep.type === 'FF') {
              candidateEnd = addWorkingDays(predEnd, lag);
            } else if (dep.type === 'SF') {
              // B finishes after A starts (+ lag) -> actually 1 + lag because start day is inclusive
              candidateEnd = addWorkingDays(predStart, 1 + lag);
            }
            if (isAfter(candidateEnd, requiredEnd)) {
              requiredEnd = candidateEnd;
            }
          }
        }
      }

      // Apply the constraints
      if (isAfter(requiredStart, currentStart)) {
        // Start is pushed forward
        successorTask.start = formatLocalDate(requiredStart);
        successorTask.end = formatLocalDate(calculateEndFromStart(requiredStart, successorTask.duration));
        startChanged = true;
      }

      // If it was pushed by FF/SF, check if end moved
      // NOTE: If startChanged was true, the new end might already satisfy requiredEnd.
      const currentCalculatedEnd = parseLocalDate(successorTask.end);
      if (isAfter(requiredEnd, currentCalculatedEnd)) {
        successorTask.end = formatLocalDate(requiredEnd);
        successorTask.start = formatLocalDate(calculateStartFromEnd(requiredEnd, successorTask.duration));
        endChanged = true;
      }

      if (startChanged || endChanged) {
        const downstreamSuccessors = successorsGraph.get(successorUid) || [];
        downstreamSuccessors.forEach(enqueue);
      }
  }

  // After all direct propagation, recalculate summary tasks
  recalculateSummaryTasks(taskMap);

  return Array.from(taskMap.values());
}
