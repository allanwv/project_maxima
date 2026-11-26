import { Upload, FileJson, Undo, Redo, Save, Calendar, ZoomIn, ZoomOut, ChevronDown, FileCode2, Pencil, FolderOpen, FilePlus2, Layers, Trash2, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { GanttProject } from '../../domain/models';
import { SavedLocalProject } from '../../domain/localProjects';

interface HeaderProps {
  project: GanttProject;
  onNewProject?: () => void;
  savedProjects?: SavedLocalProject[];
  onSelectLocalProject?: (projectId: string) => void;
  onDeleteLocalProject?: (projectId: string) => void;
  onImportXml: (xml: string) => void;
  onImportMaxima: (json: string) => void;
  importState: 'idle' | 'importing' | 'error' | 'success';
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isDirty: boolean;
  setIsDirty: (val: boolean) => void;
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onSetZoomPreset?: (preset: 'DIA' | 'SEMANA' | 'MES') => void;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  onRenameProject?: (name: string) => void;
  currentFile?: import('@/types/fileSystem').CurrentFile;
  onSaveOverwrite?: () => Promise<boolean>;
  onSaveCopy?: () => Promise<void>;
  onExportHtml?: () => Promise<void>;
  onOpenMaximaClick?: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved';
}

export function Header({
  project, onNewProject, savedProjects = [], onSelectLocalProject, onDeleteLocalProject,
  onImportXml, onImportMaxima, importState,
  canUndo, canRedo, onUndo, onRedo, isDirty, setIsDirty,
  zoomLevel = 32, onZoomIn, onZoomOut, onSetZoomPreset, canZoomIn, canZoomOut,
  onRenameProject, currentFile, onSaveOverwrite, onSaveCopy, onExportHtml, onOpenMaximaClick, saveStatus
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!showSaveModal && !showNewProjectModal && !showProjectsModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSaveModal(false);
        setShowNewProjectModal(false);
        setShowProjectsModal(false);
        setConfirmDeleteProjectId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSaveModal, showNewProjectModal, showProjectsModal]);

  const formatSavedDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('es-CL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return '';
    }
  };

  const handleNewProjectClick = () => {
    if (isDirty || project.tasks.length > 0) {
      setShowNewProjectModal(true);
    } else {
      onNewProject?.();
    }
  };

  const handleNameSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== project.name) {
      onRenameProject?.(trimmed);
    } else {
      setEditName(project.name);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setEditName(project.name);
      setIsEditingName(false);
    }
  };

  const startEditingName = () => {
    setEditName(project.name);
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  };

  const handleXmlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        onImportXml(event.target.result);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMaximaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        onImportMaxima(event.target.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="relative z-50 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
          <Calendar className="text-white" size={18} />
        </div>
        {isEditingName ? (
          <input
            ref={nameInputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleNameKeyDown}
            className="text-xl font-semibold text-gray-900 tracking-tight bg-white border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[500px]"
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-1.5 group/name cursor-pointer" onDoubleClick={startEditingName}>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight truncate max-w-[500px]" title={currentFile?.name ? currentFile.name : project.name}>{project.name}</h1>
            <button
              onClick={startEditingName}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 opacity-0 group-hover/name:opacity-100 transition-opacity"
              title="Renombrar proyecto"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
        {saveStatus === 'saving' ? (
          <span className="text-xs text-blue-500 font-medium animate-pulse">Guardando...</span>
        ) : saveStatus === 'saved' ? (
          <span className="text-xs text-blue-500 font-medium">Guardado</span>
        ) : isDirty ? (
          <span className="text-xs text-gray-500 font-medium">Cambios sin guardar</span>
        ) : (
          <span className="text-xs text-gray-400 font-medium">Sin cambios</span>
        )}
        {importState === 'importing' && (
          <span className="text-sm text-blue-500 animate-pulse">Importando...</span>
        )}
        {importState === 'success' && (
          <span className="text-sm text-green-600">Importación exitosa.</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Editor Controls */}
        <div className="flex items-center border border-gray-200 rounded-md bg-gray-50 mr-2 shadow-sm">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Deshacer (Ctrl+Z)"
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-l-md border-r border-gray-200"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Rehacer (Ctrl+Shift+Z)"
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-r-md"
          >
            <Redo size={16} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Zoom Controls */}
        <div className="flex items-center border border-gray-200 rounded-md bg-gray-50 shadow-sm mr-2">
          <div className="flex bg-gray-100 p-0.5 rounded-l-md border-r border-gray-200">
            <button
              onClick={() => onSetZoomPreset?.('DIA')}
              className={`px-2 py-1 text-xs font-medium rounded-sm transition-all ${zoomLevel >= 24 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Día
            </button>
            <button
              onClick={() => onSetZoomPreset?.('SEMANA')}
              className={`px-2 py-1 text-xs font-medium rounded-sm transition-all ${(zoomLevel >= 6 && zoomLevel < 24) ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Semana
            </button>
            <button
              onClick={() => onSetZoomPreset?.('MES')}
              className={`px-2 py-1 text-xs font-medium rounded-sm transition-all ${zoomLevel < 6 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Mes
            </button>
          </div>
          <button
            onClick={onZoomOut}
            disabled={!canZoomOut}
            title="Alejar"
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-r border-gray-200"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={onZoomIn}
            disabled={!canZoomIn}
            title="Acercar"
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-r-md"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1" />        {/* Hidden inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleXmlChange}
          accept=".xml"
          className="hidden"
        />
        <input
          type="file"
          id="hidden-maxima-input"
          onChange={handleMaximaChange}
          accept=".json,.maxima.json"
          className="hidden"
        />

        <div className="flex items-stretch bg-gray-100 rounded-md shadow-sm border border-gray-200 relative z-40">
          <button
            disabled={!isDirty}
            onClick={async () => {
              if (currentFile?.type === 'maxima' && currentFile.handle) {
                const success = await onSaveOverwrite?.();
                if (!success) {
                  setShowSaveModal(true);
                }
              } else {
                setShowSaveModal(true);
              }
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 font-medium text-sm transition-colors rounded-l-md border-r border-gray-200 ${!isDirty
                ? 'text-gray-400 cursor-not-allowed opacity-70'
                : 'text-gray-700 hover:bg-gray-200'
              }`}
            title={!isDirty ? 'No hay cambios para guardar' : 'Guardar cambios'}
          >
            <Save size={16} />
            <span>Guardar</span>
          </button>

          <div className="relative group flex">
            <button
              className="px-1.5 py-1.5 text-gray-700 hover:bg-gray-200 transition-colors rounded-r-md flex items-center h-full"
              title="Más opciones"
            >
              <ChevronDown size={14} className="opacity-70" />
            </button>
            {/* Dropdown Menu */}
            <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={onSaveCopy}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 rounded-t-md"
              >
                <FileJson size={14} className="text-blue-600" />
                JSON (compatible)
              </button>
              <button
                onClick={onExportHtml}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 rounded-b-md"
              >
                <FileCode2 size={14} className="text-orange-500" />
                Exportar HTML
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setConfirmDeleteProjectId(null);
            setShowProjectsModal(true);
          }}
          disabled={importState === 'importing'}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
          title="Proyectos guardados en este navegador"
        >
          <Layers size={16} />
          <span>Proyectos</span>
          {savedProjects.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-[11px] leading-none rounded-full bg-gray-100 text-gray-600 font-semibold">
              {savedProjects.length}
            </span>
          )}
        </button>

        <button
          onClick={handleNewProjectClick}
          disabled={importState === 'importing'}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
          title="Nuevo proyecto en blanco"
        >
          <FilePlus2 size={16} />
          <span>Nuevo</span>
        </button>

        <button
          onClick={onOpenMaximaClick}
          disabled={importState === 'importing'}
          className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
          title="Abrir proyecto Maxima"
        >
          <FolderOpen size={16} />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importState === 'importing'}
          className="flex items-center space-x-2 px-4 py-1.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          <Upload size={16} />
          <span>Importar XML</span>
        </button>
      </div>

      {/* Modal Proyectos Guardados */}
      {showProjectsModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20"
          onClick={() => {
            setShowProjectsModal(false);
            setConfirmDeleteProjectId(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">Proyectos en este navegador</h3>
                <p className="text-xs text-gray-400">
                  Se guardan automáticamente aquí. Exporta a `.maxima.json` para respaldar en disco.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowProjectsModal(false);
                  setConfirmDeleteProjectId(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {isDirty && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  El proyecto actual tiene cambios sin exportar a `.maxima.json`, pero seguirá guardado aquí en el navegador si cambias a otro.
                </div>
              )}
              {savedProjects.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  Aún no hay proyectos guardados en este navegador.
                </p>
              ) : (
                <div className="space-y-2">
                  {savedProjects.map((entry) => {
                    const isActive = entry.id === project.id;
                    const isConfirming = confirmDeleteProjectId === entry.id;
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                          isActive
                            ? 'bg-blue-50/60 border-blue-200'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <button
                          onClick={() => {
                            if (!isActive) {
                              onSelectLocalProject?.(entry.id);
                            }
                            setShowProjectsModal(false);
                            setConfirmDeleteProjectId(null);
                          }}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{entry.name}</span>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-700 rounded">
                                <Check size={11} />
                                Activo
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {entry.taskCount} {entry.taskCount === 1 ? 'tarea' : 'tareas'} · {formatSavedDate(entry.updatedAt)}
                          </div>
                        </button>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isConfirming ? (
                            <>
                              <button
                                onClick={() => {
                                  onDeleteLocalProject?.(entry.id);
                                  setConfirmDeleteProjectId(null);
                                }}
                                className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                              >
                                Eliminar
                              </button>
                              <button
                                onClick={() => setConfirmDeleteProjectId(null)}
                                className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteProjectId(entry.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar de este navegador"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <button
                onClick={() => {
                  setShowProjectsModal(false);
                  setConfirmDeleteProjectId(null);
                  onNewProject?.();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                <FilePlus2 size={15} />
                <span>Nuevo proyecto en blanco</span>
              </button>
              <button
                onClick={() => {
                  setShowProjectsModal(false);
                  setConfirmDeleteProjectId(null);
                }}
                className="px-3 py-1.5 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-md font-medium text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Proyecto */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20" onClick={() => setShowNewProjectModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-96 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 text-sm">Crear proyecto en blanco</h3>
              <button onClick={() => setShowNewProjectModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                {isDirty
                  ? 'Tienes cambios sin exportar a archivo `.maxima.json`, aunque el proyecto actual seguirá guardado en este navegador dentro de «Proyectos».'
                  : 'El proyecto actual seguirá disponible en «Proyectos» dentro de este navegador.'}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-md font-medium text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setShowNewProjectModal(false);
                    onNewProject?.();
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-medium text-sm transition-colors"
                >
                  Crear en blanco
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Guardar */}
      {showSaveModal && currentFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20" onClick={() => setShowSaveModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-80 overflow-visible" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 text-sm">Guardar cambios</h3>
              <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="p-4 space-y-3">

              <div className="space-y-2 relative">
                <div className="group/btn relative">
                  <button
                    onClick={() => { onSaveOverwrite?.(); setShowSaveModal(false); }}
                    disabled={currentFile.type !== 'maxima'}
                    className="w-full text-left px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed font-medium text-sm transition-colors"
                  >
                    Sobrescribir
                  </button>
                  {currentFile.type === 'xml-import' && (
                    <div className="hidden group-hover/btn:block absolute left-full ml-2 top-0 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10 pointer-events-none">
                      Los proyectos XML importados deben guardarse primero como archivo Maxima.
                    </div>
                  )}
                  {currentFile.type === 'new' && (
                    <div className="hidden group-hover/btn:block absolute left-full ml-2 top-0 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10 pointer-events-none">
                      Aún no hay un archivo asociado. Utiliza 'Guardar copia'.
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { onSaveCopy?.(); setShowSaveModal(false); }}
                  className="w-full text-left px-3 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-md font-medium text-sm transition-colors"
                >
                  Guardar copia
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
