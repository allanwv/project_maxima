import { GanttProject, GanttTask, GanttDependency, GanttResource } from '../../domain/models';

import { differenceInDays, parseISO, startOfDay } from 'date-fns';

export function parseDurationToDays(durationStr: string, minutesPerDay: number = 480): number {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  
  let totalMinutes = 0;
  const dMatch = durationStr.match(/(\d+)D/);
  if (dMatch) totalMinutes += parseInt(dMatch[1], 10) * minutesPerDay;
  
  const hMatch = durationStr.match(/(\d+)H/);
  if (hMatch) {
    totalMinutes += parseInt(hMatch[1], 10) * 60;
  }
  
  const mMatch = durationStr.match(/(\d+)M/);
  if (mMatch && durationStr.includes('T') && durationStr.indexOf('M') > durationStr.indexOf('T')) {
    totalMinutes += parseInt(mMatch[1], 10);
  }
  
  return totalMinutes / minutesPerDay;
}

function getChildNodeText(node: Element, localName: string): string | null {
  const children = Array.from(node.children);
  const child = children.find(c => c.localName === localName);
  return child && child.textContent ? child.textContent.trim() : null;
}

function getChildNodes(node: Element, localName: string): Element[] {
  return Array.from(node.children).filter(c => c.localName === localName);
}

const VALID_CUSTOM_PROGRESS_NAMES = [
  'avance', '% avance', 'porcentaje avance', 'progreso', '% progreso',
  'progress', 'percent complete', 'completion', 'completion percentage'
];

export function resolveTaskProgress(tNode: Element, customFieldsMap: Map<string, string>): { value: number; source: string } {
  // Case C & D: EarnedValueMethod
  const earnedValueMethod = getChildNodeText(tNode, 'EarnedValueMethod');
  const physicalPercent = getChildNodeText(tNode, 'PhysicalPercentComplete');
  if (earnedValueMethod === '1' && physicalPercent !== null) {
    const val = parseFloat(physicalPercent);
    if (!isNaN(val)) return { value: val, source: 'PhysicalPercentComplete' };
  }

  // Case A: PercentComplete
  const percentComplete = getChildNodeText(tNode, 'PercentComplete');
  if (percentComplete !== null) {
    const val = parseFloat(percentComplete);
    if (!isNaN(val)) return { value: val, source: 'PercentComplete' };
  }

  // Case B: PercentWorkComplete
  const percentWorkComplete = getChildNodeText(tNode, 'PercentWorkComplete');
  if (percentWorkComplete !== null) {
    const val = parseFloat(percentWorkComplete);
    if (!isNaN(val)) return { value: val, source: 'PercentWorkComplete' };
  }

  // Case E: ExtendedAttributes (Custom fields)
  const extNodes = getChildNodes(tNode, 'ExtendedAttribute');
  for (const ext of extNodes) {
    const fieldId = getChildNodeText(ext, 'FieldID');
    const valueStr = getChildNodeText(ext, 'Value');
    if (fieldId && valueStr && customFieldsMap.has(fieldId)) {
      const fieldName = customFieldsMap.get(fieldId)!.toLowerCase().trim();
      if (VALID_CUSTOM_PROGRESS_NAMES.includes(fieldName)) {
        const val = parseFloat(valueStr);
        if (!isNaN(val)) return { value: val, source: 'custom' };
      }
    }
  }

  // Case F: Default
  return { value: 0, source: 'default' };
}

export function importProjectXml(xmlString: string): GanttProject {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");
  
  const parserError = xmlDoc.getElementsByTagName("parsererror");
  if (parserError.length > 0) {
    throw new Error("Invalid XML format");
  }

  const projectNode = Array.from(xmlDoc.children).find(c => c.localName === 'Project');
  if (!projectNode) {
    throw new Error("No Project node found in XML");
  }

  const projectName = getChildNodeText(projectNode, 'Name') || getChildNodeText(projectNode, 'Title') || "Proyecto Importado";
  const minutesPerDay = parseInt(getChildNodeText(projectNode, 'MinutesPerDay') || "480", 10) || 480;
  
  // Custom Fields Map (ExtendedAttributes)
  const customFieldsMap = new Map<string, string>();
  const extAttrNodes = getChildNodes(projectNode, 'ExtendedAttributes')[0];
  if (extAttrNodes) {
    const extAttrs = getChildNodes(extAttrNodes, 'ExtendedAttribute');
    for (const ext of extAttrs) {
      const fieldId = getChildNodeText(ext, 'FieldID');
      const alias = getChildNodeText(ext, 'Alias');
      const name = getChildNodeText(ext, 'FieldName');
      const finalName = alias || name;
      if (fieldId && finalName) {
        customFieldsMap.set(fieldId, finalName);
      }
    }
  }

  // Parse Resources
  const resources: GanttResource[] = [];
  const resourcesNode = getChildNodes(projectNode, 'Resources')[0];
  if (resourcesNode) {
    const resourceNodes = getChildNodes(resourcesNode, 'Resource');
    for (const rNode of resourceNodes) {
      const uid = getChildNodeText(rNode, 'UID');
      const name = getChildNodeText(rNode, 'Name');
      if (uid && name) {
        resources.push({ id: uid, name });
      }
    }
  }

  // Parse Assignments
  const taskResourcesMap = new Map<string, string[]>();
  const assignmentsNode = getChildNodes(projectNode, 'Assignments')[0];
  if (assignmentsNode) {
    const assignmentNodes = getChildNodes(assignmentsNode, 'Assignment');
    for (const aNode of assignmentNodes) {
      const taskUid = getChildNodeText(aNode, 'TaskUID');
      const resourceUid = getChildNodeText(aNode, 'ResourceUID');
      if (taskUid && resourceUid) {
        if (!taskResourcesMap.has(taskUid)) {
          taskResourcesMap.set(taskUid, []);
        }
        taskResourcesMap.get(taskUid)!.push(resourceUid);
      }
    }
  }

  // Parse Tasks
  const rawTasks: any[] = [];
  const tasksNode = getChildNodes(projectNode, 'Tasks')[0];
  if (tasksNode) {
    const taskNodes = getChildNodes(tasksNode, 'Task');
    for (const tNode of taskNodes) {
      const uid = getChildNodeText(tNode, 'UID');
      const sourceId = getChildNodeText(tNode, 'ID');
      if (!uid) continue;

      const isNull = getChildNodeText(tNode, 'IsNull') === '1' || getChildNodeText(tNode, 'IsNull') === 'true';
      if (isNull) continue;

      const name = getChildNodeText(tNode, 'Name') || "Tarea sin nombre";
      const durationStr = getChildNodeText(tNode, 'Duration') || "";
      const durationFormat = getChildNodeText(tNode, 'DurationFormat') || undefined;
      const milestone = getChildNodeText(tNode, 'Milestone') === '1' || getChildNodeText(tNode, 'Milestone') === 'true';
      const outlineLevel = parseInt(getChildNodeText(tNode, 'OutlineLevel') || "1", 10);
      
      // Some XML uses <Estimated>1</Estimated>, others use format like 39 (estimated days)
      let durationEstimated = getChildNodeText(tNode, 'Estimated') === '1' || getChildNodeText(tNode, 'Estimated') === 'true';
      if (!durationEstimated && durationFormat) {
        // e.g. 36 (em?), 37 (eh?), 38 (ed?), 39 (ed?), 40...
        const fmtNum = parseInt(durationFormat, 10);
        if (fmtNum >= 35 && fmtNum <= 44) {
          durationEstimated = true;
        }
      }

      // Resolve Start
      let startStr: string | undefined = getChildNodeText(tNode, 'Start') || undefined;
      let startSource = 'Start';
      if (!startStr || isNaN(Date.parse(startStr))) {
        startStr = getChildNodeText(tNode, 'EarlyStart') || undefined;
        startSource = 'EarlyStart';
      }
      if (!startStr || isNaN(Date.parse(startStr))) {
        startStr = undefined;
        startSource = 'missing';
      }

      // Resolve Finish
      let finishStr: string | undefined = getChildNodeText(tNode, 'Finish') || undefined;
      let finishSource = 'Finish';
      if (!finishStr || isNaN(Date.parse(finishStr))) {
        finishStr = getChildNodeText(tNode, 'EarlyFinish') || undefined;
        finishSource = 'EarlyFinish';
      }
      if (!finishStr || isNaN(Date.parse(finishStr))) {
        finishStr = undefined;
        finishSource = 'missing';
      }

      let parsedDurationDays: number | undefined;
      let durationSource = 'Duration';
      if (durationStr) {
        parsedDurationDays = parseDurationToDays(durationStr, minutesPerDay);
      } else {
        durationSource = 'calculated-from-dates';
        if (startStr && finishStr && !isNaN(Date.parse(startStr)) && !isNaN(Date.parse(finishStr))) {
           parsedDurationDays = Math.max(0, differenceInDays(startOfDay(parseISO(finishStr)), startOfDay(parseISO(startStr))) + 1);
        } else {
           parsedDurationDays = 0;
        }
      }
      
      // Resolve Progress
      const progressResult = resolveTaskProgress(tNode, customFieldsMap);

      // Optional Dates
      const actualStart = getChildNodeText(tNode, 'ActualStart') || undefined;
      const actualFinish = getChildNodeText(tNode, 'ActualFinish') || undefined;
      const earlyStart = getChildNodeText(tNode, 'EarlyStart') || undefined;
      const earlyFinish = getChildNodeText(tNode, 'EarlyFinish') || undefined;
      const lateStart = getChildNodeText(tNode, 'LateStart') || undefined;
      const lateFinish = getChildNodeText(tNode, 'LateFinish') || undefined;
      const baselineStart = getChildNodeText(tNode, 'BaselineStart') || undefined;
      const baselineFinish = getChildNodeText(tNode, 'BaselineFinish') || undefined;

      // Dependencies
      const dependencies: GanttDependency[] = [];
      const predNodes = getChildNodes(tNode, 'PredecessorLink');
      for (const pNode of predNodes) {
        const predUid = getChildNodeText(pNode, 'PredecessorUID');
        const typeNum = getChildNodeText(pNode, 'Type');
        if (predUid) {
          let type: "FS" | "SS" | "FF" | "SF" = "FS";
          if (typeNum === '0') type = "FF";
          else if (typeNum === '1') type = "FS";
          else if (typeNum === '2') type = "SF";
          else if (typeNum === '3') type = "SS";
          // Lag is usually stored in tenths of a minute (e.g. 4800 = 8 hours)
          // 4800 / 10 = 480 minutes = 1 day (if MinutesPerDay is 480)
          const rawLag = parseInt(getChildNodeText(pNode, 'LinkLag') || "0", 10);
          // Simple heuristic for lag in days:
          const lagMinutes = rawLag / 10;
          const lagDays = lagMinutes / minutesPerDay;
          dependencies.push({ taskId: predUid, type, lag: lagDays });
        }
      }

      rawTasks.push({
        uid,
        sourceId,
        name,
        startStr,
        finishStr,
        durationStr,
        parsedDurationDays,
        durationSource,
        durationEstimated,
        durationFormat,
        percentComplete: progressResult.value,
        progressSource: progressResult.source,
        startSource,
        finishSource,
        milestone,
        outlineLevel,
        dependencies,
        resourceIds: taskResourcesMap.get(uid) || [],
        actualStart, actualFinish, earlyStart, earlyFinish, lateStart, lateFinish, baselineStart, baselineFinish
      });
    }
  }

  // Reconstruct Hierarchy based on OutlineLevel
  const tasks: GanttTask[] = [];
  const levelMap = new Map<number, string>();

  for (const rt of rawTasks) {
    const level = rt.outlineLevel;
    let parentId: string | undefined = undefined;

    if (level > 0 && levelMap.has(level - 1)) {
      parentId = levelMap.get(level - 1);
    } else if (level > 1) {
      let fallbackLevel = level - 1;
      while (fallbackLevel > 0 && !levelMap.has(fallbackLevel)) {
        fallbackLevel--;
      }
      if (fallbackLevel > 0) {
        parentId = levelMap.get(fallbackLevel);
      }
    }

    levelMap.set(level, rt.uid);
    for (const k of levelMap.keys()) {
      if (k > level) levelMap.delete(k);
    }

    if (rt.uid === "0" && level === 0) {
      levelMap.delete(level);
      continue;
    }

    if (parentId === "0") {
      parentId = undefined;
    }

    tasks.push({
      id: rt.uid,
      sourceId: rt.sourceId,
      parentId,
      name: rt.name,
      start: rt.startStr || new Date().toISOString(),
      end: rt.finishStr || rt.startStr || new Date().toISOString(),
      duration: rt.parsedDurationDays,
      progress: Math.max(0, Math.min(100, rt.percentComplete)), // Clamp 0-100
      milestone: rt.milestone,
      dependencies: rt.dependencies,
      resourceIds: rt.resourceIds,
      isExpanded: true,
      
      // Optional dates
      actualStart: rt.actualStart,
      actualFinish: rt.actualFinish,
      earlyStart: rt.earlyStart,
      earlyFinish: rt.earlyFinish,
      lateStart: rt.lateStart,
      lateFinish: rt.lateFinish,
      baselineStart: rt.baselineStart,
      baselineFinish: rt.baselineFinish,

      // Metadata
      importMetadata: {
        progressSource: rt.progressSource,
        startSource: rt.startSource,
        finishSource: rt.finishSource,
        durationSource: rt.durationSource,
        durationEstimated: rt.durationEstimated,
        durationFormat: rt.durationFormat
      }
    });
  }

  return {
    id: `project-${Date.now()}`,
    name: projectName,
    resources,
    tasks
  };
}
