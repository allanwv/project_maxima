import { RenderTask, getDaysBetween } from '../../utils/ganttUtils';
import { differenceInDays, format, parseISO, startOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { GanttTask } from '../../domain/models';
import { GanttBar } from './GanttBar';

interface GanttTimelineProps {
  tasks: RenderTask[];
  startDate: Date;
  endDate: Date;
  updateTask: (taskId: string, updates: Partial<GanttTask>) => void;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  zoomLevel?: number;
}

export function GanttTimeline({ tasks, startDate, endDate, updateTask, selectedTaskId, onSelectTask, zoomLevel = 32 }: GanttTimelineProps) {
  const visibleTasks = tasks.filter(t => t.isVisible);
  const days = getDaysBetween(startDate, endDate);
  const cellWidth = zoomLevel; 
  
  const today = startOfDay(new Date());

  return (
    <div className="relative" style={{ width: days.length * cellWidth, minWidth: '100%' }}>
      {/* Header */}
      <div className="h-[var(--header-height)] border-b border-gray-200 bg-gray-50/80 backdrop-blur-sm sticky top-0 z-20 flex flex-col">
        {/* Months Row (simplified: just grouping by month roughly or just showing the month at the start of each day if it changes, 
            for simplicity let's just show Days directly with Month above) */}
        <div className="flex-1 flex border-b border-gray-100">
          {days.map((day, i) => {
            // Depending on zoom level, we want to group month labels differently to prevent crowding
            let isFirstLabel = false;
            
            if (cellWidth >= 16) {
              // At week/day scale, show month on the 1st
              isFirstLabel = day.getDate() === 1 || i === 0;
            } else {
              // At month scale, show month only if it's January or every few months depending on space, or just keep it simple: 1st of month
              isFirstLabel = day.getDate() === 1 || i === 0;
            }

            return (
              <div key={`m-${i}`} className="flex-none relative h-full" style={{ width: cellWidth }}>
                {isFirstLabel && (
                  <span className={`absolute left-1 top-1 font-semibold text-gray-600 capitalize ${cellWidth < 12 ? 'text-[10px]' : 'text-xs'}`}>
                    {cellWidth < 8 ? format(day, 'MMM', { locale: es }) : format(day, 'MMMM yyyy', { locale: es })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* Days Row */}
        <div className="flex-1 flex">
          {days.map((day, i) => {
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const isToday = isSameDay(day, today);
            
            // Only render day text if cell width allows it (e.g. >= 16px)
            const showDayText = cellWidth >= 16;

            return (
              <div
                key={`d-${i}`}
                className={`flex-none flex items-center justify-center border-r border-gray-100 text-gray-500
                  ${isWeekend ? 'bg-gray-100/50' : ''}
                  ${isToday ? 'font-bold text-blue-600 bg-blue-50/50' : ''}
                  ${!showDayText ? 'text-transparent' : 'text-xs'}
                `}
                style={{ width: cellWidth }}
                title={format(day, 'dd MMMM yyyy', { locale: es })}
              >
                {showDayText && format(day, 'd')}
              </div>
            );
          })}
        </div>
      </div>

      {/* Body / Grid */}
      <div className="relative">
        {/* Background Grid */}
        <div className="absolute inset-0 flex pointer-events-none">
          {days.map((day, i) => {
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const isToday = isSameDay(day, today);
            return (
              <div
                key={`bg-${i}`}
                className={`flex-none border-r border-gray-100/50 h-full
                  ${isWeekend ? 'bg-gray-50/50' : ''}
                  ${isToday ? 'bg-blue-50/30' : ''}
                `}
                style={{ width: cellWidth }}
              >
                {isToday && (
                  <div className="w-px h-full bg-blue-400 mx-auto opacity-50" />
                )}
              </div>
            );
          })}
        </div>

        {/* Dependencies Overlay */}
        <svg 
          className="absolute inset-0 pointer-events-none z-10" 
          style={{ width: days.length * cellWidth, height: visibleTasks.length * 40 }}
        >
          {visibleTasks.map((task, childIndex) => {
            if (!task.dependencies || task.dependencies.length === 0) return null;
            
            return task.dependencies.map(dep => {
              const parentIndex = visibleTasks.findIndex(t => t.id === dep.taskId);
              if (parentIndex === -1) return null; // Parent not visible (e.g. collapsed)
              
              const parent = visibleTasks[parentIndex];
              
              const pStartOffset = differenceInDays(startOfDay(parseISO(parent.start)), startOfDay(startDate));
              const pDuration = differenceInDays(startOfDay(parseISO(parent.end)), startOfDay(parseISO(parent.start))) + 1;
              const pLeft = pStartOffset * cellWidth;
              const pWidth = pDuration * cellWidth;
              
              const cStartOffset = differenceInDays(startOfDay(parseISO(task.start)), startOfDay(startDate));
              const cDuration = differenceInDays(startOfDay(parseISO(task.end)), startOfDay(parseISO(task.start))) + 1;
              const cLeft = cStartOffset * cellWidth;
              const cWidth = cDuration * cellWidth;
              
              const rowHeight = 40;
              const halfRow = rowHeight / 2;
              
              let x1=0, y1=0, x2=0, y2=0;
              
              // FS is default and most common
              if (dep.type === 'FS' || !dep.type) {
                 x1 = pLeft + pWidth; // right edge of parent
                 y1 = (parentIndex * rowHeight) + halfRow;
                 x2 = cLeft; // left edge of child
                 y2 = (childIndex * rowHeight) + halfRow;
              } else if (dep.type === 'SS') {
                 x1 = pLeft;
                 y1 = (parentIndex * rowHeight) + halfRow;
                 x2 = cLeft;
                 y2 = (childIndex * rowHeight) + halfRow;
              } else if (dep.type === 'FF') {
                 x1 = pLeft + pWidth;
                 y1 = (parentIndex * rowHeight) + halfRow;
                 x2 = cLeft + cWidth;
                 y2 = (childIndex * rowHeight) + halfRow;
              } else if (dep.type === 'SF') {
                 x1 = pLeft;
                 y1 = (parentIndex * rowHeight) + halfRow;
                 x2 = cLeft + cWidth;
                 y2 = (childIndex * rowHeight) + halfRow;
              }

              // Simple elbow path
              let path = '';
              const isChildBelow = childIndex > parentIndex;
              const yOffset = isChildBelow ? 10 : -10;

              if (dep.type === 'FS' || !dep.type) {
                if (x1 + 10 < x2) {
                  // Direct forward
                  path = `M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x1 + 10} ${y2} L ${x2} ${y2}`;
                } else {
                  // Loop back
                  path = `M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x1 + 10} ${y1 + yOffset} L ${x2 - 10} ${y1 + yOffset} L ${x2 - 10} ${y2} L ${x2} ${y2}`;
                }
              } else {
                // Simplified for others
                path = `M ${x1} ${y1} L ${x1} ${y1 + yOffset} L ${x2} ${y1 + yOffset} L ${x2} ${y2}`;
              }

              return (
                <g key={`${task.id}-${dep.taskId}`}>
                  <path 
                    d={path} 
                    fill="none" 
                    stroke="#FF9800" 
                    strokeWidth="1.5" 
                    strokeOpacity="0.6"
                  />
                  {/* Arrow head */}
                  {(dep.type === 'FS' || !dep.type || dep.type === 'SS') ? (
                    <polygon 
                      points={`${x2-4},${y2-4} ${x2+2},${y2} ${x2-4},${y2+4}`} 
                      fill="#FF9800"
                      fillOpacity="0.8"
                    />
                  ) : (
                    <polygon 
                      points={`${x2+4},${y2-4} ${x2-2},${y2} ${x2+4},${y2+4}`} 
                      fill="#FF9800"
                      fillOpacity="0.8"
                    />
                  )}
                </g>
              );
            });
          })}
        </svg>

        {/* Task Bars */}
        <div className="relative z-20 flex flex-col">
          {visibleTasks.map(task => {
            const taskStart = startOfDay(parseISO(task.start));
            const taskEnd = startOfDay(parseISO(task.end));
            
            // Calculate position
            const offsetDays = differenceInDays(taskStart, startOfDay(startDate));
            const durationDays = differenceInDays(taskEnd, taskStart) + 1; // +1 to include the end day fully
            
            const left = offsetDays * cellWidth;
            const width = durationDays * cellWidth;
            
            const isSelected = selectedTaskId === task.id;
            return (
              <div
                key={task.id}
                className={`relative flex items-center border-b border-gray-100/0 transition-colors group
                  ${isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50/40'}
                `}
                style={{ height: 'var(--row-height)' }}
              >
                {/* GanttBar component */}
                <GanttBar 
                  task={task}
                  left={left}
                  width={width}
                  cellWidth={cellWidth}
                  startDate={startDate}
                  onUpdate={updateTask}
                  isSelected={selectedTaskId === task.id}
                  onSelect={() => onSelectTask(task.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
