'use client';

import { useState, useEffect } from 'react';
import { mockProject } from '@/mock/project';
import { GanttChart } from '@/components/gantt/GanttChart';
import { Header } from '@/components/layout/Header';
import { GanttProject } from '@/domain/models';
import { importProjectXml } from '@/importers/xml/projectXmlImporter';
import { useProjectEditor } from '@/hooks/useProjectEditor';
import { useZoom } from '@/hooks/useZoom';

export default function Home() {
  const {
    project,
    updateTask,
    undo,
    redo,
    canUndo,
    canRedo,
    isDirty,
    setIsDirty,
    loadProject
  } = useProjectEditor(mockProject);

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

  const handleImportMaxima = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.format === 'project-maxima' && parsed.project) {
        loadProject(parsed.project);
      } else {
        throw new Error('Formato JSON inválido. Debe ser un export de Maxima.');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al importar JSON');
    }
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
        <GanttChart 
          key={project.id} 
          project={project} 
          updateTask={updateTask}
          zoomLevel={zoomLevel}
        />
      </main>
    </div>
  );
}
