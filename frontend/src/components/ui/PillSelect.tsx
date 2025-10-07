import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface PillOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface PillSelectProps {
  options: PillOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

const PillSelect: React.FC<PillSelectProps> = ({ options, value, onChange, placeholder = 'Select', className = '', disabled = false, ariaLabel }) => {
  const [open, setOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => options.find(o => o.value === value), [options, value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen(prev => !prev)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-full bg-white text-gray-700 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-60 ${open ? 'ring-2 ring-blue-300' : ''}`}
      >
        <span className="truncate max-w-[11rem]" title={selected?.label || placeholder}>{selected?.label || placeholder}</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div role="listbox" tabIndex={-1} aria-label={ariaLabel} className="absolute right-0 z-20 mt-2 min-w-[12rem] max-h-60 overflow-auto rounded-xl bg-white shadow-lg ring-1 ring-black/5 p-1">
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">No options</div>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              disabled={opt.disabled}
              onClick={() => handleSelect(opt.value)}
              className={`w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${opt.value === value ? 'bg-blue-100 text-blue-800' : 'text-gray-700'} ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PillSelect;


