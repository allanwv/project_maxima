import { useState, useEffect, useRef, useMemo } from 'react';
import { Columns3, RotateCcw } from 'lucide-react';
import { COLUMN_DEFINITIONS, GanttColumnId } from '../../domain/columnDefinitions';
import { GanttTask, GanttResource } from '../../domain/models';

interface ColumnSelectorProps {
  visibleColumns: GanttColumnId[];
  onToggle: (colId: GanttColumnId) => void;
  onReset: () => void;
  tasks: GanttTask[];
  resources: GanttResource[];
}

/**
 * Check whether ANY task in the project has data for a given column.
 * Returns true if at least one task has a non-empty value.
 */
function columnHasData(colId: GanttColumnId, tasks: GanttTask[], resources: GanttResource[]): boolean {
  switch (colId) {
    case 'resources':
      return tasks.some(t => t.resourceIds && t.resourceIds.length > 0 && resources.length > 0);
    case 'actualStart':
      return tasks.some(t => !!t.actualStart);
    case 'actualFinish':
      return tasks.some(t => !!t.actualFinish);
    case 'baselineStart':
      return tasks.some(t => !!t.baselineStart);
    case 'baselineFinish':
      return tasks.some(t => !!t.baselineFinish);
    // Core columns always have data by definition
    default:
      return true;
  }
}

export function ColumnSelectorButton({ visibleColumns, onToggle, onReset, tasks, resources }: ColumnSelectorProps) {
  const [open, setOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const coreColumns = COLUMN_DEFINITIONS.filter(c => c.group === 'core');
  const optionalColumns = COLUMN_DEFINITIONS.filter(c => c.group === 'optional');

  // Memoize data availability check so it doesn't recompute on every render
  const dataAvailability = useMemo(() => {
    const map: Partial<Record<GanttColumnId, boolean>> = {};
    for (const col of COLUMN_DEFINITIONS) {
      map[col.id] = columnHasData(col.id, tasks, resources);
    }
    return map as Record<GanttColumnId, boolean>;
  }, [tasks, resources]);

  return (
    <div className="relative" ref={modalRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
        title="Configurar columnas visibles"
      >
        <Columns3 size={14} />
        <span>Columnas</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-[60] py-2">
          {/* Core columns */}
          <div className="py-1.5 px-1">
            {coreColumns.map(col => {
              const checked = visibleColumns.includes(col.id);
              const disabled = !!col.alwaysVisible;
              return (
                <label
                  key={col.id}
                  className={`flex items-center gap-2.5 px-2 py-1 rounded cursor-pointer text-sm transition-colors ${
                    disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggle(col.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 h-3.5 w-3.5"
                  />
                  <span className="text-gray-700">{col.selectorLabel || col.label}</span>
                </label>
              );
            })}
          </div>

          {/* Separator */}
          <div className="border-t border-gray-100 mx-2 my-1" />

          {/* Optional columns */}
          <div className="py-1.5 px-1">
            {optionalColumns.map(col => {
              const checked = visibleColumns.includes(col.id);
              const hasData = dataAvailability[col.id];
              return (
                <label
                  key={col.id}
                  className="flex items-center gap-2.5 px-2 py-1 rounded cursor-pointer text-sm hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(col.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 h-3.5 w-3.5"
                  />
                  <span className="text-gray-700 flex-1">{col.selectorLabel || col.label}</span>
                  {!hasData && (
                    <span className="text-[10px] text-gray-400 ml-auto">Sin datos</span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Reset */}
          <div className="border-t border-gray-100 mx-2 my-1" />
          <div className="px-2 pt-1">
            <button
              onClick={() => { onReset(); }}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
            >
              <RotateCcw size={12} />
              <span>Restaurar predeterminadas</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
