import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { Softphone } from "@/components/softphone/Softphone";
import { CallScriptViewer } from "@/components/scripts/CallScriptViewer";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatusSelect } from "@/components/common/StatusSelect";
import { mapLeadProspectStatusOptions } from "@/lib/twentyOptions";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageCanvas } from "@/components/common/PageCanvas";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { ArrowLeft, Edit3, Trash2, FileText, Phone, Mail, Globe, MapPin } from "lucide-react";
import { Spokes } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";

interface Prospect {
  id: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  email?: string;
  status?: string;
  source?: string;
  campaign_id?: string | null;
  campaign_type?: string;
  notes?: string;
  dnc?: boolean;
  sync_id?: string;
  created_at?: string;
  updated_at?: string;
}

export function ProspectDetailPage() {
  const { prospectId } = useParams<{ prospectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [editingData, setEditingData] = useState<Partial<Prospect>>({});

  // Fetch campaigns to resolve campaign_id to name
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => api.campaigns.list(),
    staleTime: Infinity,
  });

  const { data: prospect, isLoading } = useQuery<Prospect>({
    queryKey: ["prospect", prospectId],
    queryFn: () => api.prospects.get(prospectId ?? ""),
    staleTime: 0,
  });

  const campaignName = prospect?.campaign_id ? campaigns?.find(c => c.id === prospect.campaign_id)?.name : undefined;

  React.useEffect(() => {
    if (prospect) console.log("ProspectDetailPage data:", JSON.stringify(prospect, null, 2));
    if (prospect) console.log("ProspectDetailPage campaign_id:", prospect.campaign_id);
  }, [prospect]);

  // Fetch status options from Twenty CRM
  const { data: meta } = useQuery<{ fields: Record<string, Array<{ label: string; value: string; color: string }>> }>({
    queryKey: ["twenty-meta", "agencyProspects"],
    queryFn: async () => api.twentyMeta.fields("agencyProspects"),
    staleTime: Infinity,
  });

  const statusOptions = meta?.fields["coldCallStatus"]
    ? mapLeadProspectStatusOptions(meta.fields["coldCallStatus"])
    : [];

  const updateProspect = useMutation({
    mutationFn: (data: Partial<Prospect>) => api.prospects.update(prospectId ?? "", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect", prospectId] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setShowEdit(false);
      success("Prospect updated", "Changes have been saved");
    },
    onError: () => {
      toastError("Error", "Failed to update prospect");
    },
  });

  const deleteProspect = useMutation({
    mutationFn: () => api.prospects.delete(prospectId ?? ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      navigate("/prospects");
    },
    onError: () => {
      toastError("Error", "Failed to delete prospect");
    },
  });

  async function handleCallEnd(data: { outcome: string; duration: number; notes: string; direction: "outbound" | "inbound" }) {
    // Future: add call logging for prospects
    console.log("Call ended:", data);

    // Update prospect status based on call outcome
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
    if (newStatus && prospect) {
      try {
        await api.prospects.update(prospect.id, { status: newStatus as any });
        queryClient.invalidateQueries({ queryKey: ["prospect", prospectId] });
        queryClient.invalidateQueries({ queryKey: ["prospects"] });
        success("Status updated", `Status changed to "${newStatus}"`);
      } catch {
        toastError("Error", "Failed to update status");
      }
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!prospect) return;
    try {
      await api.prospects.update(prospect.id, { status: newStatus as any });
      queryClient.invalidateQueries({ queryKey: ["prospect", prospectId] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
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

  if (!prospect) {
    return (
      <div className="text-center py-12">
        <p className="text-[13px] text-[var(--ods-text-secondary)]">Prospect not found</p>
        <button
          onClick={() => navigate("/prospects")}
          className="mt-4 text-[13px] text-[var(--ods-brand-600)] hover:text-[var(--ods-brand-700)]"
        >
          Back to Prospects
        </button>
      </div>
    );
  }

  return (
    <PageCanvas
      title={
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/prospects")}
            aria-label="Back to prospects"
            className="p-1 -ml-1 text-[var(--ods-text-tertiary)] hover:text-[var(--ods-text-primary)] rounded-ods-sm hover:bg-[var(--ods-bg-secondary)] transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span>
            {prospect.first_name} {prospect.last_name}
          </span>
          <StatusBadge status={prospect.status ?? "unknown"} />
        </div>
      }
      subtitle={prospect.company ?? "No company"}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => setShowEdit(true)} title="Edit" aria-label="Edit prospect">
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} title="Delete" aria-label="Delete prospect">
            <Trash2 className="w-4 h-4" />
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--ods-sp-6)]">
        <div className="lg:col-span-2 flex flex-col gap-[var(--ods-sp-6)]">
          <Softphone lead={prospect as any} onCallEnd={handleCallEnd} />

          <WidgetCard title="Call Script" icon={FileText}>
            <button
              onClick={() => setShowScript(true)}
              className="text-[13px] text-[var(--ods-brand-600)] hover:text-[var(--ods-brand-700)] font-medium"
            >
              View Script →
            </button>
          </WidgetCard>

          <WidgetCard title="Notes" icon={FileText}>
            <p className="text-[13px] text-[var(--ods-text-secondary)] whitespace-pre-wrap">
              {prospect.notes ?? "No notes yet"}
            </p>
          </WidgetCard>
        </div>

        <div className="flex flex-col gap-[var(--ods-sp-6)]">
          <WidgetCard title="Prospect Details">
            <div className="flex flex-col gap-[var(--ods-sp-4)]">
              {/* Status with StatusSelect */}
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)] mb-2">
                  Status
                </dt>
                <StatusSelect
                  value={prospect.status || "new"}
                  options={statusOptions}
                  onChange={handleStatusChange}
                />
              </div>

              {/* Industry Badge */}
              {prospect.source && (
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)] mb-2">
                    Industry
                  </dt>
                  <Badge variant="indigo">{prospect.source}</Badge>
                </div>
              )}

              {/* Campaign Badge */}
              {prospect.campaign_id && (
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-tertiary)] mb-2">
                    Campaign
                  </dt>
                  <Badge variant="blue">{campaignName || prospect.campaign_id.substring(0, 8) + "..."}</Badge>
                </div>
              )}

              <dl className="flex flex-col gap-[var(--ods-sp-3)]">
                {[
                  ["Company", prospect.company ?? "—"],
                  ["Phone", prospect.phone ?? "—"],
                  ["Email", prospect.email ?? "—"],
                  ["City", prospect.city ?? "—"],
                  ["State", prospect.state ?? "—"],
                  ["Created", prospect.created_at ? new Date(prospect.created_at).toLocaleDateString() : "—"],
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

          <WidgetCard title="Contact Info">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--ods-sp-3)]">
              {prospect.phone && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Phone className="w-4 h-4 text-[var(--ods-text-tertiary)]" />
                  <a href={`tel:${prospect.phone}`} className="text-[var(--ods-text-secondary)] hover:text-[var(--ods-brand-600)]" target="_blank" rel="noopener noreferrer">
                    {prospect.phone}
                  </a>
                </div>
              )}
              {prospect.email && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Mail className="w-4 h-4 text-[var(--ods-text-tertiary)]" />
                  <a href={`mailto:${prospect.email}`} className="text-[var(--ods-text-secondary)] hover:text-[var(--ods-brand-600)]" target="_blank" rel="noopener noreferrer">
                    {prospect.email || "—"}
                  </a>
                </div>
              )}
              {prospect.website && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Globe className="w-4 h-4 text-[var(--ods-text-tertiary)]" />
                  <a href={prospect.website} className="text-[var(--ods-text-secondary)] hover:text-[var(--ods-brand-600)]" target="_blank" rel="noopener noreferrer">
                    {prospect.website}
                  </a>
                </div>
              )}
              {(prospect.address || prospect.city || prospect.state || prospect.zip) && (
                <div className="flex items-center gap-2 text-[13px]">
                  <MapPin className="w-4 h-4 text-[var(--ods-text-tertiary)]" />
                  <span className="text-[var(--ods-text-secondary)]">
                    {[prospect.address, prospect.city, prospect.state, prospect.zip].filter(Boolean).join(", ") || "—"}
                  </span>
                </div>
              )}
            </div>
          </WidgetCard>
        </div>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Prospect">
        <div className="flex flex-col gap-[var(--ods-sp-4)]">
          <input
            type="text"
            placeholder="First Name"
            value={editingData.first_name ?? prospect.first_name ?? ""}
            onChange={(e) => setEditingData({ ...editingData, first_name: e.target.value })}
            className="w-full px-[var(--ods-sp-3)] py-2 border border-[var(--ods-border)] rounded-ods-sm text-[13px] bg-[var(--ods-bg-primary)] text-[var(--ods-text-primary)]"
          />
          <input
            type="text"
            placeholder="Last Name"
            value={editingData.last_name ?? prospect.last_name ?? ""}
            onChange={(e) => setEditingData({ ...editingData, last_name: e.target.value })}
            className="w-full px-[var(--ods-sp-3)] py-2 border border-[var(--ods-border)] rounded-ods-sm text-[13px] bg-[var(--ods-bg-primary)] text-[var(--ods-text-primary)]"
          />
          <input
            type="text"
            placeholder="Company"
            value={editingData.company ?? prospect.company ?? ""}
            onChange={(e) => setEditingData({ ...editingData, company: e.target.value })}
            className="w-full px-[var(--ods-sp-3)] py-2 border border-[var(--ods-border)] rounded-ods-sm text-[13px] bg-[var(--ods-bg-primary)] text-[var(--ods-text-primary)]"
          />
          <textarea
            placeholder="Notes"
            value={editingData.notes ?? prospect.notes ?? ""}
            onChange={(e) => setEditingData({ ...editingData, notes: e.target.value })}
            className="w-full px-[var(--ods-sp-3)] py-2 border border-[var(--ods-border)] rounded-ods-sm text-[13px] min-h-[100px] bg-[var(--ods-bg-primary)] text-[var(--ods-text-primary)]"
          />
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="primary" onClick={() => updateProspect.mutateAsync(editingData)} isLoading={updateProspect.isPending}>
            Save
          </Button>
          <Button variant="secondary" onClick={() => setShowEdit(false)}>
            Cancel
          </Button>
        </div>
      </Modal>

      {showDeleteConfirm && (
        <ConfirmDialog
          open={showDeleteConfirm}
          title="Delete Prospect"
          message={`Are you sure you want to delete "${prospect.first_name} ${prospect.last_name}"? This action cannot be undone.`}
          variant="danger"
          confirmLabel="Delete"
          onConfirm={() => deleteProspect.mutateAsync()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showScript && <CallScriptViewer onClose={() => setShowScript(false)} campaignId={prospect?.campaign_id ?? null} />}
    </PageCanvas>
  );
}