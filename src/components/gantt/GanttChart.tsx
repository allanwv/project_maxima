'use client';

import { useState, useRef, useEffect } from 'react';
import { GanttProject, GanttTask } from '../../domain/models';
import { getProjectDateRange, buildTaskHierarchy } from '../../utils/ganttUtils';
import { scheduleProjectAfterTaskChange } from '../../domain/scheduling/schedulingEngine';
import { GanttTable } from './GanttTable';
import { GanttTimeline } from './GanttTimeline';

export const DEFAULT_COLUMN_WIDTHS = { id: 55, name: 280, progress: 65, duration: 105, es: 110, ef: 110, predecessors: 120 };
export const MIN_COLUMN_WIDTHS = { id: 45, name: 160, progress: 50, duration: 85, es: 85, ef: 85, predecessors: 90 };
export type ColumnWidths = typeof DEFAULT_COLUMN_WIDTHS;

interface GanttChartProps {
  project: GanttProject;
  updateTask: (taskId: string, updates: Partial<GanttTask>) => void;
  updateTasks: (newTasks: GanttTask[]) => void;
  zoomLevel?: number;
  onAddTask?: () => string;
  onAddSubtask?: (parentId: string) => string;
  onDeleteTask?: (taskId: string) => boolean;
  onMoveTask?: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  onIndentTask?: (taskId: string) => void;
  onOutdentTask?: (taskId: string) => void;
  canIndentTask?: (taskId: string) => boolean;
}

export function GanttChart({ 
  project, updateTask, updateTasks, zoomLevel = 32, 
  onAddTask, onAddSubtask, onDeleteTask,
  onMoveTask, onIndentTask, onOutdentTask, canIndentTask
}: GanttChartProps) {
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

  const [tableWidth, setTableWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('maxima:gantt-table-width');
      if (saved) return parseInt(saved, 10);
    }
    return 600; // Default width
  });

  useEffect(() => {
    localStorage.setItem('maxima:gantt-column-widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  useEffect(() => {
    localStorage.setItem('maxima:gantt-table-width', tableWidth.toString());
  }, [tableWidth]);

  const handleResizeColumn = (col: keyof ColumnWidths, delta: number, startWidth: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [col]: Math.max(MIN_COLUMN_WIDTHS[col], startWidth + delta)
    }));
  };

  const handleSplitterPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = tableWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      setTableWidth(Math.max(200, startWidth + delta));
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
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

  const handleTaskUpdate = (taskId: string, updates: Partial<GanttTask>) => {
    // 1. Create a clone of the project tasks and apply the change
    const newTasks = project.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    
    // 2. Run the scheduling engine to propagate dependencies
    const options: any = {};
    if (updates.start !== undefined || updates.end !== undefined) {
      options.changedTaskUid = taskId;
    }
    if (updates.dependencies !== undefined) {
      options.evaluateTaskUids = [taskId];
    }
    
    // If it's just a progress or name change, options is empty and scheduling engine won't move dates.
    const scheduledTasks = scheduleProjectAfterTaskChange(newTasks, options);
    
    // 3. Commit all changes at once
    updateTasks(scheduledTasks);
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

  const handleAddTask = () => {
    if (!onAddTask) return;
    const newId = onAddTask();
    setSelectedTaskId(newId);
    // Set editingTaskId so GanttTable can auto-focus the name
    setEditingTaskId(newId);
  };

  const handleAddSubtask = (parentId: string) => {
    if (!onAddSubtask) return;
    const newId = onAddSubtask(parentId);
    // Auto-expand parent so the subtask is visible
    setExpandedIds(prev => new Set([...prev, parentId]));
    setSelectedTaskId(newId);
    setEditingTaskId(newId);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!onDeleteTask) return;
    const success = onDeleteTask(taskId);
    if (success && selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  };

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const { start, end } = getProjectDateRange(project.tasks);
  const renderTasks = buildTaskHierarchy(project.tasks, expandedIds);

  return (
    <div className="flex flex-1 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm m-4">
      {/* Left Table */}
      <div 
        ref={tableContainerRef}
        onScroll={handleScroll}
        className="flex-shrink-0 overflow-auto relative scrollbar-gantt"
        style={{ width: tableWidth }}
      >
        <GanttTable 
          tasks={renderTasks} 
          onToggleExpand={toggleExpand} 
          expandedIds={expandedIds}
          columnWidths={columnWidths}
          onResizeColumn={handleResizeColumn}
          updateTask={handleTaskUpdate}
          updateTasks={updateTasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          onAddTask={handleAddTask}
          onAddSubtask={handleAddSubtask}
          onDeleteTask={handleDeleteTask}
          onMoveTask={onMoveTask}
          onIndentTask={onIndentTask}
          onOutdentTask={onOutdentTask}
          canIndentTask={canIndentTask}
          editingTaskId={editingTaskId}
          onClearEditingTask={() => setEditingTaskId(null)}
          allTasks={project.tasks}
        />
      </div>

      {/* Splitter */}
      <div 
        onPointerDown={handleSplitterPointerDown}
        className="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize z-30 flex-shrink-0 transition-colors relative"
      >
        {/* Invisible wider hit area for easier grabbing */}
        <div className="absolute inset-y-0 -left-1 -right-1" />
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
          updateTask={handleTaskUpdate}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          zoomLevel={zoomLevel}
        />
      </div>
    </div>
  );
}
