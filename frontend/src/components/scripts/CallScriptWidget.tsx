import React, { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { useScripts, Script } from "@/hooks/useScripts";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { Badge } from "@/components/ui/Badge";
import { Spokes } from "@/components/ui/Spinner";

interface CallScriptWidgetProps {
  campaignId?: string | null;
}

export function CallScriptWidget({ campaignId }: CallScriptWidgetProps) {
  const [activeObjection, setActiveObjection] = useState<string | null>(null);
  const { data: scripts, isLoading } = useScripts();

  const script = scripts?.find((s: Script) => s.campaignId === campaignId) || scripts?.[0] || null;

  if (isLoading) {
    return (
      <WidgetCard title="Call Script" icon={BookOpen} className="h-full min-h-[460px]">
        <div className="flex items-center justify-center h-48">
          <Spokes className="w-5 h-5 text-[var(--ods-brand-600)]" />
        </div>
      </WidgetCard>
    );
  }

  if (!script) {
    return (
      <WidgetCard title="Call Script" icon={BookOpen} className="h-full min-h-[460px]">
        <div className="flex flex-col items-center justify-center h-48 text-center px-4">
          <BookOpen className="w-8 h-8 text-[var(--ods-text-tertiary)] opacity-40 mb-2" />
          <p className="text-[13px] text-[var(--ods-text-secondary)]">No script assigned</p>
          <p className="text-[11px] text-[var(--ods-text-tertiary)] mt-1">
            Assign a campaign with an active script to preview talking points here.
          </p>
        </div>
      </WidgetCard>
    );
  }

  const objections = Object.entries(script.scriptData?.objection_responses ?? {});
  const content = script.scriptData?.content || "";
  const category = script.scriptData?.category || "General";

  return (
    <WidgetCard
      title={script.name || "Call Script"}
      icon={BookOpen}
      action={<Badge variant="blue">{category}</Badge>}
      className="h-full flex flex-col min-h-[460px]"
    >
      <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] pr-1">
        {content && (
          <div className="p-3 bg-[var(--ods-bg-primary)] border border-[var(--ods-border)] rounded-[6px]">
            <p className="text-[13px] leading-relaxed text-[var(--ods-text-primary)] whitespace-pre-wrap">
              {content}
            </p>
          </div>
        )}

        {objections.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 px-0.5">
              <HelpCircle className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">
                Objection Rebuttals
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {objections.map(([objection, data]: [string, any]) => {
                const isOpen = activeObjection === objection;
                return (
                  <div
                    key={objection}
                    className="border border-[var(--ods-border)] rounded-[6px] overflow-hidden bg-[var(--ods-bg-primary)]"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveObjection(isOpen ? null : objection)}
                      className="w-full flex items-center justify-between p-2.5 text-left hover:bg-[var(--ods-bg-secondary)] transition text-[12px]"
                    >
                      <span className="font-medium text-[var(--ods-text-primary)]">"{objection}"</span>
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)] shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)] shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="p-2.5 bg-[var(--ods-bg-secondary)] border-t border-[var(--ods-border)] text-[12px] leading-relaxed text-[var(--ods-text-secondary)]">
                        {typeof data === "string" ? data : data?.response}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
