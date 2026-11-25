'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { GanttProject, GanttTask } from '../../domain/models';
import { getProjectDateRange, buildTaskHierarchy } from '../../utils/ganttUtils';
import { scheduleProjectAfterTaskChange } from '../../domain/scheduling/schedulingEngine';
import { findDependentTasks, getDescendantIds } from '../../domain/taskUtils';
import { GanttColumnId } from '../../domain/columnDefinitions';
import { useColumnVisibility } from '../../hooks/useColumnVisibility';
import { GanttTable } from './GanttTable';
import { GanttTimeline } from './GanttTimeline';
import { ColumnSelectorButton } from './ColumnSelectorButton';

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

  // Column visibility & widths (centralized)
  const {
    visibleColumns,
    visibleColumnDefs,
    columnWidths,
    totalWidth,
    toggleColumn,
    isColumnVisible,
    resetToDefaults,
    resizeColumn,
  } = useColumnVisibility();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [tableWidth, setTableWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('maxima:gantt-table-width');
      if (saved) return parseInt(saved, 10);
    }
    return 600; // Default width
  });

  useEffect(() => {
    localStorage.setItem('maxima:gantt-table-width', tableWidth.toString());
  }, [tableWidth]);

  const handleResizeColumn = (colId: GanttColumnId, delta: number, startWidth: number) => {
    resizeColumn(colId, delta, startWidth);
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

  const handleDeleteTask = useCallback((taskId: string) => {
    if (!onDeleteTask) return;
    const success = onDeleteTask(taskId);
    if (success && selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  }, [onDeleteTask, selectedTaskId]);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);

  const requestDeleteTask = useCallback((taskId: string) => {
    if (!onDeleteTask) return;
    const descendants = getDescendantIds(project.tasks, taskId);
    const deletedIds = new Set([taskId, ...descendants]);
    const dependentTasks = findDependentTasks(project.tasks, deletedIds);

    if (descendants.length > 0 || dependentTasks.length > 0) {
      setDeleteConfirmTaskId(taskId);
    } else {
      handleDeleteTask(taskId);
    }
  }, [onDeleteTask, project.tasks, handleDeleteTask]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deleteConfirmTaskId) {
        setDeleteConfirmTaskId(null);
        return;
      }
      if (e.key !== 'Delete' || !selectedTaskId || deleteConfirmTaskId) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      requestDeleteTask(selectedTaskId);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, deleteConfirmTaskId, requestDeleteTask]);

  const deleteConfirmTask = deleteConfirmTaskId
    ? project.tasks.find(t => t.id === deleteConfirmTaskId) || null
    : null;
  const deleteConfirmDescendants = deleteConfirmTask
    ? getDescendantIds(project.tasks, deleteConfirmTask.id)
    : [];
  const deleteConfirmDependents = deleteConfirmTask
    ? findDependentTasks(project.tasks, new Set([deleteConfirmTask.id, ...deleteConfirmDescendants]))
    : [];

  const { start, end } = getProjectDateRange(project.tasks);
  const renderTasks = buildTaskHierarchy(project.tasks, expandedIds);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm m-4">
      {/* Column selector & task actions toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
        <div className="flex items-center gap-1">
          <ColumnSelectorButton
            visibleColumns={visibleColumns}
            onToggle={toggleColumn}
            onReset={resetToDefaults}
            tasks={project.tasks}
            resources={project.resources}
          />
          {onAddTask && (
            <>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <button
                onClick={handleAddTask}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50/60 rounded transition-colors"
                title="Agregar nueva tarea"
              >
                <Plus size={14} />
                <span>Nueva tarea</span>
              </button>
            </>
          )}
          {selectedTaskId && onDeleteTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                requestDeleteTask(selectedTaskId);
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Eliminar tarea seleccionada (Supr)"
            >
              <Trash2 size={14} />
              <span>Eliminar</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Main gantt area */}
      <div className="flex flex-1 overflow-hidden" onClick={() => setSelectedTaskId(null)}>
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
            visibleColumns={visibleColumns}
            visibleColumnDefs={visibleColumnDefs}
            columnWidths={columnWidths}
            onResizeColumn={handleResizeColumn}
            updateTask={handleTaskUpdate}
            updateTasks={updateTasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onAddTask={handleAddTask}
            onAddSubtask={handleAddSubtask}
            onDeleteTask={requestDeleteTask}
            onMoveTask={onMoveTask}
            onIndentTask={onIndentTask}
            onOutdentTask={onOutdentTask}
            canIndentTask={canIndentTask}
            editingTaskId={editingTaskId}
            onClearEditingTask={() => setEditingTaskId(null)}
            resources={project.resources}
            hoveredTaskId={hoveredTaskId}
            onHoverTask={setHoveredTaskId}
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
            hoveredTaskId={hoveredTaskId}
            onHoverTask={setHoveredTaskId}
          />
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmTask && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20"
          onClick={() => setDeleteConfirmTaskId(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-96 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 text-sm">Confirmar eliminación</h3>
              <button
                onClick={() => setDeleteConfirmTaskId(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-700">
                ¿Eliminar la tarea <span className="font-semibold">&ldquo;{deleteConfirmTask.name}&rdquo;</span>?
              </p>
              {deleteConfirmDescendants.length > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                  Contiene {deleteConfirmDescendants.length} subtarea{deleteConfirmDescendants.length > 1 ? 's' : ''} que también se eliminarán.
                </p>
              )}
              {deleteConfirmDependents.length > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                  {deleteConfirmDependents.length} tarea{deleteConfirmDependents.length > 1 ? 's' : ''} depende{deleteConfirmDependents.length === 1 ? '' : 'n'} de esta actividad.
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setDeleteConfirmTaskId(null)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-md font-medium text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const idToDelete = deleteConfirmTask.id;
                    setDeleteConfirmTaskId(null);
                    handleDeleteTask(idToDelete);
                  }}
                  className="px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded-md font-medium text-sm transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
