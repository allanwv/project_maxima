import { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  value: string;
  type?: 'text' | 'number' | 'date';
  className?: string;
  onSave: (val: string) => void;
  title?: string;
  displayValue?: string;
  onValidate?: (val: string) => string | null;
  autoEdit?: boolean;
}

export function EditableCell({ value, displayValue, type = 'text', className = '', onSave, title, onValidate, autoEdit }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-enter edit mode when autoEdit is true
  useEffect(() => {
    if (autoEdit && !isEditing) {
      setIsEditing(true);
      setEditValue(value);
    }
  }, [autoEdit]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type !== 'date') {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    if (editValue !== value) {
      if (onValidate) {
        const err = onValidate(editValue);
        if (err) {
          setError(err);
          // Focus back to input
          setTimeout(() => inputRef.current?.focus(), 0);
          return;
        }
      }
      onSave(editValue);
    }
    setError(null);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value);
      setError(null);
    }
  };

  if (isEditing) {
    return (
      <div className="relative w-full h-full">
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            if (error) setError(null);
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`w-full h-full px-1 bg-white border ${error ? 'border-red-500' : 'border-blue-400'} focus:outline-none focus:ring-1 ${error ? 'focus:ring-red-500' : 'focus:ring-blue-500'} rounded text-xs ${type === 'number' ? 'text-right' : ''}`}
        />
        {error && (
          <div className="absolute z-50 left-0 bottom-full mb-1 w-max max-w-[250px] bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-normal leading-tight">
            {error}
          </div>
        )}
      </div>
    );
  }

  const finalDisplay = displayValue !== undefined ? displayValue : value;

  return (
    <div
      onDoubleClick={() => setIsEditing(true)}
      title={title || finalDisplay || 'Doble clic para editar'}
      className={`w-full h-full cursor-text hover:bg-gray-100 flex items-center ${className}`}
    >
      <span className="w-full truncate">{finalDisplay || '\u00A0'}</span>
    </div>
  );
}
