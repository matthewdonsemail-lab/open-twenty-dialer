import React, { useState, useRef, useEffect } from 'react';
import { Columns3, Check } from 'lucide-react';

export interface ColumnDef {
  key: string;
  label: string;
  visible: boolean;
}

interface ColumnVisibilityDropdownProps {
  columns: ColumnDef[];
  onChange: (key: string, visible: boolean) => void;
}

export const ColumnVisibilityDropdown: React.FC<ColumnVisibilityDropdownProps> = ({
  columns,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-7 px-2 text-[12px] font-medium text-[var(--ods-text-secondary,#8a8a93)] hover:text-[var(--ods-text-primary,#18181b)] hover:bg-[var(--ods-bg-secondary,#f0f0f3)] rounded-[4px] border border-[var(--ods-border,#e5e5ea)] transition-colors"
      >
        <Columns3 className="w-3.5 h-3.5" />
        <span>fields</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-[var(--ods-bg-primary,#ffffff)] border border-[var(--ods-border,#e5e5ea)] rounded-[6px] shadow-lg py-1 z-40 text-[12px]">
          <div className="px-2 py-1 text-[11px] font-semibold text-[var(--ods-text-tertiary,#8a8a93)] uppercase tracking-wider border-b border-[var(--ods-border,#e5e5ea)] mb-1">
            toggle columns
          </div>
          {columns.map((col) => (
            <button
              key={col.key}
              onClick={() => onChange(col.key, !col.visible)}
              className="flex items-center justify-between w-full px-2.5 py-1 text-left text-[var(--ods-text-primary,#18181b)] hover:bg-[var(--ods-bg-secondary,#fafafb)]"
            >
              <span>{col.label}</span>
              <div
                className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center ${
                  col.visible
                    ? 'bg-[var(--ods-brand-600,#2563eb)] border-[var(--ods-brand-600,#2563eb)] text-white'
                    : 'border-[var(--ods-border,#e5e5ea)] bg-transparent'
                }`}
              >
                {col.visible && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
