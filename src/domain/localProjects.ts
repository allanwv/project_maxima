import { GanttProject } from './models';

export const LOCAL_PROJECTS_KEY = 'maxima:projects:v1';
export const ACTIVE_PROJECT_ID_KEY = 'maxima:active-project-id';
export const LEGACY_AUTOSAVE_KEY = 'maxima:autosave';

export interface SavedLocalProject {
  id: string;
  name: string;
  updatedAt: string;
  taskCount: number;
  project: GanttProject;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function isValidProject(candidate: unknown): candidate is GanttProject {
  if (!candidate || typeof candidate !== 'object') return false;
  const proj = candidate as Partial<GanttProject>;
  return (
    typeof proj.id === 'string' &&
    typeof proj.name === 'string' &&
    Array.isArray(proj.tasks) &&
    Array.isArray(proj.resources)
  );
}

function toSavedEntry(project: GanttProject, updatedAt = new Date().toISOString()): SavedLocalProject {
  return {
    id: project.id,
    name: project.name,
    updatedAt,
    taskCount: project.tasks.length,
    project,
  };
}

function sortByUpdatedDesc(entries: SavedLocalProject[]): SavedLocalProject[] {
  return [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Reads all locally saved projects from storage, sorted most recently updated first.
 */
export function loadSavedProjects(storage?: StorageLike): SavedLocalProject[] {
  const store = getStorage(storage);
  if (!store) return [];

  try {
    const raw = store.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const valid = parsed.filter((item): item is SavedLocalProject => (
      !!item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.updatedAt === 'string' &&
      isValidProject(item.project)
    ));
    return sortByUpdatedDesc(valid);
  } catch {
    return [];
  }
}

/**
 * Persists the saved projects list to storage safely.
 */
export function saveSavedProjects(entries: SavedLocalProject[], storage?: StorageLike): boolean {
  const store = getStorage(storage);
  if (!store) return false;

  try {
    store.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(sortByUpdatedDesc(entries)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes untouched empty untitled projects (except excludeId) so switching
 * away from an unused blank workspace does not clutter the list.
 */
export function pruneEmptyUntitledProjects(
  entries: SavedLocalProject[],
  excludeId?: string
): SavedLocalProject[] {
  return entries.filter((entry) => (
    entry.id === excludeId ||
    entry.project.tasks.length > 0 ||
    entry.project.name !== 'Proyecto sin título'
  ));
}

/**
 * Upserts a project into the local browser library, marks it active,
 * and mirrors it to the legacy autosave key for compatibility.
 */
export function upsertSavedProject(
  project: GanttProject,
  storage?: StorageLike,
  now = new Date().toISOString()
): SavedLocalProject[] {
  const store = getStorage(storage);
  if (!store) return [];

  const existing = pruneEmptyUntitledProjects(loadSavedProjects(store), project.id);
  const nextEntry = toSavedEntry(project, now);
  const filtered = existing.filter((entry) => entry.id !== project.id);
  const updated = sortByUpdatedDesc([nextEntry, ...filtered]);

  saveSavedProjects(updated, store);
  try {
    store.setItem(ACTIVE_PROJECT_ID_KEY, project.id);
    store.setItem(
      LEGACY_AUTOSAVE_KEY,
      JSON.stringify({ format: 'project-maxima', version: 1, project })
    );
  } catch {
    // Ignore storage quota errors cleanly
  }

  return updated;
}

/**
 * Deletes a project from the local browser library.
 * Clears active pointers if the removed project was active.
 */
export function removeSavedProject(projectId: string, storage?: StorageLike): SavedLocalProject[] {
  const store = getStorage(storage);
  if (!store) return [];

  const updated = loadSavedProjects(store).filter((entry) => entry.id !== projectId);
  saveSavedProjects(updated, store);

  try {
    if (store.getItem(ACTIVE_PROJECT_ID_KEY) === projectId) {
      store.removeItem(ACTIVE_PROJECT_ID_KEY);
      store.removeItem(LEGACY_AUTOSAVE_KEY);
    }
  } catch {
    // Ignore storage errors
  }

  return updated;
}

/**
 * Hydrates the multi-project library on startup and migrates any existing
 * `maxima:autosave` project so nothing is lost across app updates or reloads.
 */
export function hydrateLocalProjects(storage?: StorageLike): {
  projects: SavedLocalProject[];
  activeProject: GanttProject | null;
} {
  const store = getStorage(storage);
  if (!store) return { projects: [], activeProject: null };

  let projects = loadSavedProjects(store);
  let activeProjectId: string | null = null;
  try {
    activeProjectId = store.getItem(ACTIVE_PROJECT_ID_KEY);
  } catch {
    activeProjectId = null;
  }

  // Check legacy autosave for backwards-compatible migration
  let legacyProject: GanttProject | null = null;
  try {
    const rawLegacy = store.getItem(LEGACY_AUTOSAVE_KEY);
    if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy);
      if (parsed?.format === 'project-maxima' && isValidProject(parsed.project)) {
        const candidate = parsed.project;
        if (candidate.tasks.length > 0 || candidate.id !== 'empty-project') {
          legacyProject = candidate;
        }
      }
    }
  } catch {
    legacyProject = null;
  }

  if (legacyProject) {
    const alreadySaved = projects.some((entry) => entry.id === legacyProject!.id);
    if (!alreadySaved) {
      projects = sortByUpdatedDesc([toSavedEntry(legacyProject), ...projects]);
      saveSavedProjects(projects, store);
      if (!activeProjectId) {
        activeProjectId = legacyProject.id;
        try {
          store.setItem(ACTIVE_PROJECT_ID_KEY, activeProjectId);
        } catch {
          // Ignore storage errors
        }
      }
    }
  }

  const activeEntry = activeProjectId
    ? projects.find((entry) => entry.id === activeProjectId)
    : undefined;

  return {
    projects,
    activeProject: activeEntry?.project ?? legacyProject ?? null,
  };
}
