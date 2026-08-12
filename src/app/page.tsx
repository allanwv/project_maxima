'use client';

import { useState, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { GanttChart } from '@/components/gantt/GanttChart';
import { Header } from '@/components/layout/Header';
import { GanttProject } from '@/domain/models';
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

  // Attempt to load autosave on mount
  useEffect(() => {
    const saved = localStorage.getItem('maxima:autosave');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.format === 'project-maxima' && parsed.project) {
          loadProject(parsed.project);
        }
      } catch (e) {
        // ignore invalid
      }
    }
  }, [loadProject]);

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
        {project.tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm m-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <FolderOpen className="text-gray-300" size={32} strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-medium text-gray-700 tracking-tight mb-2">Sin información que mostrar</h2>
            <p className="text-sm text-gray-400 text-center max-w-md">
              Comienza importando un archivo XML desde ProjectLibre o carga un archivo `.json` previo usando los controles superiores.
            </p>
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
