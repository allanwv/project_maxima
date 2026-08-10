import { Upload, FileJson, Undo, Redo, Save, Calendar, ZoomIn, ZoomOut } from 'lucide-react';
import { useRef } from 'react';
import { GanttProject } from '../../domain/models';

interface HeaderProps {
  project: GanttProject;
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
}

export function Header({ 
  project, onImportXml, onImportMaxima, importState, 
  canUndo, canRedo, onUndo, onRedo, isDirty, setIsDirty,
  zoomLevel = 32, onZoomIn, onZoomOut, onSetZoomPreset, canZoomIn, canZoomOut
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maximaInputRef = useRef<HTMLInputElement>(null);

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
    if (maximaInputRef.current) maximaInputRef.current.value = '';
  };

  const handleSave = () => {
    const data = JSON.stringify({
      format: 'project-maxima',
      version: 1,
      project
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}.maxima.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsDirty(false);
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
          <Calendar className="text-white" size={18} />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight truncate max-w-[200px]" title={project.name}>{project.name}</h1>
        {isDirty && <span className="text-xs text-amber-500 font-medium italic">Cambios sin guardar</span>}
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

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Hidden inputs */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleXmlChange} 
          accept=".xml" 
          className="hidden" 
        />
        <input 
          type="file" 
          ref={maximaInputRef} 
          onChange={handleMaximaChange} 
          accept=".json" 
          className="hidden" 
        />

        <button 
          onClick={handleSave}
          className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md font-medium text-sm hover:bg-gray-200 transition-colors shadow-sm"
          title="Guardar localmente"
        >
          <Save size={16} />
          <span>Guardar</span>
        </button>
        
        <button 
          onClick={() => maximaInputRef.current?.click()}
          disabled={importState === 'importing'}
          className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
          title="Importar proyecto .maxima.json"
        >
          <FileJson size={16} />
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
    </header>
  );
}
