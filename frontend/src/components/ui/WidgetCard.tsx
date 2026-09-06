import React from "react";

interface WidgetCardProps {
  title?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function WidgetCard({
  title,
  icon: Icon,
  action,
  children,
  className = "",
}: WidgetCardProps) {
  return (
    <div
      className={`bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)] rounded-[6px] flex flex-col overflow-hidden ${className}`}
    >
      {title && (
        <div className="h-8 min-h-[32px] px-3 border-b border-[var(--ods-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />}
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">
              {title}
            </span>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-3 md:p-4 flex-1">{children}</div>
    </div>
  );
}
