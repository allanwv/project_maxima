import { describe, it, expect } from 'vitest';
import { scheduleProjectAfterTaskChange, addWorkingDays } from './schedulingEngine';
import { GanttTask } from '../models';

describe('Scheduling Engine', () => {
  const baseTask: Omit<GanttTask, 'id' | 'name' | 'start' | 'end' | 'dependencies'> = {
    duration: 5,
    progress: 0,
    milestone: false,
    resourceIds: []
  };

  it('FS: pushes successor if predecessor moves forward', () => {
    const tasks: GanttTask[] = [
      { id: 't1', name: 'A', start: '2026-08-10T00:00:00.000Z', end: '2026-08-14T00:00:00.000Z', dependencies: [], ...baseTask }, // Mon-Fri
      { id: 't2', name: 'B', start: '2026-08-17T00:00:00.000Z', end: '2026-08-21T00:00:00.000Z', dependencies: [{ taskId: 't1', type: 'FS', lag: 0 }], ...baseTask } // Mon-Fri next week
    ];

    // Simulate user moving T1 to start on Tuesday (ends Monday 17th)
    tasks[0].start = '2026-08-11T00:00:00.000Z';
    tasks[0].end = '2026-08-17T00:00:00.000Z'; // Mon 17th

    const result = scheduleProjectAfterTaskChange(tasks, { changedTaskUid: 't1' });
    const t2 = result.find(t => t.id === 't2')!;
    
    // T1 ends Mon 17th. T2 should start Tue 18th (1 working day after Mon 17th)
    expect(t2.start.substring(0, 10)).toBe('2026-08-18');
    // T2 duration is 5 days, so Tue, Wed, Thu, Fri, Mon -> ends Mon 24th
    expect(t2.end.substring(0, 10)).toBe('2026-08-24');
  });

  it('FS + lag: respects positive lag', () => {
    const tasks: GanttTask[] = [
      { id: 't1', name: 'A', start: '2026-08-10T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] }, // Ends Mon 10th
      { id: 't2', name: 'B', start: '2026-08-11T00:00:00.000Z', end: '2026-08-11T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 't1', type: 'FS', lag: 2 }] }
    ];

    // 0 lag = Tue 11th. 2 lag = Thu 13th.
    const result = scheduleProjectAfterTaskChange(tasks, { changedTaskUid: 't1' });
    const t2 = result.find(t => t.id === 't2')!;
    
    expect(t2.start.substring(0, 10)).toBe('2026-08-13');
  });

  it('FS lead: respects negative lag (overlap)', () => {
    const tasks: GanttTask[] = [
      { id: 't1', name: 'A', start: '2026-08-10T00:00:00.000Z', end: '2026-08-13T00:00:00.000Z', duration: 4, progress: 0, milestone: false, resourceIds: [], dependencies: [] }, // Ends Thu 13th
      // -2 days lag means B starts 2 days before it normally would.
      // Normal start = Fri 14th. -1 day = Thu 13th. -2 days = Wed 12th.
      { id: 't2', name: 'B', start: '2026-08-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 't1', type: 'FS', lag: -2 }] }
    ];

    const result = scheduleProjectAfterTaskChange(tasks, { changedTaskUid: 't1' });
    const t2 = result.find(t => t.id === 't2')!;
    
    expect(t2.start.substring(0, 10)).toBe('2026-08-12');
  });

  it('SS: matches start date', () => {
    const tasks: GanttTask[] = [
      { id: 't1', name: 'A', start: '2026-08-12T00:00:00.000Z', end: '2026-08-12T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
      { id: 't2', name: 'B', start: '2026-08-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 't1', type: 'SS', lag: 0 }] }
    ];

    const result = scheduleProjectAfterTaskChange(tasks, { changedTaskUid: 't1' });
    expect(result[1].start.substring(0, 10)).toBe('2026-08-12');
  });

  it('FF: matches end date and calculates start backward', () => {
    const tasks: GanttTask[] = [
      { id: 't1', name: 'A', start: '2026-08-10T00:00:00.000Z', end: '2026-08-14T00:00:00.000Z', duration: 5, progress: 0, milestone: false, resourceIds: [], dependencies: [] }, // Ends Fri 14th
      { id: 't2', name: 'B', start: '2026-08-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z', duration: 3, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 't1', type: 'FF', lag: 0 }] }
    ];

    const result = scheduleProjectAfterTaskChange(tasks, { changedTaskUid: 't1' });
    const t2 = result[1];
    expect(t2.end.substring(0, 10)).toBe('2026-08-14'); // Finishes Fri 14
    // 3 days duration ending Fri 14 -> Wed 12, Thu 13, Fri 14
    expect(t2.start.substring(0, 10)).toBe('2026-08-12');
  });

  it('Cascade: propagates through multiple tasks', () => {
    const tasks: GanttTask[] = [
      { id: 't1', name: 'A', start: '2026-08-10T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
      { id: 't2', name: 'B', start: '2026-08-11T00:00:00.000Z', end: '2026-08-11T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 't1', type: 'FS', lag: 0 }] },
      { id: 't3', name: 'C', start: '2026-08-12T00:00:00.000Z', end: '2026-08-12T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 't2', type: 'FS', lag: 0 }] }
    ];

    // Move A to Tue 11th
    tasks[0].start = '2026-08-11T00:00:00.000Z';
    tasks[0].end = '2026-08-11T00:00:00.000Z';

    const result = scheduleProjectAfterTaskChange(tasks, { changedTaskUid: 't1' });
    // B should be Wed 12th
    expect(result[1].start.substring(0, 10)).toBe('2026-08-12');
    // C should be Thu 13th
    expect(result[2].start.substring(0, 10)).toBe('2026-08-13');
  });

  it('Multiple predecessors: takes the most restrictive', () => {
    const tasks: GanttTask[] = [
      { id: 't1', name: 'A', start: '2026-08-10T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] }, // Ends Mon 10th -> Next is Tue 11th
      { id: 't2', name: 'B', start: '2026-08-12T00:00:00.000Z', end: '2026-08-12T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] }, // Ends Wed 12th -> Next is Thu 13th
      { id: 't3', name: 'C', start: '2026-08-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], 
        dependencies: [
          { taskId: 't1', type: 'FS', lag: 0 },
          { taskId: 't2', type: 'FS', lag: 0 }
        ] 
      }
    ];

    const result = scheduleProjectAfterTaskChange(tasks, { changedTaskUid: 't2' }); // Trigger a check
    // T3 must respect T2 which pushes it to Thu 13th
    expect(result[2].start.substring(0, 10)).toBe('2026-08-13');
  });

  it('Maintains manual slack (does not move backwards unnecessarily)', () => {
    const tasks: GanttTask[] = [
      { id: 't1', name: 'A', start: '2026-08-10T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] }, // Ends Mon 10th
      // B is manually set to Thu 13th, even though FS allows Tue 11th.
      { id: 't2', name: 'B', start: '2026-08-13T00:00:00.000Z', end: '2026-08-13T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 't1', type: 'FS', lag: 0 }] }
    ];

    // Trigger update on T1, but T1 hasn't moved past T2's slack
    const result = scheduleProjectAfterTaskChange(tasks, { changedTaskUid: 't1' });
    
    // T2 should stay at 13th
    expect(result[1].start.substring(0, 10)).toBe('2026-08-13');
  });

  it('Milestones: preserves 0 duration and start === end', () => {
    const tasks: GanttTask[] = [
      { id: 't1', name: 'A', start: '2026-08-10T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
      { id: 't2', name: 'M', start: '2026-08-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z', duration: 0, progress: 0, milestone: true, resourceIds: [], dependencies: [{ taskId: 't1', type: 'FS', lag: 0 }] }
    ];

    const result = scheduleProjectAfterTaskChange(tasks, { changedTaskUid: 't1' });
    const m = result[1];
    expect(m.start.substring(0, 10)).toBe('2026-08-11');
    expect(m.end.substring(0, 10)).toBe('2026-08-11');
  });

  it('Summary Tasks: recalculate start and end based on children', () => {
    const tasks: GanttTask[] = [
      { id: 's1', name: 'Summary', start: '2026-08-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
      { id: 't1', parentId: 's1', name: 'Child 1', start: '2026-08-10T00:00:00.000Z', end: '2026-08-12T00:00:00.000Z', duration: 3, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
      { id: 't2', parentId: 's1', name: 'Child 2', start: '2026-08-13T00:00:00.000Z', end: '2026-08-14T00:00:00.000Z', duration: 2, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 't1', type: 'FS', lag: 0 }] }
    ];

    // Trigger update on child 1
    const result = scheduleProjectAfterTaskChange(tasks, { changedTaskUid: 't1' });
    const s1 = result.find(t => t.id === 's1')!;
    
    // Summary should span from min child start to max child end
    expect(s1.start.substring(0, 10)).toBe('2026-08-10');
    expect(s1.end.substring(0, 10)).toBe('2026-08-14');
  });

  describe('evaluateTaskUids (Editing PREDEC)', () => {
    it('pushes task if new dependency requires later start', () => {
      const tasks: GanttTask[] = [
        { id: 't1', name: 'A', start: '2026-08-10T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
        { id: 't2', name: 'B', start: '2026-08-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] }
      ];

      // Simulate user editing B to depend on A FS
      tasks[1].dependencies = [{ taskId: 't1', type: 'FS', lag: 0 }];

      const result = scheduleProjectAfterTaskChange(tasks, { evaluateTaskUids: ['t2'] });
      // B should be moved to Tue 11th
      expect(result[1].start.substring(0, 10)).toBe('2026-08-11');
    });

    it('does not push task if it already satisfies the new dependency', () => {
      const tasks: GanttTask[] = [
        { id: 't1', name: 'A', start: '2026-08-10T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
        { id: 't2', name: 'B', start: '2026-08-15T00:00:00.000Z', end: '2026-08-15T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] }
      ];

      tasks[1].dependencies = [{ taskId: 't1', type: 'FS', lag: 0 }]; // requires 11th

      const result = scheduleProjectAfterTaskChange(tasks, { evaluateTaskUids: ['t2'] });
      // B should stay at 15th
      expect(result[1].start.substring(0, 10)).toBe('2026-08-15');
    });

    it('cascades to successors when edited task is pushed', () => {
      const tasks: GanttTask[] = [
        { id: 't1', name: 'A', start: '2026-08-10T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
        { id: 't2', name: 'B', start: '2026-08-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [] },
        { id: 't3', name: 'C', start: '2026-08-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z', duration: 1, progress: 0, milestone: false, resourceIds: [], dependencies: [{ taskId: 't2', type: 'FS', lag: 0 }] }
      ];

      tasks[1].dependencies = [{ taskId: 't1', type: 'FS', lag: 0 }];

      const result = scheduleProjectAfterTaskChange(tasks, { evaluateTaskUids: ['t2'] });
      // B -> 11th, C -> 12th
      expect(result[1].start.substring(0, 10)).toBe('2026-08-11');
      expect(result[2].start.substring(0, 10)).toBe('2026-08-12');
    });
  });
});
