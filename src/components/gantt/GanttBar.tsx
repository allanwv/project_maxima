import { useState } from 'react';
import {
  RenderTask,
  calculateEditedDuration,
  formatCalendarIso,
  formatDateCompact,
  parseCalendarDate,
} from '../../utils/ganttUtils';
import { GanttTask } from '../../domain/models';
import { format, addDays } from 'date-fns';

interface GanttBarProps {
  task: RenderTask;
  left: number;
  width: number;
  cellWidth: number;
  startDate: Date;
  onUpdate: (taskId: string, updates: Partial<GanttTask>) => void;
  isSelected: boolean;
  onSelect: () => void;
}

export function GanttBar({ task, left, width, cellWidth, startDate, onUpdate, isSelected, onSelect }: GanttBarProps) {
  const [dragState, setDragState] = useState<{ type: 'move' | 'resizeLeft' | 'resizeRight' | null; deltaDays: number }>({ type: null, deltaDays: 0 });

  const handlePointerDown = (e: React.PointerEvent, type: 'move' | 'resizeLeft' | 'resizeRight') => {
    e.stopPropagation();
    onSelect();
    
    // Prevent drag on summary tasks for now
    if (task.hasChildren && type !== 'move') return; // well, user said NO direct drag/resize on summary.
    if (task.hasChildren) return; 

    // Milestones cannot be resized
    if (task.milestone && type !== 'move') return;

    e.preventDefault();
    const startX = e.clientX;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaDays = Math.round(deltaX / cellWidth);
      setDragState({ type, deltaDays });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      
      const finalDeltaX = upEvent.clientX - startX;
      const finalDeltaDays = Math.round(finalDeltaX / cellWidth);
      setDragState({ type: null, deltaDays: 0 });

      if (finalDeltaDays !== 0) {
        commitChange(type, finalDeltaDays);
      }
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  const commitChange = (type: 'move' | 'resizeLeft' | 'resizeRight', deltaDays: number) => {
    const sDate = parseCalendarDate(task.start);
    const eDate = parseCalendarDate(task.end);

    if (type === 'move') {
      const newStart = formatCalendarIso(addDays(sDate, deltaDays));
      const newEnd = formatCalendarIso(addDays(eDate, deltaDays));
      onUpdate(task.id, {
        start: newStart,
        end: newEnd,
        importMetadata: { ...task.importMetadata, startSource: 'maxima-user', finishSource: 'maxima-user' }
      });
    } else if (type === 'resizeRight') {
      const newEnd = addDays(eDate, deltaDays);
      if (newEnd >= sDate) {
        const endIso = formatCalendarIso(newEnd);
        const newDuration = calculateEditedDuration(task.start, endIso);
        onUpdate(task.id, {
          end: endIso,
          duration: newDuration,
          importMetadata: { ...task.importMetadata, finishSource: 'maxima-user', durationSource: 'maxima-calculated' }
        });
      }
    } else if (type === 'resizeLeft') {
      const newStart = addDays(sDate, deltaDays);
      if (newStart <= eDate) {
        const startIso = formatCalendarIso(newStart);
        const newDuration = calculateEditedDuration(startIso, task.end);
        onUpdate(task.id, {
          start: startIso,
          duration: newDuration,
          importMetadata: { ...task.importMetadata, startSource: 'maxima-user', durationSource: 'maxima-calculated' }
        });
      }
    }
  };

  // Calculate rendering coords including preview
  let renderLeft = left;
  let renderWidth = width;
  
  if (dragState.type === 'move') {
    renderLeft += dragState.deltaDays * cellWidth;
  } else if (dragState.type === 'resizeLeft') {
    const deltaPx = dragState.deltaDays * cellWidth;
    // Don't allow left handle to cross right handle (min 1 day width)
    const maxDelta = width - cellWidth;
    const boundedDelta = Math.min(deltaPx, maxDelta);
    renderLeft += boundedDelta;
    renderWidth -= boundedDelta;
  } else if (dragState.type === 'resizeRight') {
    const deltaPx = dragState.deltaDays * cellWidth;
    const minWidth = cellWidth;
    renderWidth = Math.max(minWidth, width + deltaPx);
  }

  // Formatting for preview tooltip
  const previewStart = addDays(parseCalendarDate(task.start), dragState.type === 'move' || dragState.type === 'resizeLeft' ? dragState.deltaDays : 0);
  const previewEnd = addDays(parseCalendarDate(task.end), dragState.type === 'move' || dragState.type === 'resizeRight' ? dragState.deltaDays : 0);

  const formatPreview = () => {
    return `${format(previewStart, 'dd MMM')} → ${format(previewEnd, 'dd MMM')}`;
  };

  const isPreviewing = dragState.type !== null && dragState.deltaDays !== 0;

  if (task.milestone) {
    return (
      <>
        <div 
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-purple-500 transform rotate-45 border-2 z-10 cursor-grab active:cursor-grabbing
            ${isSelected ? 'border-purple-700 shadow-md scale-110' : 'border-white shadow-sm'}
          `}
          style={{ left: `${renderLeft + (cellWidth/2) - 8}px` }}
          onPointerDown={(e) => handlePointerDown(e, 'move')}
          onClick={onSelect}
        />
        {isPreviewing && (
          <div 
            className="absolute z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap"
            style={{ left: `${renderLeft + (cellWidth/2)}px`, top: '-25px', transform: 'translateX(-50%)' }}
          >
            {format(previewStart, 'dd MMM yyyy')}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-md overflow-visible transition-shadow group/bar
          ${task.hasChildren ? 'bg-slate-200' : 'bg-blue-100 border'}
          ${isSelected ? (task.hasChildren ? 'ring-2 ring-slate-400 ring-offset-1' : 'border-blue-400 shadow-md ring-1 ring-blue-400') : (task.hasChildren ? 'shadow-sm' : 'border-blue-200 shadow-sm')}
          ${task.hasChildren ? '' : 'cursor-grab active:cursor-grabbing'}
        `}
        style={{ left: `${renderLeft}px`, width: `${renderWidth}px` }}
        onPointerDown={task.hasChildren ? undefined : (e) => handlePointerDown(e, 'move')}
        onClick={onSelect}
      >
        {/* Progress Fill */}
        <div 
          className={`h-full rounded-sm ${task.hasChildren ? 'bg-slate-600' : 'bg-blue-500'}`}
          style={{ width: `${task.progress}%` }}
        />
        
        {/* Summary endpoints styling (the little drops) */}
        {task.hasChildren && (
          <>
            <div className="absolute -bottom-1.5 left-0 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-600" />
            <div className="absolute -bottom-1.5 right-0 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-600" />
          </>
        )}

        {/* Resize Handles (only for normal tasks) */}
        {!task.hasChildren && (
          <>
            {/* Left Handle */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-2 -translate-x-1/2 cursor-col-resize z-20 opacity-0 group-hover/bar:opacity-100"
              onPointerDown={(e) => handlePointerDown(e, 'resizeLeft')}
            />
            {/* Right Handle */}
            <div 
              className="absolute right-0 top-0 bottom-0 w-2 translate-x-1/2 cursor-col-resize z-20 opacity-0 group-hover/bar:opacity-100"
              onPointerDown={(e) => handlePointerDown(e, 'resizeRight')}
            />
          </>
        )}

        {/* Hover Tooltip (Rich) */}
        {!isPreviewing && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/bar:block z-50 pointer-events-none">
            <div className="bg-white border border-gray-200 shadow-xl rounded-md p-3 text-xs w-48 text-gray-700">
              <div className="font-bold text-gray-900 mb-1.5 break-words">{task.name}</div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Inicio:</span>
                <span>{formatDateCompact(task.start)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Fin:</span>
                <span>{formatDateCompact(task.end)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Duración:</span>
                <span>{(Math.round(task.duration * 1000)/1000).toString().replace('.', ',')} días</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Avance:</span>
                <span>{task.progress}%</span>
              </div>
              {task.resourceIds && task.resourceIds.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                  <span className="text-gray-500 block mb-0.5">Responsable:</span>
                  <span className="font-medium text-blue-700 block truncate">{task.resourceIds.join(', ')}</span>
                </div>
              )}
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white drop-shadow-sm" />
          </div>
        )}
      </div>

      {/* Floating Preview Tooltip during drag */}
      {isPreviewing && (
        <div 
          className="absolute z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap"
          style={{ left: `${renderLeft + renderWidth / 2}px`, top: '-25px', transform: 'translateX(-50%)' }}
        >
          {formatPreview()}
        </div>
      )}
    </>
  );
}
