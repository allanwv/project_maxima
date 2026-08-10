export interface GanttProject {
  id: string;
  name: string;
  tasks: GanttTask[];
  resources: GanttResource[];
}

export interface GanttTask {
  id: string;
  parentId?: string;
  name: string;
  start: string; // ISO String for dates e.g., '2026-08-10T00:00:00.000Z'
  end: string;   // ISO String
  duration: number; // Duration in days (or hours, depending on logic)
  progress: number; // 0 to 100
  milestone: boolean;
  dependencies: GanttDependency[];
  resourceIds: string[];
  
  // Optional date properties
  actualStart?: string;
  actualFinish?: string;
  earlyStart?: string;
  earlyFinish?: string;
  lateStart?: string;
  lateFinish?: string;
  baselineStart?: string;
  baselineFinish?: string;

  // Metadata for import tracing
  importMetadata?: {
    progressSource?: string;
    startSource?: string;
    finishSource?: string;
    durationSource?: string;
    durationEstimated?: boolean;
    durationFormat?: string;
    [key: string]: any;
  };

  // UI Specific (not technically domain, but useful for a first iteration)
  // Usually these are kept in a separate view model, but for simplicity:
  isExpanded?: boolean;
}

export interface GanttDependency {
  taskId: string;
  type: "FS" | "SS" | "FF" | "SF";
  lag?: number;
}

export interface GanttResource {
  id: string;
  name: string;
}
