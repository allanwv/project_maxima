import { ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { RenderTask, calculateEditedEnd, calculateEditedDuration } from '../../utils/ganttUtils';
import { ColumnWidths } from './GanttChart';
import { EditableCell } from './EditableCell';
import { GanttTask } from '../../domain/models';

interface GanttTableProps {
  tasks: RenderTask[];
  onToggleExpand: (taskId: string) => void;
  expandedIds: Set<string>;
  columnWidths: ColumnWidths;
  onResizeColumn: (col: keyof ColumnWidths, delta: number, startWidth: number) => void;
  updateTask: (taskId: string, updates: Partial<GanttTask>) => void;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
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

export function GanttTable({ tasks, onToggleExpand, expandedIds, columnWidths, onResizeColumn, updateTask, selectedTaskId, onSelectTask }: GanttTableProps) {
  const visibleTasks = tasks.filter(t => t.isVisible);

  const totalWidth = columnWidths.name + columnWidths.progress + columnWidths.duration + columnWidths.es + columnWidths.ef;

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
        </div>
      </div>

      {/* Body */}
      <div className="flex-1">
        {visibleTasks.map((task) => {
          const isSelected = selectedTaskId === task.id;
          return (
          <div
            key={task.id}
            onClick={() => onSelectTask(task.id)}
            className={`flex items-center h-[var(--row-height)] border-b border-gray-100 transition-colors group cursor-pointer
              ${isSelected ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-gray-50'}
            `}
          >
            {/* Name */}
            <div 
              className="flex items-center overflow-hidden px-4"
              style={{ width: columnWidths.name, paddingLeft: `calc(1rem + ${task.depth * 1.5}rem)` }}
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
              <span className="truncate text-sm font-medium text-gray-800" title={task.name}>
                {task.name}
              </span>
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
          </div>
          );
        })}
      </div>
    </div>
  );
}
