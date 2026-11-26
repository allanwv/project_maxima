import { ChevronDown, ChevronRight, Plus, Trash2, MoreHorizontal, GripVertical, Indent as IndentIcon, Outdent as OutdentIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RenderTask, calculateEditedEnd, calculateEditedDuration, formatDateCompact, getDisplayIdByTaskUid } from '../../utils/ganttUtils';
import { parseDependencyExpression, formatDependencyTooltip } from '../../utils/dependencyUtils';
import { GanttColumnId, GanttColumnDefinition } from '../../domain/columnDefinitions';
import { EditableCell } from './EditableCell';
import { GanttTask, GanttResource } from '../../domain/models';

interface GanttTableProps {
  tasks: RenderTask[];
  onToggleExpand: (taskId: string) => void;
  expandedIds: Set<string>;
  visibleColumns: GanttColumnId[];
  visibleColumnDefs: GanttColumnDefinition[];
  columnWidths: Record<GanttColumnId, number>;
  onResizeColumn: (col: GanttColumnId, delta: number, startWidth: number) => void;
  updateTask: (taskId: string, updates: Partial<GanttTask>) => void;
  updateTasks?: (newTasks: GanttTask[]) => void;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onAddTask?: () => void;
  onAddSubtask?: (parentId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  editingTaskId?: string | null;
  onClearEditingTask?: () => void;
  allTasks?: GanttTask[];
  onMoveTask?: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  onIndentTask?: (taskId: string) => void;
  onOutdentTask?: (taskId: string) => void;
  canIndentTask?: (taskId: string) => boolean;
  resources?: GanttResource[];
  hoveredTaskId?: string | null;
  onHoverTask?: (taskId: string | null) => void;
}

interface ResizeHandleProps {
  col: GanttColumnId;
  onPointerDown: (e: React.PointerEvent, col: GanttColumnId) => void;
}

const ResizeHandle = ({ col, onPointerDown }: ResizeHandleProps) => (
  <div
    className="absolute right-0 top-0 bottom-0 w-2 translate-x-1/2 cursor-col-resize z-30 opacity-0 hover:opacity-100 flex items-center justify-center group-hover/header:opacity-100"
    onPointerDown={(e) => onPointerDown(e, col)}
    title="Arrastrar para ajustar ancho"
  >
    <div className="w-[2px] h-full bg-blue-400 group-hover/header:bg-blue-300" />
  </div>
);

function TaskActionMenu({
  task,
  isSelected,
  onAddSubtask,
  onDeleteTask,
  onIndentTask,
  onOutdentTask,
  canIndentTask
}: {
  task: RenderTask;
  isSelected: boolean;
  onAddSubtask?: (id: string) => void;
  onDeleteTask?: (id: string) => void;
  onIndentTask?: (taskId: string) => void;
  onOutdentTask?: (taskId: string) => void;
  canIndentTask?: (taskId: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleScroll = () => setOpen(false);

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const menuHeight = 165;
      const menuWidth = 208;
      const openUpward = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight;
      const top = openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4;
      const left = Math.min(rect.left, window.innerWidth - menuWidth - 8);
      setMenuPos({ top: Math.max(8, top), left: Math.max(8, left) });
    }
    setOpen(true);
  };

  return (
    <div className="relative flex items-center">
      <button
        ref={triggerRef}
        onClick={handleToggleMenu}
        className={`p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        title="Más acciones"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && menuPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ top: menuPos.top, left: menuPos.left }}
          className="fixed w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-[120] py-1 text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { onAddSubtask?.(task.id); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2 text-gray-700"
          >
            <Plus size={14} className="text-blue-500" /> Agregar subtarea
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => { onIndentTask?.(task.id); setOpen(false); }}
            disabled={!canIndentTask?.(task.id)}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IndentIcon size={14} className="text-gray-500" /> Indentar
          </button>
          <button
            onClick={() => { onOutdentTask?.(task.id); setOpen(false); }}
            disabled={!task.parentId}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <OutdentIcon size={14} className="text-gray-500" /> Desindentar
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => { setOpen(false); onDeleteTask?.(task.id); }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-50 flex items-center gap-2 text-red-600"
          >
            <Trash2 size={14} /> Eliminar
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// Helper to resolve resource names from IDs
function resolveResourceNames(resourceIds: string[], resources: GanttResource[]): string {
  if (!resourceIds || resourceIds.length === 0) return '';
  const names = resourceIds
    .map(id => resources.find(r => r.id === id)?.name)
    .filter(Boolean) as string[];
  return names.join(', ');
}

export function GanttTable({
  tasks, onToggleExpand, expandedIds,
  visibleColumns, visibleColumnDefs, columnWidths, onResizeColumn,
  updateTask, selectedTaskId, onSelectTask,
  onAddTask, onAddSubtask, onDeleteTask,
  editingTaskId, onClearEditingTask, allTasks,
  onMoveTask, onIndentTask, onOutdentTask, canIndentTask,
  resources = [],
  hoveredTaskId, onHoverTask
}: GanttTableProps) {
  const visibleTasks = tasks.filter(t => t.isVisible);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{ id: string, position: 'before' | 'after' } | null>(null);

  const totalWidth = visibleColumns.reduce((sum, colId) => sum + (columnWidths[colId] || 0), 0);

  const handlePointerDown = (e: React.PointerEvent, col: GanttColumnId) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[col];

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      onResizeColumn(col, delta, startWidth);
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  // Render a header cell for a given column definition
  const renderHeaderCell = (col: GanttColumnDefinition) => {
    return (
      <div
        key={col.id}
        className={`relative group/header flex items-center px-2 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}
        style={{ width: columnWidths[col.id] }}
      >
        <span className="uppercase truncate" title={col.tooltip || col.label}>{col.label}</span>
        <ResizeHandle col={col.id} onPointerDown={handlePointerDown} />
      </div>
    );
  };

  // Render a body cell for a given column and task
  const renderBodyCell = (col: GanttColumnDefinition, task: RenderTask) => {
    const width = columnWidths[col.id];
    const isAutoEditing = editingTaskId === task.id;

    switch (col.id) {
      case 'id':
        return (
          <div
            key={col.id}
            className="px-2 text-center text-xs text-gray-400 font-medium truncate flex-shrink-0 flex items-center justify-between"
            style={{ width }}
            title={task.sourceId ? `ID original: ${task.sourceId} | UID: ${task.id}` : `UID: ${task.id}`}
          >
            <div className="w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
              <GripVertical size={12} />
            </div>
            <span className="flex-1">{task.displayId}</span>
          </div>
        );

      case 'name':
        return (
          <div
            key={col.id}
            className="flex items-center overflow-hidden pr-4 h-full"
            style={{ width }}
          >
            {/* Tree Lines */}
            <div className="flex h-full flex-shrink-0 pl-1">
              {Array.from({ length: task.depth }).map((_, d) => {
                const isLast = task.ancestorsIsLast?.[d];
                const isDirectParent = d === task.depth - 1;
                return (
                  <div key={d} className="relative w-6 h-full flex-shrink-0">
                    {!isLast && !isDirectParent && (
                      <div className="absolute top-0 bottom-0 border-l border-gray-300" style={{ left: '50%' }} />
                    )}
                    {isDirectParent && (
                      <>
                        <div className="absolute top-0 h-1/2 border-l border-gray-300" style={{ left: '50%' }} />
                        {!isLast && <div className="absolute bottom-0 h-1/2 border-l border-gray-300" style={{ left: '50%' }} />}
                        <div className="absolute top-1/2 w-1/2 border-t border-gray-300" style={{ left: '50%' }} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {task.hasChildren ? (
              <button
                onClick={() => onToggleExpand(task.id)}
                className="mr-1.5 p-0.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors focus:outline-none flex-shrink-0"
              >
                {expandedIds.has(task.id) ? (
                  <ChevronDown size={14} strokeWidth={2.5} />
                ) : (
                  <ChevronRight size={14} strokeWidth={2.5} />
                )}
              </button>
            ) : (
              <div className="w-5 mr-1.5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0 flex items-center gap-1">
              <EditableCell
                value={task.name}
                onSave={(val) => {
                  const trimmed = val.trim();
                  if (!trimmed) return;
                  updateTask(task.id, { name: trimmed });
                  onClearEditingTask?.();
                }}
                onValidate={(val) => {
                  if (!val.trim()) return 'El nombre no puede estar vacío';
                  return null;
                }}
                className="text-sm font-medium text-gray-800"
                autoEdit={isAutoEditing}
              />
              <TaskActionMenu
                task={task}
                isSelected={selectedTaskId === task.id}
                onAddSubtask={onAddSubtask}
                onDeleteTask={onDeleteTask}
                onIndentTask={onIndentTask}
                onOutdentTask={onOutdentTask}
                canIndentTask={canIndentTask}
              />
              {onDeleteTask && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task.id);
                  }}
                  className={`p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0 ${selectedTaskId === task.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  title="Eliminar tarea (Supr)"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        );

      case 'progress':
        return (
          <div key={col.id} className="px-2 text-right text-xs text-gray-500 font-medium truncate" style={{ width }}>
            <EditableCell
              value={task.progress.toString()}
              type="number"
              className="justify-end"
              onSave={(val) => {
                let p = parseInt(val, 10);
                if (isNaN(p)) return;
                p = Math.max(0, Math.min(100, p));
                updateTask(task.id, {
                  progress: p,
                  importMetadata: { ...task.importMetadata, progressSource: 'maxima-user' }
                });
              }}
            />
            <span className="ml-0.5">%</span>
          </div>
        );

      case 'duration':
        return (
          <div key={col.id} className="px-2 text-right text-xs text-gray-600 truncate" style={{ width }}>
            {task.hasChildren ? (
              <span className="text-gray-500" title="Calculado automáticamente desde las subtareas">
                {(Math.round(task.duration * 1000) / 1000).toString()}
              </span>
            ) : (
              <EditableCell
                value={(Math.round(task.duration * 1000) / 1000).toString()}
                type="number"
                className="justify-end"
                title={task.importMetadata?.durationEstimated ? 'Duración estimada (Doble clic para editar)' : undefined}
                onSave={(val) => {
                  const d = parseFloat(val.replace(',', '.'));
                  if (isNaN(d) || d < 0) return;
                  const newEnd = calculateEditedEnd(task.start, d);
                  updateTask(task.id, {
                    duration: d,
                    end: newEnd,
                    importMetadata: { ...task.importMetadata, durationSource: 'maxima-calculated', durationEstimated: false }
                  });
                }}
              />
            )}
            <span className="ml-1 text-gray-400">días{task.importMetadata?.durationEstimated ? ' ?' : ''}</span>
          </div>
        );

      case 'estimatedStart':
        return (
          <div key={col.id} className="px-2 text-xs text-gray-600 truncate" style={{ width }}>
            {task.hasChildren ? (
              <span className="text-gray-500" title="Calculado automáticamente desde las subtareas">
                {formatDateCompact(task.start)}
              </span>
            ) : (
              <EditableCell
                value={task.start ? task.start.substring(0, 10) : ''}
                displayValue={formatDateCompact(task.start)}
                type="date"
                onSave={(val) => {
                  if (!val) return;
                  let iso = val;
                  if (!iso.includes('T')) iso += 'T00:00:00.000Z';
                  const newEnd = calculateEditedEnd(iso, task.duration);
                  updateTask(task.id, {
                    start: iso,
                    end: newEnd,
                    importMetadata: { ...task.importMetadata, startSource: 'maxima-user', durationSource: 'maxima-calculated' }
                  });
                }}
              />
            )}
          </div>
        );

      case 'estimatedFinish':
        return (
          <div key={col.id} className="px-2 text-xs text-gray-600 truncate" style={{ width }}>
            {task.hasChildren ? (
              <span className="text-gray-500" title="Calculado automáticamente desde las subtareas">
                {formatDateCompact(task.end)}
              </span>
            ) : (
              <EditableCell
                value={task.end ? task.end.substring(0, 10) : ''}
                displayValue={formatDateCompact(task.end)}
                type="date"
                onSave={(val) => {
                  if (!val) return;
                  let iso = val;
                  if (!iso.includes('T')) iso += 'T00:00:00.000Z';
                  const newDuration = calculateEditedDuration(task.start, iso);
                  updateTask(task.id, {
                    end: iso,
                    duration: newDuration,
                    importMetadata: { ...task.importMetadata, finishSource: 'maxima-user', durationSource: 'maxima-calculated' }
                  });
                }}
              />
            )}
          </div>
        );

      case 'predecessors':
        return (
          <div
            key={col.id}
            className="px-2 text-xs text-gray-500 truncate font-mono"
            style={{ width }}
            title={task.dependencies?.map(d => formatDependencyTooltip(d, getDisplayIdByTaskUid(tasks, d.taskId) || '?')).join('\n')}
          >
            <EditableCell
              value={task.dependencies?.map(dep => {
                const preId = getDisplayIdByTaskUid(tasks, dep.taskId) || '?';
                const lagStr = dep.lag && dep.lag !== 0 ? (dep.lag > 0 ? `+${dep.lag}d` : `${dep.lag}d`) : '';
                return `${preId}${dep.type}${lagStr}`;
              }).join(', ') || ''}
              onValidate={(val) => {
                const result = parseDependencyExpression(val, tasks, task.id);
                if (!Array.isArray(result)) {
                  return result.message;
                }
                return null;
              }}
              onSave={(val) => {
                const result = parseDependencyExpression(val, tasks, task.id);
                if (Array.isArray(result)) {
                  updateTask(task.id, { dependencies: result });
                }
              }}
            />
          </div>
        );

      case 'resources':
        return (
          <div
            key={col.id}
            className="px-2 text-xs text-gray-600 truncate"
            style={{ width }}
            title={resolveResourceNames(task.resourceIds || [], resources)}
          >
            <span className="truncate block">{resolveResourceNames(task.resourceIds || [], resources)}</span>
          </div>
        );

      case 'actualStart':
        return (
          <div key={col.id} className="px-2 text-xs text-gray-600 truncate" style={{ width }}>
            <span>{formatDateCompact(task.actualStart)}</span>
          </div>
        );

      case 'actualFinish':
        return (
          <div key={col.id} className="px-2 text-xs text-gray-600 truncate" style={{ width }}>
            <span>{formatDateCompact(task.actualFinish)}</span>
          </div>
        );

      case 'baselineStart':
        return (
          <div key={col.id} className="px-2 text-xs text-gray-600 truncate" style={{ width }}>
            <span>{formatDateCompact(task.baselineStart)}</span>
          </div>
        );

      case 'baselineFinish':
        return (
          <div key={col.id} className="px-2 text-xs text-gray-600 truncate" style={{ width }}>
            <span>{formatDateCompact(task.baselineFinish)}</span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="flex-shrink-0 border-r border-gray-200 bg-white flex flex-col z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] select-none"
      style={{ width: totalWidth }}
    >
      {/* Header */}
      <div className="h-[var(--header-height)] border-b border-gray-200 flex items-end pb-2 bg-gray-50 sticky top-0 z-40">
        <div className="flex w-full text-xs font-semibold text-gray-500 tracking-wider">
          {visibleColumnDefs.map(col => renderHeaderCell(col))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1">
        {visibleTasks.map((task) => {
          const isSelected = selectedTaskId === task.id;
          const isHovered = hoveredTaskId === task.id;
          const isDraggingThis = draggedId === task.id;
          const isDropTarget = dragTarget?.id === task.id;

          return (
            <div
              key={task.id}
              draggable
              onMouseEnter={() => onHoverTask?.(task.id)}
              onMouseLeave={() => onHoverTask?.(null)}
              onDragStart={(e) => {
                setDraggedId(task.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!draggedId || draggedId === task.id) return;

                const rect = e.currentTarget.getBoundingClientRect();
                const isTopHalf = e.clientY < rect.top + rect.height / 2;
                setDragTarget({ id: task.id, position: isTopHalf ? 'before' : 'after' });
              }}
              onDragLeave={() => { }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedId && dragTarget && draggedId !== dragTarget.id) {
                  onMoveTask?.(draggedId, dragTarget.id, dragTarget.position);
                }
                setDraggedId(null);
                setDragTarget(null);
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDragTarget(null);
              }}
              onClick={(e) => { e.stopPropagation(); onSelectTask(task.id); }}
              className={`flex items-center relative h-[var(--row-height)] border-b border-gray-100 transition-colors group cursor-pointer
              ${isSelected ? 'bg-blue-100 hover:bg-blue-100' : isHovered ? 'bg-gray-100/80' : 'hover:bg-slate-50'}
              ${isDraggingThis ? 'opacity-40' : ''}
            `}
            >
              {isDropTarget && dragTarget?.position === 'before' && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-30 pointer-events-none" />
              )}
              {isDropTarget && dragTarget?.position === 'after' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-30 pointer-events-none" />
              )}

              {visibleColumnDefs.map(col => renderBodyCell(col, task))}
            </div>
          );
        })}

        {/* Add Task Row */}
        {onAddTask && (
          <div className="flex items-center h-[var(--row-height)] border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddTask();
              }}
              className={`flex items-center gap-1.5 px-4 py-1 text-xs transition-colors ml-[55px] ${visibleTasks.length === 0
                ? 'text-blue-600 font-medium hover:text-blue-700'
                : 'text-gray-400 hover:text-blue-600'
                }`}
            >
              <Plus size={14} />
              <span>{visibleTasks.length === 0 ? 'Agregar primera tarea' : 'Tarea'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
