import { useState, useCallback, useEffect } from 'react';
import {
  GanttColumnId,
  COLUMN_DEFINITIONS,
  DEFAULT_VISIBLE_COLUMNS,
  loadVisibleColumns,
  saveVisibleColumns,
  loadColumnWidths,
  saveColumnWidths,
  getMinColumnWidths,
  getDefaultColumnWidths,
} from '../domain/columnDefinitions';

export function useColumnVisibility() {
  const [visibleColumns, setVisibleColumns] = useState<GanttColumnId[]>(() => loadVisibleColumns());
  const [columnWidths, setColumnWidths] = useState<Record<GanttColumnId, number>>(() => loadColumnWidths());

  // Persist on change
  useEffect(() => {
    saveVisibleColumns(visibleColumns);
  }, [visibleColumns]);

  useEffect(() => {
    saveColumnWidths(columnWidths);
  }, [columnWidths]);

  const toggleColumn = useCallback((colId: GanttColumnId) => {
    const def = COLUMN_DEFINITIONS.find(c => c.id === colId);
    if (!def || def.alwaysVisible) return;

    setVisibleColumns(prev => {
      if (prev.includes(colId)) {
        return prev.filter(id => id !== colId);
      } else {
        // Insert at the position matching COLUMN_DEFINITIONS order
        const allIds = COLUMN_DEFINITIONS.map(c => c.id);
        const newSet = new Set([...prev, colId]);
        return allIds.filter(id => newSet.has(id));
      }
    });
  }, []);

  const isColumnVisible = useCallback((colId: GanttColumnId) => {
    return visibleColumns.includes(colId);
  }, [visibleColumns]);

  const resetToDefaults = useCallback(() => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    setColumnWidths(getDefaultColumnWidths());
  }, []);

  const resizeColumn = useCallback((colId: GanttColumnId, delta: number, startWidth: number) => {
    const mins = getMinColumnWidths();
    setColumnWidths(prev => ({
      ...prev,
      [colId]: Math.max(mins[colId] || 50, startWidth + delta),
    }));
  }, []);

  /** Sum of widths for all currently visible columns */
  const totalWidth = visibleColumns.reduce((sum, colId) => sum + (columnWidths[colId] || 0), 0);

  /** Ordered list of visible column definitions */
  const visibleColumnDefs = COLUMN_DEFINITIONS.filter(c => visibleColumns.includes(c.id));

  return {
    visibleColumns,
    visibleColumnDefs,
    columnWidths,
    totalWidth,
    toggleColumn,
    isColumnVisible,
    resetToDefaults,
    resizeColumn,
    setColumnWidths,
  };
}
