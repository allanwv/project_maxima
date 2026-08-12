import { useState } from 'react';
import { CurrentFile } from '@/types/fileSystem';
import { GanttProject } from '@/domain/models';

interface UseSaveFileProps {
  project: GanttProject;
  setIsDirty: (dirty: boolean) => void;
  loadProject: (project: GanttProject) => void;
}

export function useSaveFile({ project, setIsDirty, loadProject }: UseSaveFileProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [currentFile, setCurrentFile] = useState<CurrentFile>({
    name: 'Proyecto sin título',
    type: 'new'
  });

  const showSaveSuccess = () => {
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 4000);
  };

  const generateProjectJson = () => JSON.stringify({ format: 'project-maxima', version: 1, project }, null, 2);

  const fallbackSaveDownload = (content: string, name: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveOverwrite = async (): Promise<boolean> => {
    if (currentFile.type !== 'maxima' || !currentFile.handle) return false;
    try {
      setSaveStatus('saving');
      const writable = await currentFile.handle.createWritable();
      const data = generateProjectJson();
      await writable.write(data);
      await writable.close();
      setIsDirty(false);
      showSaveSuccess();
      return true;
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('Error al sobrescribir, el archivo pudo haber sido eliminado o movido', e);
      }
      setSaveStatus('idle');
      return false;
    }
  };

  const handleSaveCopy = async () => {
    const data = generateProjectJson();
    if (typeof window !== 'undefined' && window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: currentFile.name.endsWith('.json') ? currentFile.name : `${currentFile.name}.maxima.json`,
          types: [{ description: 'Archivos Maxima', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        
        setCurrentFile({
          name: handle.name,
          type: 'maxima',
          handle: handle
        });
        setIsDirty(false);
        showSaveSuccess();
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error(e);
      }
    } else {
      fallbackSaveDownload(data, `${project.name}.maxima.json`);
      setIsDirty(false);
      showSaveSuccess();
    }
  };

  const handleExportHtml = async () => {
    const htmlContent = `<!DOCTYPE html><html><head><title>${project.name}</title></head><body><h1>${project.name}</h1><p>Exportación de Gantt (placeholder)</p></body></html>`;
    if (typeof window !== 'undefined' && window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${project.name}.html`,
          types: [{ description: 'Archivo HTML', accept: { 'text/html': ['.html'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(htmlContent);
        await writable.close();
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error(e);
      }
    } else {
      fallbackSaveDownload(htmlContent, `${project.name}.html`);
    }
  };

  const handleImportMaxima = (jsonString: string, fileHandle?: any, fileName?: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.format === 'project-maxima' && parsed.project) {
        loadProject(parsed.project);
        setCurrentFile({
          name: fileName || parsed.project.name || 'Proyecto importado',
          type: 'maxima',
          handle: fileHandle
        });
      } else {
        throw new Error('Formato JSON inválido.');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al importar JSON');
    }
  };

  const handleOpenMaximaClick = async () => {
    if (typeof window !== 'undefined' && window.showOpenFilePicker) {
      try {
        const [fileHandle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'Archivos Maxima',
              accept: { 'application/json': ['.json', '.maxima.json'] },
            },
          ],
        });
        const file = await fileHandle.getFile();
        const content = await file.text();
        handleImportMaxima(content, fileHandle, file.name);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('Error opening file:', e);
        }
      }
    } else {
      document.getElementById('hidden-maxima-input')?.click();
    }
  };

  return {
    currentFile,
    setCurrentFile,
    saveStatus,
    handleSaveOverwrite,
    handleSaveCopy,
    handleExportHtml,
    handleImportMaxima,
    handleOpenMaximaClick
  };
}
