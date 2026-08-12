import { ChevronDown, ChevronRight, Plus, Trash2, MoreHorizontal, GripVertical, Indent as IndentIcon, Outdent as OutdentIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { RenderTask, calculateEditedEnd, calculateEditedDuration, getDisplayIdByTaskUid } from '../../utils/ganttUtils';
import { parseDependencyExpression, formatDependencyTooltip } from '../../utils/dependencyUtils';
import { ColumnWidths } from './GanttChart';
import { EditableCell } from './EditableCell';
import { GanttTask } from '../../domain/models';
import { findDependentTasks, getDescendantIds } from '../../domain/taskUtils';

interface GanttTableProps {
  tasks: RenderTask[];
  onToggleExpand: (taskId: string) => void;
  expandedIds: Set<string>;
  columnWidths: ColumnWidths;
  onResizeColumn: (col: keyof ColumnWidths, delta: number, startWidth: number) => void;
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
}

interface ResizeHandleProps {
  col: keyof ColumnWidths;
  onPointerDown: (e: React.PointerEvent, col: keyof ColumnWidths) => void;
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
  onAddSubtask, 
  onDeleteTask, 
  allTasks,
  onIndentTask,
  onOutdentTask,
  canIndentTask
}: { 
  task: RenderTask; 
  onAddSubtask?: (id: string) => void; 
  onDeleteTask?: (id: string) => void; 
  allTasks?: GanttTask[]; 
  onIndentTask?: (taskId: string) => void;
  onOutdentTask?: (taskId: string) => void;
  canIndentTask?: (taskId: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const descendants = allTasks ? getDescendantIds(allTasks, task.id) : [];
  const deletedIds = new Set([task.id, ...descendants]);
  const dependentTasks = allTasks ? findDependentTasks(allTasks, deletedIds) : [];

  const handleDeleteClick = () => {
    if (descendants.length > 0 || dependentTasks.length > 0) {
      setConfirmDelete(true);
    } else {
      onDeleteTask?.(task.id);
      setOpen(false);
    }
  };

  const handleConfirmDelete = () => {
    onDeleteTask?.(task.id);
    setOpen(false);
    setConfirmDelete(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); setConfirmDelete(false); }}
        className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
        title="Acciones"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 text-sm" onClick={(e) => e.stopPropagation()}>
          {!confirmDelete ? (
            <>
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
                onClick={handleDeleteClick}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 flex items-center gap-2 text-red-600"
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </>
          ) : (
            <div className="px-3 py-2">
              <p className="text-xs text-gray-700 font-medium mb-1">¿Confirmar eliminación?</p>
              {descendants.length > 0 && (
                <p className="text-[11px] text-amber-600 mb-1">
                  Contiene {descendants.length} subtarea{descendants.length > 1 ? 's' : ''} que también se eliminarán.
                </p>
              )}
              {dependentTasks.length > 0 && (
                <p className="text-[11px] text-amber-600 mb-1">
                  {dependentTasks.length} tarea{dependentTasks.length > 1 ? 's' : ''} depende{dependentTasks.length === 1 ? '' : 'n'} de esta actividad.
                </p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => { setConfirmDelete(false); setOpen(false); }}
                  className="flex-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GanttTable({ 
  tasks, onToggleExpand, expandedIds, columnWidths, onResizeColumn, 
  updateTask, selectedTaskId, onSelectTask,
  onAddTask, onAddSubtask, onDeleteTask,
  editingTaskId, onClearEditingTask, allTasks,
  onMoveTask, onIndentTask, onOutdentTask, canIndentTask
}: GanttTableProps) {
  const visibleTasks = tasks.filter(t => t.isVisible);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{ id: string, position: 'before' | 'after' } | null>(null);

  const totalWidth = columnWidths.id + columnWidths.name + columnWidths.progress + columnWidths.duration + columnWidths.es + columnWidths.ef + columnWidths.predecessors;

  const handlePointerDown = (e: React.PointerEvent, col: keyof ColumnWidths) => {
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

  return (
    <div 
      className="flex-shrink-0 border-r border-gray-200 bg-white flex flex-col z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] select-none"
      style={{ width: totalWidth }}
    >
      {/* Header */}
      <div className="h-[var(--header-height)] border-b border-gray-200 flex items-end pb-2 bg-gray-50/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex w-full text-xs font-semibold text-gray-500 tracking-wider">
          {/* ID */}
          <div className="relative group/header flex items-center justify-center px-2" style={{ width: columnWidths.id }}>
            <span className="uppercase truncate" title="ID visual de la tarea">ID</span>
            <ResizeHandle col="id" onPointerDown={handlePointerDown} />
          </div>
          {/* Name */}
          <div className="relative group/header flex items-center px-4" style={{ width: columnWidths.name }}>
            <span className="uppercase truncate">Nombre de la Tarea</span>
            <ResizeHandle col="name" onPointerDown={handlePointerDown} />
          </div>
          {/* Progress */}
          <div className="relative group/header flex items-center justify-end px-2" style={{ width: columnWidths.progress }}>
            <span className="uppercase truncate">%</span>
            <ResizeHandle col="progress" onPointerDown={handlePointerDown} />
          </div>
          {/* Duration */}
          <div className="relative group/header flex items-center justify-end px-2" style={{ width: columnWidths.duration }}>
            <span className="uppercase truncate">Duración</span>
            <ResizeHandle col="duration" onPointerDown={handlePointerDown} />
          </div>
          {/* eS */}
          <div className="relative group/header flex items-center px-2" style={{ width: columnWidths.es }}>
            <span className="uppercase truncate" title="Estimated Start / Inicio estimado">eS</span>
            <ResizeHandle col="es" onPointerDown={handlePointerDown} />
          </div>
          {/* eF */}
          <div className="relative group/header flex items-center px-2" style={{ width: columnWidths.ef }}>
            <span className="uppercase truncate" title="Estimated Finish / Fin estimado">eF</span>
            <ResizeHandle col="ef" onPointerDown={handlePointerDown} />
          </div>
          {/* Predecessors */}
          <div className="relative group/header flex items-center px-2" style={{ width: columnWidths.predecessors }}>
            <span className="uppercase truncate" title="Predecesoras">PREDEC.</span>
            <ResizeHandle col="predecessors" onPointerDown={handlePointerDown} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1">
        {visibleTasks.map((task) => {
          const isSelected = selectedTaskId === task.id;
          const isAutoEditing = editingTaskId === task.id;
          const isDraggingThis = draggedId === task.id;
          const isDropTarget = dragTarget?.id === task.id;

          return (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => {
              setDraggedId(task.id);
              e.dataTransfer.effectAllowed = 'move';
              // Optional: e.dataTransfer.setDragImage(...)
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (!draggedId || draggedId === task.id) return;
              
              // Only trigger autoscroll near edges if possible, standard HTML5 drag does some automatically
              const rect = e.currentTarget.getBoundingClientRect();
              const isTopHalf = e.clientY < rect.top + rect.height / 2;
              setDragTarget({ id: task.id, position: isTopHalf ? 'before' : 'after' });
            }}
            onDragLeave={(e) => {
              // We don't nullify dragTarget here immediately to avoid flicker, 
              // but we can rely on dragOver on other elements or dragEnd
            }}
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
            onClick={() => onSelectTask(task.id)}
            className={`flex items-center relative h-[var(--row-height)] border-b border-gray-100 transition-colors group cursor-pointer
              ${isSelected ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-gray-50'}
              ${isDraggingThis ? 'opacity-40' : ''}
            `}
          >
            {isDropTarget && dragTarget?.position === 'before' && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-30 pointer-events-none" />
            )}
            {isDropTarget && dragTarget?.position === 'after' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-30 pointer-events-none" />
            )}

            {/* ID */}
            <div 
              className="px-2 text-center text-xs text-gray-400 font-medium truncate flex-shrink-0 flex items-center justify-between"
              style={{ width: columnWidths.id }}
              title={task.sourceId ? `ID original: ${task.sourceId} | UID: ${task.id}` : `UID: ${task.id}`}
            >
              <div className="w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
                <GripVertical size={12} />
              </div>
              <span className="flex-1">{task.displayId}</span>
            </div>

            {/* Name */}
            <div 
              className="flex items-center overflow-hidden px-4"
              style={{ width: columnWidths.name, paddingLeft: `calc(0.25rem + ${task.depth * 0.4}rem)` }}
            >
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
                  onAddSubtask={onAddSubtask}
                  onDeleteTask={onDeleteTask}
                  allTasks={allTasks}
                  onIndentTask={onIndentTask}
                  onOutdentTask={onOutdentTask}
                  canIndentTask={canIndentTask}
                />
              </div>
            </div>
            
            {/* Progress */}
            <div className="px-2 text-right text-xs text-gray-500 font-medium truncate" style={{ width: columnWidths.progress }}>
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

            {/* Duration */}
            <div 
              className="px-2 text-right text-xs text-gray-600 truncate" 
              style={{ width: columnWidths.duration }}
            >
              <EditableCell 
                value={(Math.round(task.duration * 1000)/1000).toString()} 
                type="number"
                className="justify-end"
                title={task.importMetadata?.durationEstimated ? 'Duración estimada (Doble clic para editar)' : undefined}
                onSave={(val) => {
                  const d = parseFloat(val.replace(',', '.'));
                  if (isNaN(d) || d < 0) return;
                  
                  // Calculate new end based on duration
                  const newEnd = calculateEditedEnd(task.start, d);
                  updateTask(task.id, {
                    duration: d,
                    end: newEnd,
                    importMetadata: { ...task.importMetadata, durationSource: 'maxima-calculated', durationEstimated: false }
                  });
                }}
              />
              <span className="ml-1 text-gray-400">días{task.importMetadata?.durationEstimated ? ' ?' : ''}</span>
            </div>

            {/* eS */}
            <div className="px-2 text-xs text-gray-600 truncate" style={{ width: columnWidths.es }}>
              <EditableCell 
                value={task.start ? task.start.substring(0, 10) : ''}
                displayValue={task.start ? format(parseISO(task.start), 'dd-MM-yyyy') : ''}
                type="date"
                onSave={(val) => {
                  if (!val) return;
                  // If we change start, we recalculate end to preserve duration
                  let iso = val;
                  if (!iso.includes('T')) iso += 'T00:00:00.000Z'; // naive
                  const newEnd = calculateEditedEnd(iso, task.duration);
                  updateTask(task.id, { 
                    start: iso,
                    end: newEnd,
                    importMetadata: { ...task.importMetadata, startSource: 'maxima-user', durationSource: 'maxima-calculated' } 
                  });
                }}
              />
            </div>

            {/* eF */}
            <div className="px-2 text-xs text-gray-600 truncate" style={{ width: columnWidths.ef }}>
              <EditableCell 
                value={task.end ? task.end.substring(0, 10) : ''}
                displayValue={task.end ? format(parseISO(task.end), 'dd-MM-yyyy') : ''}
                type="date"
                onSave={(val) => {
                  if (!val) return;
                  let iso = val;
                  if (!iso.includes('T')) iso += 'T00:00:00.000Z'; // naive
                  // If we change end, recalculate duration
                  const newDuration = calculateEditedDuration(task.start, iso);
                  updateTask(task.id, { 
                    end: iso,
                    duration: newDuration,
                    importMetadata: { ...task.importMetadata, finishSource: 'maxima-user', durationSource: 'maxima-calculated' } 
                  });
                }}
              />
            </div>

            {/* Predecessors */}
            <div 
              className="px-2 text-xs text-gray-500 truncate font-mono" 
              style={{ width: columnWidths.predecessors }}
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
          </div>
          );
        })}

        {/* Add Task Row */}
        {onAddTask && (
          <div className="flex items-center h-[var(--row-height)] border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <button
              onClick={onAddTask}
              className="flex items-center gap-1.5 px-4 py-1 text-xs text-gray-400 hover:text-blue-600 transition-colors ml-[55px]"
            >
              <Plus size={14} />
              <span>Tarea</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
