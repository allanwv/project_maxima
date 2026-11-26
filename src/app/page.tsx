'use client';

import { useState, useEffect } from 'react';
import { FilePlus2, FolderOpen, Layers } from 'lucide-react';
import { GanttChart } from '@/components/gantt/GanttChart';
import { Header } from '@/components/layout/Header';
import { GanttProject } from '@/domain/models';
import {
  SavedLocalProject,
  hydrateLocalProjects,
  removeSavedProject,
  upsertSavedProject,
} from '@/domain/localProjects';
import { createBlankProject } from '@/domain/taskUtils';
import { importProjectXml } from '@/importers/xml/projectXmlImporter';
import { useProjectEditor } from '@/hooks/useProjectEditor';
import { useZoom } from '@/hooks/useZoom';
import { useSaveFile } from '@/hooks/useSaveFile';

const emptyProject: GanttProject = {
  id: 'empty-project',
  name: 'Proyecto sin título',
  tasks: [],
  resources: []
};

export default function Home() {
  const {
    project,
    updateTask,
    updateTasks,
    undo,
    redo,
    canUndo,
    canRedo,
    isDirty,
    setIsDirty,
    loadProject,
    renameProject,
    addTask,
    addSubtask,
    deleteTask,
    moveTask,
    indentTask,
    outdentTask,
    canIndentTask
  } = useProjectEditor(emptyProject);

  const {
    zoomLevel,
    zoomIn,
    zoomOut,
    setPreset,
    canZoomIn,
    canZoomOut
  } = useZoom();

  const [importState, setImportState] = useState<'idle' | 'importing' | 'error' | 'success'>('idle');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [hasActiveWorkspace, setHasActiveWorkspace] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedLocalProject[]>([]);

  const {
    currentFile,
    setCurrentFile,
    saveStatus,
    handleSaveOverwrite,
    handleSaveCopy,
    handleExportHtml,
    handleImportMaxima,
    handleOpenMaximaClick
  } = useSaveFile({ project, setIsDirty, loadProject });

  // Hydrate multi-project library and migrate any legacy maxima:autosave on mount
  useEffect(() => {
    const { projects, activeProject } = hydrateLocalProjects();
    queueMicrotask(() => {
      setSavedProjects(projects);
      if (activeProject) {
        loadProject(activeProject);
        setCurrentFile({
          name: activeProject.name,
          type: 'new'
        });
      }
      setHasHydrated(true);
    });
  }, [loadProject, setCurrentFile]);

  // Persist active project changes to local browser library + legacy autosave mirror
  useEffect(() => {
    if (!hasHydrated) return;
    if (project.id === emptyProject.id && project.tasks.length === 0) return;
    const updated = upsertSavedProject(project);
    queueMicrotask(() => {
      setSavedProjects(updated);
    });
  }, [project, hasHydrated]);

  // Warn before closing tab or reloading when there are unexported changes
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleCreateBlankProject = () => {
    const blank = createBlankProject();
    loadProject(blank);
    setCurrentFile({
      name: blank.name,
      type: 'new'
    });
    const updated = upsertSavedProject(blank);
    setSavedProjects(updated);
    setHasActiveWorkspace(true);
    setImportState('idle');
    setErrorDetails('');
  };

  const handleSelectLocalProject = (projectId: string) => {
    const target = savedProjects.find((entry) => entry.id === projectId);
    if (!target) return;
    loadProject(target.project);
    setCurrentFile({
      name: target.name,
      type: 'new'
    });
    const updated = upsertSavedProject(target.project);
    setSavedProjects(updated);
    setHasActiveWorkspace(true);
    setImportState('idle');
    setErrorDetails('');
  };

  const handleDeleteLocalProject = (projectId: string) => {
    const remaining = removeSavedProject(projectId);
    setSavedProjects(remaining);
    if (projectId === project.id) {
      loadProject(emptyProject);
      setCurrentFile({
        name: emptyProject.name,
        type: 'new'
      });
      setHasActiveWorkspace(false);
    }
  };

  const showGantt = project.tasks.length > 0 || hasActiveWorkspace || project.id !== emptyProject.id;

  const handleImportXml = (xmlString: string) => {
    setImportState('importing');
    setErrorDetails('');

    // Use a small timeout to allow UI to render "Importing..." state
    setTimeout(() => {
      try {
        const importedProject = importProjectXml(xmlString);
        loadProject(importedProject);
        setCurrentFile({
          name: 'Importado.xml',
          type: 'xml-import'
        });
        setHasActiveWorkspace(true);
        setImportState('success');

        // Reset success state after a few seconds
        setTimeout(() => setImportState('idle'), 3000);
      } catch (err: unknown) {
        setImportState('error');
        const errorMessage = err instanceof Error ? err.message : 'El archivo XML no tiene el formato esperado.';
        setErrorDetails(errorMessage);
      }
    }, 50);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50/50">
      <Header
        project={project}
        onNewProject={handleCreateBlankProject}
        savedProjects={savedProjects}
        onSelectLocalProject={handleSelectLocalProject}
        onDeleteLocalProject={handleDeleteLocalProject}
        onImportXml={handleImportXml}
        onImportMaxima={handleImportMaxima}
        importState={importState}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        isDirty={isDirty}
        setIsDirty={setIsDirty}
        zoomLevel={zoomLevel}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onSetZoomPreset={setPreset}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
        onRenameProject={renameProject}
        currentFile={currentFile}
        onSaveOverwrite={handleSaveOverwrite}
        onSaveCopy={handleSaveCopy}
        onExportHtml={handleExportHtml}
        onOpenMaximaClick={handleOpenMaximaClick}
        saveStatus={saveStatus}
      />

      {importState === 'error' && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <p className="text-sm text-red-800 font-medium">No pudimos importar este proyecto.</p>
          <p className="text-xs text-red-600 mt-1">{errorDetails}</p>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden p-2 relative">
        {/* We add a subtle overlay while importing to prevent interactions */}
        {importState === 'importing' && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        {/* We key by project id to force remount and reset expand/collapse states on new project */}
        {!showGantt ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm m-4 px-6">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <FolderOpen className="text-gray-300" size={32} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-medium text-gray-700 tracking-tight mb-2">Sin información que mostrar</h2>
            <p className="text-sm text-gray-400 text-center max-w-md mb-6">
              Crea un proyecto en blanco desde cero, importa un archivo XML desde ProjectLibre o abre un archivo <code className="text-gray-500">.json</code> previo.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleCreateBlankProject}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 transition-colors shadow-sm"
              >
                <FilePlus2 size={16} />
                <span>Crear proyecto en blanco</span>
              </button>
              <button
                onClick={handleOpenMaximaClick}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md font-medium text-sm hover:bg-gray-50 transition-colors shadow-sm"
              >
                <FolderOpen size={16} />
                <span>Abrir proyecto (.json)</span>
              </button>
            </div>
            {savedProjects.length > 0 && (
              <div className="mt-8 w-full max-w-md border-t border-gray-100 pt-5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2.5">
                  <Layers size={14} />
                  <span>Proyectos guardados en este navegador ({savedProjects.length})</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {savedProjects.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => handleSelectLocalProject(entry.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-md transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-800 truncate pr-2">{entry.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{entry.taskCount} tareas</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <GanttChart
            key={project.id}
            project={project}
            updateTask={updateTask}
            updateTasks={updateTasks}
            zoomLevel={zoomLevel}
            onAddTask={addTask}
            onAddSubtask={addSubtask}
            onDeleteTask={deleteTask}
            onMoveTask={moveTask}
            onIndentTask={indentTask}
            onOutdentTask={outdentTask}
            canIndentTask={canIndentTask}
          />
        )}
      </main>
    </div>
  );
}
