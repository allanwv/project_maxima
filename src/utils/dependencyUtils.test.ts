import { describe, it, expect } from 'vitest';
import { parseDependencyExpression, wouldCreateDependencyCycle } from './dependencyUtils';
import { RenderTask } from './ganttUtils';
import { GanttTask, GanttDependency } from '../domain/models';

describe('dependencyUtils', () => {
  const mockTasks: RenderTask[] = [
    { id: 'u1', displayId: 1, name: 'T1', start: '', end: '', duration: 1, progress: 0, milestone: false, dependencies: [], resourceIds: [], depth: 0, hasChildren: false, isVisible: true },
    { id: 'u2', displayId: 2, name: 'T2', start: '', end: '', duration: 1, progress: 0, milestone: false, dependencies: [], resourceIds: [], depth: 0, hasChildren: false, isVisible: true },
    { id: 'u3', displayId: 3, name: 'T3', start: '', end: '', duration: 1, progress: 0, milestone: false, dependencies: [], resourceIds: [], depth: 0, hasChildren: false, isVisible: true },
    { id: 'u4', displayId: 4, name: 'T4', start: '', end: '', duration: 1, progress: 0, milestone: false, dependencies: [], resourceIds: [], depth: 0, hasChildren: false, isVisible: true },
    { id: 'u8', displayId: 8, name: 'T8', start: '', end: '', duration: 1, progress: 0, milestone: false, dependencies: [], resourceIds: [], depth: 0, hasChildren: false, isVisible: true },
  ];

  describe('parseDependencyExpression', () => {
    it('parses "4" as FS to displayId 4', () => {
      const res = parseDependencyExpression('4', mockTasks, 'u1') as GanttDependency[];
      expect(res).toHaveLength(1);
      expect(res[0]).toEqual({ taskId: 'u4', type: 'FS', lag: 0 });
    });

    it('parses "4SS" as SS to displayId 4', () => {
      const res = parseDependencyExpression('4SS', mockTasks, 'u1') as GanttDependency[];
      expect(res[0]).toEqual({ taskId: 'u4', type: 'SS', lag: 0 });
    });

    it('parses "4FS+2d" as FS +2 to displayId 4', () => {
      const res = parseDependencyExpression('4FS+2d', mockTasks, 'u1') as GanttDependency[];
      expect(res[0]).toEqual({ taskId: 'u4', type: 'FS', lag: 2 });
    });

    it('parses "4FS-2d" as FS -2 to displayId 4', () => {
      const res = parseDependencyExpression('4FS-2d', mockTasks, 'u1') as GanttDependency[];
      expect(res[0]).toEqual({ taskId: 'u4', type: 'FS', lag: -2 });
    });
    
    it('parses "4FS+2" as FS +2 to displayId 4 without the d suffix', () => {
      const res = parseDependencyExpression('4FS+2', mockTasks, 'u1') as GanttDependency[];
      expect(res[0]).toEqual({ taskId: 'u4', type: 'FS', lag: 2 });
    });

    it('parses multiple "4FS, 8SS"', () => {
      const res = parseDependencyExpression('4FS, 8SS', mockTasks, 'u1') as GanttDependency[];
      expect(res).toHaveLength(2);
      expect(res[0]).toEqual({ taskId: 'u4', type: 'FS', lag: 0 });
      expect(res[1]).toEqual({ taskId: 'u8', type: 'SS', lag: 0 });
    });

    it('returns error for nonexistent ID', () => {
      const res = parseDependencyExpression('99', mockTasks, 'u1');
      expect(res).toHaveProperty('message');
      expect((res as any).message).toContain('no existe');
    });

    it('returns error for self dependency', () => {
      const res = parseDependencyExpression('4FS', mockTasks, 'u4');
      expect(res).toHaveProperty('message');
      expect((res as any).message).toContain('depender de sí misma');
    });

    it('returns error for duplicate dependency', () => {
      const res = parseDependencyExpression('4FS, 4SS', mockTasks, 'u1');
      expect(res).toHaveProperty('message');
      expect((res as any).message).toContain('duplicada');
    });
  });

  describe('wouldCreateDependencyCycle', () => {
    it('detects cycle A -> B -> C -> A', () => {
      const tasksWithDeps: GanttTask[] = [
        { id: 'u1', name: 'A', start: '', end: '', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 'u2', type: 'FS' }] }, // A -> B
        { id: 'u2', name: 'B', start: '', end: '', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 'u3', type: 'FS' }] }, // B -> C
        { id: 'u3', name: 'C', start: '', end: '', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
      ];

      // If we try to make C -> A, it should create a cycle
      const newDeps: GanttDependency[] = [{ taskId: 'u1', type: 'FS' }];
      expect(wouldCreateDependencyCycle(tasksWithDeps, 'u3', newDeps)).toBe(true);
    });

    it('allows valid chain A -> B -> C', () => {
      const tasksWithDeps: GanttTask[] = [
        { id: 'u1', name: 'A', start: '', end: '', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
        { id: 'u2', name: 'B', start: '', end: '', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 'u1', type: 'FS' }] }, // B -> A
        { id: 'u3', name: 'C', start: '', end: '', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
      ];

      // If we make C -> B, valid
      const newDeps: GanttDependency[] = [{ taskId: 'u2', type: 'FS' }];
      expect(wouldCreateDependencyCycle(tasksWithDeps, 'u3', newDeps)).toBe(false);
    });
  });
});
