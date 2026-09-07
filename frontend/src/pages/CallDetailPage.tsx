import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { PageCanvas } from "@/components/common/PageCanvas";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Spokes } from "@/components/ui/Spinner";
import { ArrowLeft, Phone, Clock, User, FileText, Calendar } from "lucide-react";

type Lead = any;
type Profile = any;
type CallLog = any;

export function CallDetailPage() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();

  const { data: callLog, isLoading: callLoading } = useQuery<CallLog>({
    queryKey: ["callLog", callId],
    queryFn: () => api.callLogs.get(callId ?? ""),
    enabled: !!callId,
    staleTime: Infinity,
  });

  const { data: lead } = useQuery<Lead>({
    queryKey: ["lead", callLog?.lead_id],
    queryFn: () => api.leads.get(callLog?.lead_id ?? ""),
    enabled: !!callLog?.lead_id,
    staleTime: Infinity,
  });

  const { data: profile } = useQuery<Profile>({
    queryKey: ["profile", callLog?.user_id],
    queryFn: () => api.profiles.list().then((profiles: Profile[]) => profiles.find((p) => p.id === callLog?.user_id)),
    enabled: !!callLog?.user_id,
    staleTime: Infinity,
  });

  if (callLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spokes className="h-8 w-8 text-[var(--ods-brand-600)]" />
      </div>
    );
  }

  if (!callLog) {
    return (
      <div className="text-center py-12">
        <p className="text-[13px] text-[var(--ods-text-secondary)]">Call record not found</p>
        <button
          onClick={() => navigate("/history")}
          className="mt-4 text-[13px] text-[var(--ods-brand-600)] hover:text-[var(--ods-brand-700)]"
        >
          Back to Call History
        </button>
      </div>
    );
  }

  const agentName = profile?.full_name || "Unknown";
  const leadName = lead ? `${lead.first_name} ${lead.last_name}` : callLog.lead_id || "—";
  const durationMinutes = Math.floor(callLog.duration_seconds / 60);
  const durationSeconds = callLog.duration_seconds % 60;
  const duration = durationMinutes > 0 ? `${durationMinutes}m ${durationSeconds}s` : `${durationSeconds}s`;

  return (
    <PageCanvas
      title={
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/history")}
            aria-label="Back to call history"
            className="p-1 -ml-1 text-[var(--ods-text-tertiary)] hover:text-[var(--ods-text-primary)] rounded-[4px] hover:bg-[var(--ods-bg-secondary)] transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-[13px] font-semibold">Call Details</span>
        </div>
      }
      subtitle={`Call ID: ${callLog.id}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Call Information */}
        <WidgetCard title="Call Information" icon={Phone}>
          <dl className="flex flex-col gap-[var(--ods-sp-3)]">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Outcome</dt>
              <dd className="mt-1"><StatusBadge status={callLog.outcome} /></dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Duration</dt>
              <dd className="mt-1 text-[13px] text-[var(--ods-text-primary)]">{duration}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Direction</dt>
              <dd className="mt-1 text-[13px] text-[var(--ods-text-primary)] capitalize">{callLog.direction || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Started At</dt>
              <dd className="mt-1 text-[13px] text-[var(--ods-text-primary)]">
                {callLog.started_at ? new Date(callLog.started_at).toLocaleString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Ended At</dt>
              <dd className="mt-1 text-[13px] text-[var(--ods-text-primary)]">
                {callLog.ended_at ? new Date(callLog.ended_at).toLocaleString() : "—"}
              </dd>
            </div>
          </dl>
        </WidgetCard>

        {/* Participants */}
        <WidgetCard title="Participants" icon={User}>
          <dl className="flex flex-col gap-[var(--ods-sp-3)]">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Agent</dt>
              <dd className="mt-1 text-[13px] text-[var(--ods-text-primary)]">{agentName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Lead/Prospect</dt>
              <dd className="mt-1 text-[13px] text-[var(--ods-text-primary)]">{leadName}</dd>
            </div>
            {lead && (
              <>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Company</dt>
                  <dd className="mt-1 text-[13px] text-[var(--ods-text-secondary)]">{lead.company || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Phone</dt>
                  <dd className="mt-1 text-[13px] text-[var(--ods-text-secondary)] font-mono">{lead.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Email</dt>
                  <dd className="mt-1 text-[13px] text-[var(--ods-text-secondary)]">{lead.email || "—"}</dd>
                </div>
              </>
            )}
          </dl>
        </WidgetCard>

        {/* Notes */}
        <WidgetCard title="Notes" icon={FileText}>
          <p className="text-[13px] text-[var(--ods-text-secondary)] whitespace-pre-wrap min-h-[100px]">
            {callLog.notes || "No notes recorded"}
          </p>
        </WidgetCard>

        {/* Technical Details */}
        <WidgetCard title="Technical Details" icon={Calendar}>
          <dl className="flex flex-col gap-[var(--ods-sp-3)]">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">SIP Call ID</dt>
              <dd className="mt-1 text-[12px] text-[var(--ods-text-secondary)] font-mono">{callLog.sip_call_id || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Recording URL</dt>
              <dd className="mt-1 text-[12px] text-[var(--ods-text-secondary)] font-mono break-all">
                {callLog.recording_url || "No recording"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Transcript</dt>
              <dd className="mt-1 text-[12px] text-[var(--ods-text-secondary)]">
                {callLog.transcript ? "Available" : "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)]">Created At</dt>
              <dd className="mt-1 text-[13px] text-[var(--ods-text-primary)]">
                {callLog.created_at ? new Date(callLog.created_at).toLocaleString() : "—"}
              </dd>
            </div>
          </dl>
        </WidgetCard>
      </div>
    </PageCanvas>
  );
}
