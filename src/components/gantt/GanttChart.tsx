'use client';

import { useState, useRef, useEffect } from 'react';
import { GanttProject, GanttTask } from '../../domain/models';
import { getProjectDateRange, buildTaskHierarchy } from '../../utils/ganttUtils';
import { GanttTable } from './GanttTable';
import { GanttTimeline } from './GanttTimeline';

export const DEFAULT_COLUMN_WIDTHS = { name: 280, progress: 65, duration: 105, es: 110, ef: 110 };
export const MIN_COLUMN_WIDTHS = { name: 160, progress: 50, duration: 85, es: 85, ef: 85 };
export type ColumnWidths = typeof DEFAULT_COLUMN_WIDTHS;

interface GanttChartProps {
  project: GanttProject;
  updateTask: (taskId: string, updates: Partial<GanttTask>) => void;
  zoomLevel?: number;
}

export function GanttChart({ project, updateTask, zoomLevel = 32 }: GanttChartProps) {
  // State for expanded tasks
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(project.tasks.filter(t => t.isExpanded).map(t => t.id))
  );

  // Sync scrolling refs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Column widths state
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('maxima:gantt-column-widths');
      if (saved) {
        try {
          return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
        } catch (e) {}
      }
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('maxima:gantt-column-widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  const handleResizeColumn = (col: keyof ColumnWidths, delta: number, startWidth: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [col]: Math.max(MIN_COLUMN_WIDTHS[col], startWidth + delta)
    }));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Only sync vertical scroll
    const target = e.currentTarget;
    if (target === tableContainerRef.current && timelineContainerRef.current) {
      timelineContainerRef.current.scrollTop = target.scrollTop;
    } else if (target === timelineContainerRef.current && tableContainerRef.current) {
      tableContainerRef.current.scrollTop = target.scrollTop;
    }
  };

  const toggleExpand = (taskId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const { start, end } = getProjectDateRange(project.tasks);
  const renderTasks = buildTaskHierarchy(project.tasks, expandedIds);

  return (
    <div className="flex flex-1 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm m-4">
      {/* Left Table */}
      <div 
        ref={tableContainerRef}
        onScroll={handleScroll}
        className="flex-shrink-0 overflow-y-auto overflow-x-hidden scrollbar-hide"
      >
        <GanttTable 
          tasks={renderTasks} 
          onToggleExpand={toggleExpand} 
          expandedIds={expandedIds}
          columnWidths={columnWidths}
          onResizeColumn={handleResizeColumn}
          updateTask={updateTask}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />
      </div>

      {/* Right Timeline */}
      <div 
        ref={timelineContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto scrollbar-gantt relative"
      >
        <GanttTimeline 
          tasks={renderTasks} 
          startDate={start} 
          endDate={end}
          updateTask={updateTask}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          zoomLevel={zoomLevel}
        />
      </div>
    </div>
  );
}
