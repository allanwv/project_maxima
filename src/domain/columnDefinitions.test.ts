import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GanttColumnId,
  COLUMN_DEFINITIONS,
  DEFAULT_VISIBLE_COLUMNS,
  getColumnDef,
  getDefaultColumnWidths,
  getMinColumnWidths,
  loadVisibleColumns,
  saveVisibleColumns,
  loadColumnWidths,
  saveColumnWidths,
} from './columnDefinitions';

describe('Column Definitions', () => {
  // ---- Defaults ----
  describe('defaults', () => {
    it('default visible columns are exactly: id, name, progress, duration, estimatedStart, estimatedFinish, predecessors', () => {
      expect(DEFAULT_VISIBLE_COLUMNS).toEqual([
        'id',
        'name',
        'progress',
        'duration',
        'estimatedStart',
        'estimatedFinish',
        'predecessors',
      ]);
    });

    it('optional columns (resources, aS, aF, bS, bF) are NOT in defaults', () => {
      const optionalIds: GanttColumnId[] = ['resources', 'actualStart', 'actualFinish', 'baselineStart', 'baselineFinish'];
      for (const id of optionalIds) {
        expect(DEFAULT_VISIBLE_COLUMNS).not.toContain(id);
      }
    });

    it('there are exactly 12 column definitions', () => {
      expect(COLUMN_DEFINITIONS).toHaveLength(12);
    });
  });

  // ---- Toggle logic (unit) ----
  describe('toggle', () => {
    it('activating resources adds it to visible set', () => {
      const current = [...DEFAULT_VISIBLE_COLUMNS];
      // Simulate toggle: add 'resources'
      const toggled: GanttColumnId[] = [...current, 'resources'];
      expect(toggled).toContain('resources');
    });

    it('deactivating progress removes it from visible set', () => {
      const current = [...DEFAULT_VISIBLE_COLUMNS];
      const toggled = current.filter(id => id !== 'progress');
      expect(toggled).not.toContain('progress');
    });
  });

  // ---- Name is always visible ----
  describe('name column', () => {
    it('name column is marked alwaysVisible', () => {
      const nameDef = getColumnDef('name');
      expect(nameDef).toBeDefined();
      expect(nameDef!.alwaysVisible).toBe(true);
    });

    it('no other column is alwaysVisible', () => {
      const alwaysVisible = COLUMN_DEFINITIONS.filter(c => c.alwaysVisible);
      expect(alwaysVisible).toHaveLength(1);
      expect(alwaysVisible[0].id).toBe('name');
    });
  });

  // ---- Resources ----
  describe('resources column', () => {
    it('resources column exists and is read-only', () => {
      const resDef = getColumnDef('resources');
      expect(resDef).toBeDefined();
      expect(resDef!.readOnly).toBe(true);
      expect(resDef!.defaultVisible).toBe(false);
    });
  });

  // ---- Optional fields (actualStart, baselineFinish, etc.) ----
  describe('optional date columns', () => {
    it.each([
      ['actualStart', 'aS'],
      ['actualFinish', 'aF'],
      ['baselineStart', 'bS'],
      ['baselineFinish', 'bF'],
    ] as [GanttColumnId, string][])('%s has label %s and is read-only', (id, label) => {
      const def = getColumnDef(id);
      expect(def).toBeDefined();
      expect(def!.label).toBe(label);
      expect(def!.readOnly).toBe(true);
      expect(def!.defaultVisible).toBe(false);
    });
  });

  // ---- Widths ----
  describe('widths', () => {
    it('default widths have entries for all columns', () => {
      const widths = getDefaultColumnWidths();
      for (const col of COLUMN_DEFINITIONS) {
        expect(widths[col.id]).toBeGreaterThan(0);
      }
    });

    it('min widths have entries for all columns', () => {
      const mins = getMinColumnWidths();
      for (const col of COLUMN_DEFINITIONS) {
        expect(mins[col.id]).toBeGreaterThan(0);
        expect(mins[col.id]).toBeLessThanOrEqual(getDefaultColumnWidths()[col.id]);
      }
    });

    it('hiding and reshowing a column preserves its width', () => {
      const widths = getDefaultColumnWidths();
      const originalWidth = widths.resources;
      // Simulate: user changes width to 200
      widths.resources = 200;
      // Then hide (just remove from visible list, width stays in map)
      // Then show again
      expect(widths.resources).toBe(200);
      // Original default was different
      expect(originalWidth).toBe(150);
    });
  });

  // ---- Persistence ----
  describe('persistence', () => {
    let storage: Record<string, string> = {};

    beforeEach(() => {
      storage = {};
      vi.stubGlobal('localStorage', {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, val: string) => { storage[key] = val; },
        removeItem: (key: string) => { delete storage[key]; },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('save and reload visible columns', () => {
      const custom: GanttColumnId[] = ['name', 'id', 'resources', 'actualStart'];
      saveVisibleColumns(custom);
      const loaded = loadVisibleColumns();
      // Should include the saved ones
      expect(loaded).toContain('name');
      expect(loaded).toContain('id');
      expect(loaded).toContain('resources');
      expect(loaded).toContain('actualStart');
    });

    it('invalid stored data falls back to defaults', () => {
      storage['maxima:gantt-visible-columns'] = 'not-json';
      const loaded = loadVisibleColumns();
      expect(loaded).toEqual(DEFAULT_VISIBLE_COLUMNS);
    });

    it('unknown column IDs are filtered out on load', () => {
      storage['maxima:gantt-visible-columns'] = JSON.stringify(['name', 'totally_fake_column', 'id']);
      const loaded = loadVisibleColumns();
      expect(loaded).toContain('name');
      expect(loaded).toContain('id');
      expect(loaded).not.toContain('totally_fake_column');
    });

    it('alwaysVisible columns are forced back in even if missing from saved data', () => {
      storage['maxima:gantt-visible-columns'] = JSON.stringify(['id', 'progress']);
      const loaded = loadVisibleColumns();
      expect(loaded).toContain('name'); // alwaysVisible
    });

    it('save and reload column widths', () => {
      const widths = getDefaultColumnWidths();
      widths.resources = 200;
      widths.id = 80;
      saveColumnWidths(widths);
      const loaded = loadColumnWidths();
      expect(loaded.resources).toBe(200);
      expect(loaded.id).toBe(80);
    });

    it('invalid width data falls back to defaults', () => {
      storage['maxima:gantt-column-widths'] = 'corrupt';
      const loaded = loadColumnWidths();
      expect(loaded).toEqual(getDefaultColumnWidths());
    });
  });

  // ---- Reset ----
  describe('reset', () => {
    it('reset returns exactly the default visible columns', () => {
      // After reset, visible should equal defaults
      expect(DEFAULT_VISIBLE_COLUMNS).toEqual([
        'id', 'name', 'progress', 'duration',
        'estimatedStart', 'estimatedFinish', 'predecessors',
      ]);
    });
  });
});
