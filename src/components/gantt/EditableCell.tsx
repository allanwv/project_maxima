import { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  value: string;
  type?: 'text' | 'number' | 'date';
  className?: string;
  onSave: (val: string) => void;
  title?: string;
  displayValue?: string;
}

export function EditableCell({ value, displayValue, type = 'text', className = '', onSave, title }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setIsEditing(false);
    if (editValue !== value) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`w-full h-full px-1 bg-white border border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded text-xs ${type === 'number' ? 'text-right' : ''}`}
      />
    );
  }

  const finalDisplay = displayValue !== undefined ? displayValue : value;

  return (
    <div
      onDoubleClick={() => setIsEditing(true)}
      title={title || finalDisplay || 'Doble clic para editar'}
      className={`w-full h-full cursor-text hover:bg-gray-100 flex items-center ${className}`}
    >
      <span className="w-full truncate">{finalDisplay}</span>
    </div>
  );
}
