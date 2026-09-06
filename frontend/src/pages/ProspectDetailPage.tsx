import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { Softphone } from "@/components/softphone/Softphone";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatusSelect } from "@/components/common/StatusSelect";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageCanvas } from "@/components/common/PageCanvas";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ArrowLeft, Edit3, Trash2, FileText } from "lucide-react";
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
  const [editingData, setEditingData] = useState<Partial<Prospect>>({});

  const { data: prospect, isLoading } = useQuery<Prospect>({
    queryKey: ["prospect", prospectId],
    queryFn: () => api.prospects.get(prospectId ?? ""),
  });

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--ods-brand-600)]" />
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
          <StatusBadge status={prospect.status} />
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
                  onChange={handleStatusChange}
                />
              </div>

              <dl className="flex flex-col gap-[var(--ods-sp-3)]">
                {[
                  ["Company", prospect.company ?? "—"],
                  ["Phone", prospect.phone ?? "—"],
                  ["Email", prospect.email ?? "—"],
                  ["Source", prospect.source ?? "Twenty"],
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
    </PageCanvas>
  );
}