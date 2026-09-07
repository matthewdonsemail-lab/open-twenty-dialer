import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLead } from "@/hooks/useLeads";
import { useCallLog } from "@/hooks/useCallLogs";
import { useCreateCallLog } from "@/hooks/useCallLogs";
import { useUpdateLead, useDeleteLead } from "@/hooks/useLeads";
import { Softphone } from "@/components/softphone/Softphone";
import { CallScriptViewer } from "@/components/scripts/CallScriptViewer";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatusSelect } from "@/components/common/StatusSelect";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageCanvas } from "@/components/common/PageCanvas";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Edit3, Trash2, Phone, Mail, Globe, MapPin, FileText } from "lucide-react";
import { Spokes } from "@/components/ui/Spinner";

export function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const { data: lead, isLoading } = useLead(leadId ?? "");
  const { data: callLogs } = useCallLog(leadId ?? "");
  const createCallLog = useCreateCallLog();
  const updateLeadMutation = useUpdateLead();
  const deleteLeadMutation = useDeleteLead();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showScript, setShowScript] = useState(false);

  function handleCallEnd(data: { outcome: string; duration: number; notes: string; direction: "outbound" | "inbound" }) {
    createCallLog.mutateAsync({
      lead_id: leadId ?? null,
      user_id: null,
      campaign_id: null,
      direction: data.direction,
      outcome: data.outcome as any,
      duration_seconds: data.duration,
      recording_url: null,
      transcript: null,
      sip_call_id: null,
      started_at: null,
      ended_at: null,
      notes: data.notes,
    });

    // Update lead status based on call outcome
    const statusMap: Record<string, string> = {
      answered: "contacted",
      busy: "callback",
      voicemail: "callback",
      dnc: "do_not_contact",
      no_answer: "callback",
      wrong_number: "not_interested",
      disconnected: "callback",
    };
    const newStatus = statusMap[data.outcome];
    if (newStatus && lead) {
      updateLeadMutation.mutateAsync({ id: lead.id, status: newStatus as any });
    }
  }

  async function handleDelete() {
    if (!lead) return;
    try {
      await deleteLeadMutation.mutateAsync(lead.id);
      success("Lead deleted", `${lead.first_name} ${lead.last_name} has been removed`);
      navigate("/leads");
    } catch {
      toastError("Error", "Failed to delete the lead");
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!lead) return;
    try {
      await updateLeadMutation.mutateAsync({ id: lead.id, status: newStatus as any });
      success("Status updated", `Status changed to "${newStatus}"`);
    } catch {
      toastError("Error", "Failed to update status");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spokes className="h-8 w-8 text-[var(--ods-brand-600)]" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-[13px] text-[var(--ods-text-secondary)]">Lead not found</p>
        <button
          onClick={() => navigate("/leads")}
          className="mt-4 text-[13px] text-[var(--ods-brand-600)] hover:text-[var(--ods-brand-700)]"
        >
          Back to Leads
        </button>
      </div>
    );
  }

  const locationLine = [lead.city, lead.state, lead.zip].filter(Boolean).join(" ");

  return (
    <PageCanvas
      title={
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/leads")}
            aria-label="Back to leads"
            className="p-1 -ml-1 text-[var(--ods-text-tertiary)] hover:text-[var(--ods-text-primary)] rounded-ods-sm hover:bg-[var(--ods-bg-secondary)] transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span>
            {lead.first_name} {lead.last_name}
          </span>
          <StatusBadge status={lead.status} />
        </div>
      }
      subtitle={`${lead.company ?? "No company"}${locationLine ? ` · ${locationLine}` : ""}`}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => setShowEdit(true)} title="Edit" aria-label="Edit lead">
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} title="Delete" aria-label="Delete lead">
            <Trash2 className="w-4 h-4" />
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--ods-sp-6)]">
        <div className="lg:col-span-2 flex flex-col gap-[var(--ods-sp-6)]">
          <Softphone lead={lead} onCallEnd={handleCallEnd} />

          <WidgetCard title="Call Script" icon={FileText}>
            <button
              onClick={() => setShowScript(true)}
              className="text-[13px] text-[var(--ods-brand-600)] hover:text-[var(--ods-brand-700)] font-medium"
            >
              View Script →
            </button>
          </WidgetCard>

          <WidgetCard title="Contact Info">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--ods-sp-3)]">
              <div className="flex items-center gap-2 text-[13px]">
                <Phone className="w-4 h-4 text-[var(--ods-text-tertiary)]" />
                <span className="text-[var(--ods-text-secondary)]">{lead.phone ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                <Mail className="w-4 h-4 text-[var(--ods-text-tertiary)]" />
                <span className="text-[var(--ods-text-secondary)]">{lead.email ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                <Globe className="w-4 h-4 text-[var(--ods-text-tertiary)]" />
                <span className="text-[var(--ods-text-secondary)]">{lead.website ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                <MapPin className="w-4 h-4 text-[var(--ods-text-tertiary)]" />
                <span className="text-[var(--ods-text-secondary)]">{lead.address ?? "—"}</span>
              </div>
            </div>
          </WidgetCard>

          <WidgetCard title="Notes">
            <p className="text-[13px] text-[var(--ods-text-secondary)] whitespace-pre-wrap">
              {lead.notes ?? "No notes yet"}
            </p>
          </WidgetCard>
        </div>

        <div className="flex flex-col gap-[var(--ods-sp-6)]">
          <WidgetCard title="Lead Details">
            <div className="flex flex-col gap-[var(--ods-sp-4)]">
              {/* Status with StatusSelect */}
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)] mb-2">
                  Status
                </dt>
                <StatusSelect
                  value={lead.status}
                  onChange={handleStatusChange}
                />
              </div>

              <dl className="flex flex-col gap-[var(--ods-sp-3)]">
                {[
                  ["Source", lead.source ?? "—"],
                  ["Company", lead.company ?? "—"],
                  ["Phone", lead.phone ?? "—"],
                  ["Email", lead.email ?? "—"],
                  ["Website", lead.website ?? "—"],
                  ["Address", lead.address ?? "—"],
                  ["City", locationLine || "—"],
                  ["Calls", String(lead.call_count ?? 0)],
                  ["Last Called", lead.last_called_at ? new Date(lead.last_called_at).toLocaleString() : "Never"],
                  ["Created", new Date(lead.created_at).toLocaleDateString()],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">
                      {label}
                    </dt>
                    <dd className="text-[13px] text-[var(--ods-text-primary)] mt-0.5">{value as string}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </WidgetCard>

          {callLogs && callLogs.length > 0 && (
            <WidgetCard title="Recent Calls">
              <div className="flex flex-col gap-[var(--ods-sp-3)]">
                {callLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="border-l-2 border-[var(--ods-brand-300)] pl-3 py-2">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={log.outcome} />
                      <span className="text-[11px] text-[var(--ods-text-tertiary)]">{log.duration_seconds}s</span>
                    </div>
                    {log.notes && (
                      <p className="text-[11px] text-[var(--ods-text-secondary)] mt-1">{log.notes}</p>
                    )}
                    <p className="text-[11px] text-[var(--ods-text-tertiary)] mt-1">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </WidgetCard>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          open={showDeleteConfirm}
          title="Delete Lead"
          message={`Delete "${lead.first_name} ${lead.last_name}"? This cannot be undone.`}
          variant="danger"
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showScript && <CallScriptViewer onClose={() => setShowScript(false)} />}

      {/* NOTE: `showEdit` opens nothing yet — same pre-existing gap as before this pass.
          This is a functional/data-wiring issue (no edit form + unknown useUpdateLead
          payload shape), not a styling one, so it's flagged here rather than guessed at. */}
    </PageCanvas>
  );
}