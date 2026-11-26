import { describe, it, expect, beforeEach } from 'vitest';
import { GanttProject } from './models';
import {
  ACTIVE_PROJECT_ID_KEY,
  LEGACY_AUTOSAVE_KEY,
  LOCAL_PROJECTS_KEY,
  StorageLike,
  hydrateLocalProjects,
  loadSavedProjects,
  removeSavedProject,
  upsertSavedProject,
} from './localProjects';

function createMemoryStorage(): StorageLike {
  const data: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
  };
}

function makeProject(id: string, name: string, taskCount = 1): GanttProject {
  return {
    id,
    name,
    resources: [],
    tasks: Array.from({ length: taskCount }, (_, i) => ({
      id: `t-${i}`,
      name: `Tarea ${i + 1}`,
      start: '2026-11-26T00:00:00.000Z',
      end: '2026-11-26T00:00:00.000Z',
      duration: 1,
      progress: 0,
      milestone: false,
      dependencies: [],
      resourceIds: [],
    })),
  };
}

describe('localProjects', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('migrates legacy maxima:autosave project on first load after upgrade', () => {
    const legacy = makeProject('project-123', 'Planificacion Parques Chile', 3);
    storage.setItem(
      LEGACY_AUTOSAVE_KEY,
      JSON.stringify({ format: 'project-maxima', version: 1, project: legacy })
    );

    const { projects, activeProject } = hydrateLocalProjects(storage);
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe('project-123');
    expect(projects[0].taskCount).toBe(3);
    expect(activeProject?.name).toBe('Planificacion Parques Chile');
    expect(storage.getItem(ACTIVE_PROJECT_ID_KEY)).toBe('project-123');
    expect(storage.getItem(LOCAL_PROJECTS_KEY)).not.toBeNull();
  });

  it('stores multiple projects without overwriting previous ones', () => {
    const p1 = makeProject('p1', 'Proyecto Uno', 2);
    const p2 = makeProject('p2', 'Proyecto Dos', 4);

    upsertSavedProject(p1, storage, '2026-11-26T08:00:00.000Z');
    upsertSavedProject(p2, storage, '2026-11-26T08:05:00.000Z');

    const all = loadSavedProjects(storage);
    expect(all.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(storage.getItem(ACTIVE_PROJECT_ID_KEY)).toBe('p2');
  });

  it('prunes untouched empty untitled blank project when switching to another', () => {
    const blank = makeProject('blank-1', 'Proyecto sin título', 0);
    const real = makeProject('p2', 'Proyecto Real', 2);

    upsertSavedProject(blank, storage, '2026-11-26T08:00:00.000Z');
    upsertSavedProject(real, storage, '2026-11-26T08:01:00.000Z');

    const all = loadSavedProjects(storage);
    expect(all.map((p) => p.id)).toEqual(['p2']);
  });

  it('removes a saved project and clears active pointers when it was active', () => {
    const p1 = makeProject('p1', 'Proyecto Uno', 1);
    const p2 = makeProject('p2', 'Proyecto Dos', 2);

    upsertSavedProject(p1, storage, '2026-11-26T08:00:00.000Z');
    upsertSavedProject(p2, storage, '2026-11-26T08:05:00.000Z');

    const remaining = removeSavedProject('p2', storage);
    expect(remaining.map((p) => p.id)).toEqual(['p1']);
    expect(storage.getItem(ACTIVE_PROJECT_ID_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_AUTOSAVE_KEY)).toBeNull();
  });

  it('returns null activeProject after deleting active project while keeping remaining list', () => {
    const p1 = makeProject('p1', 'Proyecto Uno', 1);
    const p2 = makeProject('p2', 'Proyecto Dos', 2);

    upsertSavedProject(p1, storage, '2026-11-26T08:00:00.000Z');
    upsertSavedProject(p2, storage, '2026-11-26T08:05:00.000Z');
    removeSavedProject('p2', storage);

    const hydrated = hydrateLocalProjects(storage);
    expect(hydrated.projects.map((p) => p.id)).toEqual(['p1']);
    expect(hydrated.activeProject).toBeNull();
  });
});
