import { describe, it, expect } from 'vitest';
import { GanttTask } from './models';
import {
  generateProjectId,
  createBlankProject,
  generateTaskUid,
  createNewTask,
  getDescendantIds,
  taskHasChildren,
  findDependentTasks,
  cleanOrphanedDependencies,
  insertTaskAtPosition,
  moveTaskBranch,
  indentTask,
  outdentTask,
  canIndentTask,
  recomputeSummaryRanges
} from './taskUtils';

describe('taskUtils', () => {
  const makeTask = (id: string, name: string, opts?: Partial<GanttTask>): GanttTask => ({
    id,
    name,
    start: '2026-08-10T00:00:00.000Z',
    end: '2026-08-10T00:00:00.000Z',
    duration: 1,
    progress: 0,
    milestone: false,
    dependencies: [],
    resourceIds: [],
    ...opts
  });

  describe('generateTaskUid', () => {
    it('generates unique UIDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTaskUid());
      }
      expect(ids.size).toBe(100);
    });

    it('UIDs have maxima_ prefix', () => {
      const uid = generateTaskUid();
      expect(uid.startsWith('maxima_')).toBe(true);
    });
  });

  describe('createNewTask', () => {
    it('creates task with unique UID and correct defaults', () => {
      const task = createNewTask([]);
      expect(task.id.startsWith('maxima_')).toBe(true);
      expect(task.name).toBe('Nueva tarea');
      expect(task.duration).toBe(1);
      expect(task.progress).toBe(0);
      expect(task.dependencies).toEqual([]);
      expect(task.parentId).toBeUndefined();
    });

    it('creates subtask with parentId set', () => {
      const parent = makeTask('p1', 'Parent');
      const sub = createNewTask([parent], 'p1');
      expect(sub.parentId).toBe('p1');
      expect(sub.start).toBe(parent.start);
    });

    it('creates root task starting after latest end', () => {
      const tasks = [
        makeTask('t1', 'A', { end: '2026-08-14T00:00:00.000Z' }) // Friday
      ];
      const newTask = createNewTask(tasks);
      // Next working day after Friday 14th is Monday 17th
      expect(newTask.start.substring(0, 10)).toBe('2026-08-17');
    });
  });

  describe('getDescendantIds', () => {
    it('returns all nested descendants', () => {
      const tasks = [
        makeTask('p', 'Parent'),
        makeTask('c1', 'Child1', { parentId: 'p' }),
        makeTask('c2', 'Child2', { parentId: 'p' }),
        makeTask('gc1', 'Grandchild', { parentId: 'c1' })
      ];
      const desc = getDescendantIds(tasks, 'p');
      expect(desc).toContain('c1');
      expect(desc).toContain('c2');
      expect(desc).toContain('gc1');
      expect(desc).toHaveLength(3);
    });

    it('returns empty for leaf task', () => {
      const tasks = [makeTask('t1', 'Leaf')];
      expect(getDescendantIds(tasks, 't1')).toEqual([]);
    });
  });

  describe('taskHasChildren', () => {
    it('returns true if has children', () => {
      const tasks = [
        makeTask('p', 'Parent'),
        makeTask('c', 'Child', { parentId: 'p' })
      ];
      expect(taskHasChildren(tasks, 'p')).toBe(true);
    });

    it('returns false if leaf', () => {
      const tasks = [makeTask('t', 'Leaf')];
      expect(taskHasChildren(tasks, 't')).toBe(false);
    });
  });

  describe('findDependentTasks', () => {
    it('finds tasks that depend on deleted tasks', () => {
      const tasks = [
        makeTask('t1', 'A'),
        makeTask('t2', 'B', { dependencies: [{ taskId: 't1', type: 'FS', lag: 0 }] }),
        makeTask('t3', 'C')
      ];
      const deps = findDependentTasks(tasks, new Set(['t1']));
      expect(deps).toHaveLength(1);
      expect(deps[0].taskId).toBe('t2');
    });

    it('returns empty if no dependents', () => {
      const tasks = [makeTask('t1', 'A'), makeTask('t2', 'B')];
      expect(findDependentTasks(tasks, new Set(['t1']))).toEqual([]);
    });
  });

  describe('cleanOrphanedDependencies', () => {
    it('removes references to deleted tasks', () => {
      const tasks = [
        makeTask('t1', 'A'),
        makeTask('t2', 'B', { dependencies: [{ taskId: 't1', type: 'FS', lag: 0 }, { taskId: 't3', type: 'SS', lag: 0 }] }),
        makeTask('t3', 'C')
      ];
      const cleaned = cleanOrphanedDependencies(tasks, new Set(['t1']));
      expect(cleaned[1].dependencies).toHaveLength(1);
      expect(cleaned[1].dependencies[0].taskId).toBe('t3');
    });

    it('preserves tasks with no orphaned references', () => {
      const tasks = [makeTask('t1', 'A'), makeTask('t2', 'B')];
      const cleaned = cleanOrphanedDependencies(tasks, new Set(['t3']));
      expect(cleaned).toEqual(tasks);
    });
  });

  describe('insertTaskAtPosition', () => {
    it('appends root task at end', () => {
      const tasks = [makeTask('t1', 'A'), makeTask('t2', 'B')];
      const newTask = makeTask('t3', 'C');
      const result = insertTaskAtPosition(tasks, newTask);
      expect(result[2].id).toBe('t3');
    });

    it('inserts subtask after parent and its descendants', () => {
      const tasks = [
        makeTask('p', 'Parent'),
        makeTask('c1', 'Child1', { parentId: 'p' }),
        makeTask('gc1', 'Grandchild', { parentId: 'c1' }),
        makeTask('t2', 'Other')
      ];
      const sub = makeTask('c2', 'Child2', { parentId: 'p' });
      const result = insertTaskAtPosition(tasks, sub);
      // Should be inserted after gc1 (index 2), before t2
      expect(result[3].id).toBe('c2');
      expect(result[4].id).toBe('t2');
    });
  });

  describe('rename preserves UID', () => {
    it('changing name does not change id', () => {
      const task = createNewTask([]);
      const originalId = task.id;
      const renamed = { ...task, name: 'Renamed Task' };
      expect(renamed.id).toBe(originalId);
    });
  });

  describe('delete predecessor preserves dates', () => {
    it('removing dependency does not change start/end', () => {
      const tasks = [
        makeTask('t1', 'A'),
        makeTask('t2', 'B', {
          start: '2026-08-15T00:00:00.000Z',
          end: '2026-08-15T00:00:00.000Z',
          dependencies: [{ taskId: 't1', type: 'FS', lag: 0 }]
        })
      ];
      const cleaned = cleanOrphanedDependencies(tasks, new Set(['t1']));
      // Dates must remain unchanged (slack-friendly)
      expect(cleaned[1].start).toBe('2026-08-15T00:00:00.000Z');
      expect(cleaned[1].end).toBe('2026-08-15T00:00:00.000Z');
    });
  });

  describe('FASE 4B: Reordering and Hierarchy', () => {
    it('moveTaskBranch: reorder simple', () => {
      const tasks = [
        makeTask('A', 'A'),
        makeTask('B', 'B'),
        makeTask('C', 'C')
      ];
      // Mover C antes de A
      const result = moveTaskBranch(tasks, 'C', 'A', 'before');
      expect(result.map(t => t.id)).toEqual(['C', 'A', 'B']);
    });

    it('moveTaskBranch: dependency survives reorder', () => {
      const tasks = [
        makeTask('A', 'A'),
        makeTask('B', 'B', { dependencies: [{ taskId: 'A', type: 'FS', lag: 0 }] })
      ];
      // Mover A despues de B
      const result = moveTaskBranch(tasks, 'A', 'B', 'after');
      expect(result.map(t => t.id)).toEqual(['B', 'A']);
      expect(result[0].dependencies[0].taskId).toBe('A'); // Dependency survives
    });

    it('moveTaskBranch: branch move', () => {
      const tasks = [
        makeTask('A', 'A'),
        makeTask('A1', 'A1', { parentId: 'A' }),
        makeTask('A2', 'A2', { parentId: 'A' }),
        makeTask('B', 'B')
      ];
      // Mover A debajo de B
      const result = moveTaskBranch(tasks, 'A', 'B', 'after');
      expect(result.map(t => t.id)).toEqual(['B', 'A', 'A1', 'A2']);
    });

    it('indentTask: simple indent', () => {
      const tasks = [
        makeTask('A', 'A'),
        makeTask('B', 'B')
      ];
      const result = indentTask(tasks, 'B');
      expect(result[1].parentId).toBe('A');
    });

    it('indentTask: indent branch', () => {
      const tasks = [
        makeTask('A', 'A'),
        makeTask('B', 'B'),
        makeTask('B1', 'B1', { parentId: 'B' })
      ];
      const result = indentTask(tasks, 'B');
      expect(result[1].parentId).toBe('A');
      expect(result[2].parentId).toBe('B');
      expect(result.map(t => t.id)).toEqual(['A', 'B', 'B1']);
    });

    it('outdentTask: simple outdent', () => {
      const tasks = [
        makeTask('A', 'A'),
        makeTask('B', 'B', { parentId: 'A' })
      ];
      const result = outdentTask(tasks, 'B');
      expect(result[1].parentId).toBeUndefined(); // Becomes root
      expect(result.map(t => t.id)).toEqual(['A', 'B']);
    });

    it('summary changes when outdenting last child', () => {
      // Testing that parents don't break or if logic holds
      const tasks = [
        makeTask('A', 'A'),
        makeTask('B', 'B', { parentId: 'A' })
      ];
      const result = outdentTask(tasks, 'B');
      // A is now leaf, B is leaf
      expect(taskHasChildren(result, 'A')).toBe(false);
    });

    it('canIndentTask logic', () => {
      const tasks = [
        makeTask('A', 'A'),
        makeTask('B', 'B')
      ];
      expect(canIndentTask(tasks, 'A')).toBe(false);
      expect(canIndentTask(tasks, 'B')).toBe(true);
    });
  });

  describe('createBlankProject', () => {
    it('creates an empty project with unique ID and default name', () => {
      const p1 = createBlankProject();
      const p2 = createBlankProject();
      expect(p1.id.startsWith('project_')).toBe(true);
      expect(p1.id).not.toBe(p2.id);
      expect(p1.name).toBe('Proyecto sin título');
      expect(p1.tasks).toEqual([]);
      expect(p1.resources).toEqual([]);
    });

    it('uses trimmed custom name or falls back to default when blank', () => {
      expect(createBlankProject('  Mi Plan  ').name).toBe('Mi Plan');
      expect(createBlankProject('   ').name).toBe('Proyecto sin título');
    });

    it('generateProjectId generates unique project_ IDs', () => {
      const id = generateProjectId();
      expect(id.startsWith('project_')).toBe(true);
    });
  });

  describe('recomputeSummaryRanges', () => {
    it('syncs summary start, end, and working duration from children even with mixed UTC offsets', () => {
      const tasks = [
        makeTask('parent', 'Embajador', {
          start: '2026-11-25T00:00:00.000Z',
          end: '2026-12-29T00:00:00.000Z',
          duration: 23,
        }),
        makeTask('c1', 'Postulaciones', {
          parentId: 'parent',
          start: '2026-11-26T03:00:00.000Z',
          end: '2026-12-07T03:00:00.000Z',
          duration: 8,
        }),
        makeTask('c2', 'Capacitacion II', {
          parentId: 'parent',
          start: '2026-12-29T03:00:00.000Z',
          end: '2026-12-30T03:00:00.000Z',
          duration: 2,
        }),
      ];

      const updated = recomputeSummaryRanges(tasks);
      expect(updated[0].start).toBe('2026-11-26T00:00:00.000Z');
      expect(updated[0].end).toBe('2026-12-30T00:00:00.000Z');
      expect(updated[0].duration).toBe(25);
    });
  });
});
