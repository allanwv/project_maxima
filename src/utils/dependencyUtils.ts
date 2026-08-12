import { GanttDependency, GanttTask } from '../domain/models';
import { RenderTask } from './ganttUtils';

export interface ParsedDependencyError {
  message: string;
}

/**
 * Parses a dependency string (e.g., "4FS+2d, 5SS") into an array of GanttDependencies.
 * Returns either the parsed array or an error.
 */
export function parseDependencyExpression(
  expression: string,
  tasks: RenderTask[],
  currentTaskUid: string
): GanttDependency[] | ParsedDependencyError {
  if (!expression || expression.trim() === '') {
    return [];
  }

  const parts = expression.split(',').map(p => p.trim()).filter(p => p !== '');
  const parsedDeps: GanttDependency[] = [];
  const seenIds = new Set<string>();

  for (const part of parts) {
    // Regex to match: [DisplayID][Type][LagSign][LagValue]d
    // Example matches: 
    // "4" -> id: 4, type: undefined, lag: undefined
    // "4FS" -> id: 4, type: FS, lag: undefined
    // "14FS+2d" -> id: 14, type: FS, lagSign: +, lagValue: 2
    // "14FS-1d" -> id: 14, type: FS, lagSign: -, lagValue: 1
    const match = part.match(/^(\d+)(FS|SS|FF|SF)?(?:([+-])(\d+(?:\.\d+)?)d?)?$/i);

    if (!match) {
      return { message: `Formato de precedencia inválido: "${part}"` };
    }

    const displayIdStr = match[1];
    const typeStr = (match[2] || 'FS').toUpperCase() as "FS" | "SS" | "FF" | "SF";
    const lagSign = match[3];
    const lagValueStr = match[4];

    const displayId = parseInt(displayIdStr, 10);
    
    // Find UID from displayId
    const targetTask = tasks.find(t => t.displayId === displayId);
    if (!targetTask) {
      return { message: `La tarea ${displayId} no existe.` };
    }

    const targetUid = targetTask.id;

    if (targetUid === currentTaskUid) {
      return { message: `Una tarea no puede depender de sí misma (ID: ${displayId}).` };
    }

    if (seenIds.has(targetUid)) {
      return { message: `Dependencia duplicada a la tarea ${displayId}.` };
    }
    seenIds.add(targetUid);

    let lag = 0;
    if (lagValueStr) {
      lag = parseFloat(lagValueStr);
      if (lagSign === '-') {
        lag = -lag;
      }
    }

    parsedDeps.push({
      taskId: targetUid,
      type: typeStr,
      lag
    });
  }

  // Check for cycles
  if (wouldCreateDependencyCycle(tasks, currentTaskUid, parsedDeps)) {
    return { message: `Esta dependencia crearía un ciclo.` };
  }

  return parsedDeps;
}

/**
 * Checks if applying new dependencies to a task would create a cycle in the network.
 */
export function wouldCreateDependencyCycle(
  allTasks: GanttTask[],
  taskUid: string,
  newDependencies: GanttDependency[]
): boolean {
  // Build a temporary adjacency list representing the graph
  const graph = new Map<string, string[]>();

  for (const t of allTasks) {
    if (t.id === taskUid) {
      graph.set(t.id, newDependencies.map(d => d.taskId));
    } else {
      graph.set(t.id, t.dependencies ? t.dependencies.map(d => d.taskId) : []);
    }
  }

  // Detect cycle using DFS
  // A cycle exists if we encounter a node that is currently in the recursion stack (visiting).
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visiting.add(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) {
        return true;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  for (const t of allTasks) {
    if (!visited.has(t.id)) {
      if (hasCycle(t.id)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Formats a single dependency to a friendly tooltip string.
 */
export function formatDependencyTooltip(dep: GanttDependency, displayId: number | string): string {
  const typeMap: Record<string, string> = {
    'FS': 'Fin a Inicio',
    'SS': 'Inicio a Inicio',
    'FF': 'Fin a Fin',
    'SF': 'Inicio a Fin'
  };
  const typeName = typeMap[dep.type] || dep.type;
  
  let lagStr = '';
  if (dep.lag !== undefined && dep.lag !== 0) {
    lagStr = ` · ${dep.lag > 0 ? '+' : ''}${dep.lag} día${Math.abs(dep.lag) !== 1 ? 's' : ''}`;
  }

  return `Tarea ${displayId} · ${typeName}${lagStr}`;
}
