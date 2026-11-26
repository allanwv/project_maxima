import { addDays, parseISO, startOfDay, max, min, format, isWeekend, addBusinessDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { GanttTask } from '../domain/models';

export interface RenderTask extends GanttTask {
  depth: number;
  hasChildren: boolean;
  isVisible: boolean;
  displayId: number;
  ancestorsIsLast: boolean[];
}

/**
 * Parses the calendar date (YYYY-MM-DD) from an ISO string into a local midnight Date
 * without timezone shift (so "2026-11-26T00:00:00.000Z" stays Nov 26 in UTC-3).
 */
export function tryParseCalendarDate(isoStr: string | undefined): Date | null {
  if (!isoStr || typeof isoStr !== 'string') return null;
  const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Parses an ISO date string into local midnight, falling back to today if invalid.
 */
export function parseCalendarDate(isoStr: string): Date {
  return tryParseCalendarDate(isoStr) ?? startOfDay(new Date());
}

/**
 * Formats a local Date into a naive calendar ISO timestamp ("yyyy-MM-ddT00:00:00.000Z").
 */
export function formatCalendarIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

export function formatDateCompact(isoStr: string | undefined): string {
  const parsed = tryParseCalendarDate(isoStr);
  if (!parsed) return '';
  return format(parsed, 'dd-MM-yyyy');
}

export function formatDateFull(isoStr: string | undefined): string {
  if (!isoStr) return '';
  try {
    return format(parseISO(isoStr), 'dd-MM-yyyy HH:mm', { locale: es });
  } catch {
    return '';
  }
}

/**
 * Calculates duration in days excluding weekends (Monday-Friday).
 * @param start Start date ISO string
 * @param end End date ISO string
 * @returns number of working days
 */
export function calculateEditedDuration(start: string, end: string): number {
  const s = tryParseCalendarDate(start);
  const e = tryParseCalendarDate(end);

  if (!s || !e) return 0;
  if (s > e) return 0;

  let days = 0;
  let current = s;
  while (current <= e) {
    if (!isWeekend(current)) {
      days++;
    }
    current = addDays(current, 1);
  }
  return days; // We just return integer working days for MVP editable calculation
}

/**
 * Calculates end date by adding working days to start date.
 * @param start Start date ISO string
 * @param durationDays Number of working days
 * @returns End date ISO string
 */
export function calculateEditedEnd(start: string, durationDays: number): string {
  const s = tryParseCalendarDate(start);
  if (!s) return '';

  if (durationDays <= 1) return formatCalendarIso(s); // 1 day duration means start == end

  // addBusinessDays doesn't count the current day if it's a workday towards the duration in the way we want.
  // Our convention: 1 day duration = start and end are on the same day.
  // So durationDays = 2 means add 1 business day.
  const result = addBusinessDays(s, Math.ceil(durationDays) - 1);
  return formatCalendarIso(result);
}

export function getProjectDateRange(tasks: GanttTask[]) {
  if (tasks.length === 0) {
    const today = startOfDay(new Date());
    return {
      start: addDays(today, -7),
      end: addDays(today, 21)
    };
  }

  const startDates = tasks.map(t => parseCalendarDate(t.start));
  const endDates = tasks.map(t => parseCalendarDate(t.end));

  const projectStart = min(startDates);
  const projectEnd = max(endDates);

  // Add some padding
  return {
    start: addDays(projectStart, -7),
    end: addDays(projectEnd, 14)
  };
}

export function buildTaskHierarchy(tasks: GanttTask[], expandedIds: Set<string>): RenderTask[] {
  const result: RenderTask[] = [];
  const taskMap = new Map<string, GanttTask>();
  const childrenMap = new Map<string, GanttTask[]>();

  tasks.forEach(t => {
    taskMap.set(t.id, t);
    const parentId = t.parentId || 'root';
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(t);
  });

  function traverse(parentId: string, depth: number, isVisible: boolean, ancestorsIsLast: boolean[]) {
    const children = childrenMap.get(parentId) || [];
    children.forEach((child, index) => {
      const hasChildren = (childrenMap.get(child.id) || []).length > 0;
      const isLastChild = index === children.length - 1;
      
      const currentAncestorsIsLast = [...ancestorsIsLast, isLastChild];

      result.push({
        ...child,
        depth,
        hasChildren,
        isVisible,
        displayId: result.length + 1,
        ancestorsIsLast: currentAncestorsIsLast
      });

      if (hasChildren) {
        const isExpanded = expandedIds.has(child.id);
        traverse(child.id, depth + 1, isVisible && isExpanded, currentAncestorsIsLast);
      }
    });
  }

  traverse('root', 0, true, []);
  return result;
}

export function getDaysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let current = startOfDay(start);
  const final = startOfDay(end);

  while (current <= final) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

/**
 * Resolves the display ID for a given task UID.
 * The tasks array passed here MUST be the result of buildTaskHierarchy 
 * so it contains the correctly computed displayIds.
 */
export function getDisplayIdByTaskUid(tasks: RenderTask[], uid: string): number | null {
  const task = tasks.find(t => t.id === uid);
  return task ? task.displayId : null;
}
