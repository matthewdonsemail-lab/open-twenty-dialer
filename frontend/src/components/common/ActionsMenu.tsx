import React, { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  FloatingPortal,
} from "@floating-ui/react";

interface ActionsMenuProps {
  leadId: string;
  leadName: string;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string, name: string) => void;
}

export function ActionsMenu({ leadId, leadName, onView, onEdit, onDelete }: ActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  });

  return (
    <>
      <button
        ref={refs.setReference}
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-[var(--ods-text-secondary)] hover:text-[var(--ods-text-primary)] hover:bg-[var(--ods-bg-secondary)] rounded-[4px] transition-colors"
        title="Actions"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-[100] w-32 bg-[var(--ods-bg-primary)] border border-[var(--ods-border)] rounded-[6px] shadow-lg py-1 text-[12px]"
          >
            {onView && (
              <button
                onClick={() => { onView(leadId); setIsOpen(false); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[var(--ods-text-primary)] hover:bg-[var(--ods-bg-secondary)] transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />
                View
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => { onEdit(leadId); setIsOpen(false); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[var(--ods-text-primary)] hover:bg-[var(--ods-bg-secondary)] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />
                Edit
              </button>
            )}
            <button
              onClick={() => { onDelete?.(leadId, leadName); setIsOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
