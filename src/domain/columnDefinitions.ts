/**
 * Column Definitions for the Gantt Table.
 *
 * Single source of truth for every column that can appear in the table view.
 * This module defines IDs, labels, defaults, widths, and visibility rules.
 *
 * NOTE: "Responsables" resolves task.resourceIds against project.resources.
 * It does NOT use free-text Contact fields from XML.
 */

export type GanttColumnId =
  | 'id'
  | 'name'
  | 'progress'
  | 'duration'
  | 'estimatedStart'
  | 'estimatedFinish'
  | 'predecessors'
  | 'resources'
  | 'actualStart'
  | 'actualFinish'
  | 'baselineStart'
  | 'baselineFinish';

export interface GanttColumnDefinition {
  id: GanttColumnId;
  /** Short header label shown in the table */
  label: string;
  /** Tooltip shown on hover over the header */
  tooltip?: string;
  /** Longer descriptive label shown in the column selector modal */
  selectorLabel?: string;
  /** Whether this column is visible by default */
  defaultVisible: boolean;
  /** Default width in pixels */
  defaultWidth: number;
  /** Minimum width in pixels for resize */
  minWidth: number;
  /** If true, the column cannot be hidden by the user */
  alwaysVisible?: boolean;
  /** If true, cells in this column are read-only (no inline editing) */
  readOnly?: boolean;
  /** Alignment of cell content */
  align?: 'left' | 'center' | 'right';
  /** Group: 'core' columns shown first in selector, 'optional' shown below separator */
  group: 'core' | 'optional';
}

export const COLUMN_DEFINITIONS: GanttColumnDefinition[] = [
  {
    id: 'id',
    label: 'ID',
    tooltip: 'ID visual de la tarea',
    defaultVisible: true,
    defaultWidth: 55,
    minWidth: 45,
    align: 'center',
    group: 'core',
  },
  {
    id: 'name',
    label: 'Nombre de la Tarea',
    defaultVisible: true,
    defaultWidth: 280,
    minWidth: 160,
    alwaysVisible: true,
    align: 'left',
    group: 'core',
  },
  {
    id: 'progress',
    label: '%',
    tooltip: 'Porcentaje de avance',
    defaultVisible: true,
    defaultWidth: 65,
    minWidth: 50,
    align: 'right',
    group: 'core',
  },
  {
    id: 'duration',
    label: 'Duración',
    tooltip: 'Duración en días',
    defaultVisible: true,
    defaultWidth: 105,
    minWidth: 85,
    align: 'right',
    group: 'core',
  },
  {
    id: 'estimatedStart',
    label: 'S',
    tooltip: 'Start / Inicio',
    defaultVisible: true,
    defaultWidth: 110,
    minWidth: 85,
    align: 'left',
    group: 'core',
  },
  {
    id: 'estimatedFinish',
    label: 'F',
    tooltip: 'Finish / Fin',
    defaultVisible: true,
    defaultWidth: 110,
    minWidth: 85,
    align: 'left',
    group: 'core',
  },
  {
    id: 'predecessors',
    label: 'PREDEC.',
    tooltip: 'Predecesoras',
    defaultVisible: true,
    defaultWidth: 120,
    minWidth: 90,
    align: 'left',
    group: 'core',
  },
  // --- Optional columns ---
  {
    id: 'resources',
    label: 'RESPONSABLES',
    tooltip: 'Recursos asignados',
    selectorLabel: 'Responsables',
    defaultVisible: false,
    defaultWidth: 150,
    minWidth: 100,
    readOnly: true,
    align: 'left',
    group: 'optional',
  },
  {
    id: 'actualStart',
    label: 'aS',
    tooltip: 'Actual Start / Inicio real',
    selectorLabel: 'aS · Inicio real',
    defaultVisible: false,
    defaultWidth: 105,
    minWidth: 85,
    readOnly: true,
    align: 'left',
    group: 'optional',
  },
  {
    id: 'actualFinish',
    label: 'aF',
    tooltip: 'Actual Finish / Fin real',
    selectorLabel: 'aF · Fin real',
    defaultVisible: false,
    defaultWidth: 105,
    minWidth: 85,
    readOnly: true,
    align: 'left',
    group: 'optional',
  },
  {
    id: 'baselineStart',
    label: 'bS',
    tooltip: 'Baseline Start / Inicio línea base',
    selectorLabel: 'bS · Inicio línea base',
    defaultVisible: false,
    defaultWidth: 105,
    minWidth: 85,
    readOnly: true,
    align: 'left',
    group: 'optional',
  },
  {
    id: 'baselineFinish',
    label: 'bF',
    tooltip: 'Baseline Finish / Fin línea base',
    selectorLabel: 'bF · Fin línea base',
    defaultVisible: false,
    defaultWidth: 105,
    minWidth: 85,
    readOnly: true,
    align: 'left',
    group: 'optional',
  },
];

/** The default set of visible column IDs */
export const DEFAULT_VISIBLE_COLUMNS: GanttColumnId[] = COLUMN_DEFINITIONS
  .filter(c => c.defaultVisible)
  .map(c => c.id);

/** Helper to get a column definition by ID */
export function getColumnDef(id: GanttColumnId): GanttColumnDefinition | undefined {
  return COLUMN_DEFINITIONS.find(c => c.id === id);
}

/** Build a default widths map from column definitions */
export function getDefaultColumnWidths(): Record<GanttColumnId, number> {
  const widths: Partial<Record<GanttColumnId, number>> = {};
  for (const col of COLUMN_DEFINITIONS) {
    widths[col.id] = col.defaultWidth;
  }
  return widths as Record<GanttColumnId, number>;
}

/** Build a min widths map from column definitions */
export function getMinColumnWidths(): Record<GanttColumnId, number> {
  const widths: Partial<Record<GanttColumnId, number>> = {};
  for (const col of COLUMN_DEFINITIONS) {
    widths[col.id] = col.minWidth;
  }
  return widths as Record<GanttColumnId, number>;
}

// ---- Persistence ----

const VISIBLE_COLUMNS_KEY = 'maxima:gantt-visible-columns';
const COLUMN_WIDTHS_KEY = 'maxima:gantt-column-widths';

/**
 * Load visible columns from localStorage with safe fallback.
 * If stored data is invalid or has unknown IDs, falls back to defaults.
 */
export function loadVisibleColumns(): GanttColumnId[] {
  if (typeof window === 'undefined') return DEFAULT_VISIBLE_COLUMNS;
  try {
    const raw = localStorage.getItem(VISIBLE_COLUMNS_KEY);
    if (!raw) return DEFAULT_VISIBLE_COLUMNS;
    const parsed: string[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_COLUMNS;

    const validIds = new Set(COLUMN_DEFINITIONS.map(c => c.id));
    const filtered = parsed.filter(id => validIds.has(id as GanttColumnId)) as GanttColumnId[];

    // Always include alwaysVisible columns
    for (const col of COLUMN_DEFINITIONS) {
      if (col.alwaysVisible && !filtered.includes(col.id)) {
        filtered.push(col.id);
      }
    }

    return filtered.length > 0 ? filtered : DEFAULT_VISIBLE_COLUMNS;
  } catch {
    return DEFAULT_VISIBLE_COLUMNS;
  }
}

/** Save visible columns to localStorage */
export function saveVisibleColumns(columns: GanttColumnId[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VISIBLE_COLUMNS_KEY, JSON.stringify(columns));
}

/**
 * Load column widths from localStorage with safe merge.
 * Unknown keys are ignored. Missing keys get defaults.
 */
export function loadColumnWidths(): Record<GanttColumnId, number> {
  const defaults = getDefaultColumnWidths();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(COLUMN_WIDTHS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaults;

    const validIds = new Set(COLUMN_DEFINITIONS.map(c => c.id));
    const merged = { ...defaults };
    for (const [key, value] of Object.entries(parsed)) {
      if (validIds.has(key as GanttColumnId) && typeof value === 'number' && value > 0) {
        merged[key as GanttColumnId] = value;
      }
    }
    return merged;
  } catch {
    return defaults;
  }
}

/** Save column widths to localStorage */
export function saveColumnWidths(widths: Record<GanttColumnId, number>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
}
