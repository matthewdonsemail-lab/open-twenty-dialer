import React, { useState } from "react";
import { BookOpen, AlertTriangle, Search, Plus } from "lucide-react";
import { PageCanvas } from "@/components/common/PageCanvas";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { Button } from "@/components/ui/Button";
import { useScripts, Script } from "@/hooks/useScripts";
import { useCreateScript, useDeleteScript } from "@/hooks/useScripts";

export function ScriptsPage() {
  const { data: scripts, isLoading } = useScripts();
  const createScript = useCreateScript();
  const deleteScript = useDeleteScript();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [activeObjection, setActiveObjection] = useState<string | null>(null);

  const filtered = (scripts || []).filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.scriptData?.category?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const objections = selectedScript
    ? Object.entries(selectedScript.scriptData?.objection_responses ?? {})
    : [];

  const handleCreateScript = () => {
    const newScript: Partial<Script> = {
      name: "New Script",
      campaignId: null,
      scriptData: {
        content: "",
        category: "General",
        objection_responses: {},
      },
    };
    createScript.mutate(newScript);
  };

  const handleDeleteScript = (id: string) => {
    deleteScript.mutate(id);
    if (selectedScript?.id === id) {
      setSelectedScript(null);
    }
  };

  return (
    <PageCanvas
      title="Call Scripts"
      maxWidth="6xl"
      actions={
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />
            <input
              type="text"
              placeholder="Search scripts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-[12px] border border-[var(--ods-border)] rounded-[4px] bg-[var(--ods-bg-primary)] text-[var(--ods-text-primary)] placeholder:text-[var(--ods-text-tertiary)] outline-none focus:border-[var(--ods-brand-500)]"
            />
          </div>
          <Button size="sm" onClick={handleCreateScript} disabled={createScript.isPending}>
            <Plus className="w-3.5 h-3.5" />
            New Script
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-[var(--ods-text-tertiary)]">Loading scripts...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {filtered.map((script) => (
              <button
                key={script.id}
                onClick={() => {
                  setSelectedScript(script);
                  setActiveObjection(null);
                }}
                className="text-left bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)] rounded-[6px] p-4 hover:border-[var(--ods-brand-500)] transition-colors relative group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[var(--ods-brand-600)]" />
                    <h3 className="text-[13px] font-semibold text-[var(--ods-text-primary)]">{script.name}</h3>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteScript(script.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[var(--ods-text-tertiary)] hover:text-red-500 transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[var(--ods-bg-primary)] border border-[var(--ods-border)] text-[var(--ods-text-secondary)]">
                    {script.scriptData?.category || "General"}
                  </span>
                  {script.campaignId && (
                    <span className="inline-block px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[var(--ods-brand-500)/10] text-[var(--ods-brand-600)]">
                      Campaign
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {selectedScript && (
            <WidgetCard
              title={selectedScript.name}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteScript(selectedScript.id)}
                  disabled={deleteScript.isPending}
                >
                  Delete
                </Button>
              }
              className="mb-6"
            >
              <div className="space-y-4">
                <span className="inline-block px-2.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[var(--ods-bg-primary)] border border-[var(--ods-border)] text-[var(--ods-text-secondary)]">
                  {selectedScript.scriptData?.category || "General"}
                </span>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)] mb-2 block">
                    Script Content
                  </label>
                  <div className="bg-[var(--ods-bg-primary)] rounded-[4px] p-3 border border-[var(--ods-border)]">
                    <p className="text-[13px] text-[var(--ods-text-primary)] leading-relaxed whitespace-pre-wrap">
                      {selectedScript.scriptData?.content || "No content yet"}
                    </p>
                  </div>
                </div>
                {selectedScript.scriptData?.objection_responses && Object.keys(selectedScript.scriptData.objection_responses).length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)] mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Common Objections & Responses
                    </h3>
                    <div className="space-y-2">
                      {objections.map(([objection, data]: [string, any]) => (
                        <div key={objection}>
                          <button
                            onClick={() =>
                              setActiveObjection(
                                activeObjection === objection ? null : objection
                              )
                            }
                            className="w-full text-left p-3 rounded-[4px] border border-[var(--ods-border)] hover:border-[var(--ods-brand-500)] hover:bg-[var(--ods-bg-primary)] transition text-[12px]"
                          >
                            <span className="font-medium text-[var(--ods-text-primary)]">"{objection}"</span>
                            <span className="text-[11px] text-[var(--ods-text-tertiary)] ml-2">{data.category}</span>
                          </button>
                          {activeObjection === objection && (
                            <div className="mt-1 p-3 bg-[var(--ods-bg-primary)] rounded-[4px] border border-[var(--ods-brand-200)] text-[12px] text-[var(--ods-text-primary)]">
                              {data.response}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </WidgetCard>
          )}

          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <BookOpen className="w-8 h-8 text-[var(--ods-text-tertiary)] mx-auto mb-3" />
              <p className="text-[13px] text-[var(--ods-text-tertiary)]">
                {searchQuery ? "No scripts found matching your search" : "No scripts yet. Create your first script!"}
              </p>
            </div>
          )}
        </>
      )}
    </PageCanvas>
  );
}
