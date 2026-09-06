import React, { useState } from "react";
import { BookOpen, AlertTriangle, Search } from "lucide-react";
import { PageCanvas } from "@/components/common/PageCanvas";
import { WidgetCard } from "@/components/ui/WidgetCard";
import type { Database } from "@/types/database";

type Script = Database["public"]["Tables"]["call_scripts"]["Row"];

const SAMPLE_SCRIPT: Script = {
  id: "sample",
  title: "Cold Outreach Script — Medical Practices",
  category: "Medical",
  content: "Good morning, this is Luke from your company. I'm reaching out because we help specialty practices like yours streamline operations and reduce overhead. Do you have a few minutes to discuss how we can save your practice time and money each month?",
  objection_responses: {
    "We're happy with our current billing": {
      response: "That's great to hear. Many of our clients felt the same way until they saw our average 30% reduction in denied claims. Could I show you a quick comparison?",
      category: "satisfaction",
    },
    "I don't have time right now": {
      response: "I completely understand. This is a 15-minute conversation that could save hours each week. When would be a better time — tomorrow or later this week?",
      category: "time",
    },
    "Send me an email instead": {
      response: "I'd love to send over our case study, but a quick call is much faster. I can show you real numbers from practices just like yours. Would 10 minutes tomorrow work?",
      category: "deferral",
    },
    "We just changed billing companies": {
      response: "That's great! When they're ready, or if the new vendor doesn't meet expectations, I'd love to have a conversation. Mind if I follow up in 3 months?",
      category: "timing",
    },
  },
  campaign_id: null,
  created_by: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function ScriptsPage() {
  const [scripts] = useState<Script[]>([SAMPLE_SCRIPT]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [activeObjection, setActiveObjection] = useState<string | null>(null);

  const filtered = scripts.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const objections = selectedScript
    ? Object.entries(selectedScript.objection_responses ?? {})
    : [];

  return (
    <PageCanvas
      title="Call Scripts"
      maxWidth="6xl"
      actions={
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
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {filtered.map((script) => (
          <button
            key={script.id}
            onClick={() => {
              setSelectedScript(script);
              setActiveObjection(null);
            }}
            className="text-left bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)] rounded-[6px] p-4 hover:border-[var(--ods-brand-500)] transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-[var(--ods-brand-600)]" />
              <h3 className="text-[13px] font-semibold text-[var(--ods-text-primary)]">{script.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[var(--ods-bg-primary)] border border-[var(--ods-border)] text-[var(--ods-text-secondary)]">
                {script.category}
              </span>
              {script.is_active && (
                <span className="inline-block px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-emerald-500/10 text-emerald-700">
                  Active
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {selectedScript && (
        <WidgetCard title={selectedScript.title} className="mb-6">
          <div className="space-y-4">
            <span className="inline-block px-2.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[var(--ods-bg-primary)] border border-[var(--ods-border)] text-[var(--ods-text-secondary)]">
              {selectedScript.category}
            </span>
            <div className="bg-[var(--ods-bg-primary)] rounded-[4px] p-3 border border-[var(--ods-border)]">
              <p className="text-[13px] text-[var(--ods-text-primary)] leading-relaxed whitespace-pre-wrap">
                {selectedScript.content}
              </p>
            </div>
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
          </div>
        </WidgetCard>
      )}
    </PageCanvas>
  );
}
