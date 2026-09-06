import React, { useState, useRef, useEffect } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  FloatingPortal,
} from "@floating-ui/react";
import { ChevronDown } from "lucide-react";

export interface StatusOption {
  value: string;
  label: string;
  dotColor: string;
  bgTint: string;
  textColor: string;
}

export const STATUS_CONFIG: Record<string, StatusOption> = {
  new: { value: "new", label: "New", dotColor: "bg-blue-500", bgTint: "bg-blue-500/10", textColor: "text-blue-700" },
  contacted: { value: "contacted", label: "Contacted", dotColor: "bg-indigo-500", bgTint: "bg-indigo-500/10", textColor: "text-indigo-700" },
  interested: { value: "interested", label: "Interested", dotColor: "bg-amber-500", bgTint: "bg-amber-500/10", textColor: "text-amber-700" },
  not_interested: { value: "not_interested", label: "Not Interested", dotColor: "bg-gray-400", bgTint: "bg-gray-400/10", textColor: "text-gray-600" },
  callback: { value: "callback", label: "Callback", dotColor: "bg-purple-500", bgTint: "bg-purple-500/10", textColor: "text-purple-700" },
  converted: { value: "converted", label: "Converted", dotColor: "bg-emerald-500", bgTint: "bg-emerald-500/10", textColor: "text-emerald-700" },
  do_not_contact: { value: "do_not_contact", label: "DNC", dotColor: "bg-rose-500", bgTint: "bg-rose-500/10", textColor: "text-rose-700" },
};

interface StatusSelectProps {
  value?: string;
  onChange: (newValue: string) => void;
  disabled?: boolean;
}

export function StatusSelect({ value = "new", onChange, disabled }: StatusSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const current = STATUS_CONFIG[value] || STATUS_CONFIG.new;
  const pendingRef = useRef<string | null>(null);

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  });

  const handleOptionClick = (optionValue: string) => {
    pendingRef.current = optionValue;
    setIsOpen(false);
  };

  // Fire onChange when menu closes
  useEffect(() => {
    if (!isOpen && pendingRef.current) {
      onChange(pendingRef.current);
      pendingRef.current = null;
    }
  }, [isOpen, onChange]);

  return (
    <>
      <button
        ref={refs.setReference}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={`h-5 inline-flex items-center gap-1.5 px-2 rounded-[4px] text-[11px] font-medium border border-[var(--ods-border)] ${current.bgTint} ${current.textColor} hover:brightness-95 transition-all select-none`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${current.dotColor}`} />
        <span>{current.label}</span>
        <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-[60] w-40 py-1 bg-[var(--ods-bg-primary)] border border-[var(--ods-border)] rounded-[6px] shadow-lg flex flex-col gap-0.5 select-none"
          >
            {Object.values(STATUS_CONFIG).map((option) => (
              <div
                key={option.value}
                onClick={() => handleOptionClick(option.value)}
                className={`h-7 px-2.5 mx-1 rounded-[4px] flex items-center gap-2 text-[12px] cursor-pointer transition-colors ${
                  option.value === value
                    ? "bg-[var(--ods-bg-secondary)] font-medium text-[var(--ods-text-primary)]"
                    : "text-[var(--ods-text-secondary)] hover:bg-[var(--ods-bg-secondary)] hover:text-[var(--ods-text-primary)]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${option.dotColor}`} />
                <span>{option.label}</span>
              </div>
            ))}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
