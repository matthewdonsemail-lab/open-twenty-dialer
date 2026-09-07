import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Plus, Edit3, Trash2, Search, Target, Clock } from "lucide-react";
import { PageCanvas } from "@/components/common/PageCanvas";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { api } from "@/lib/apiClient";
import { Spokes } from "@/components/ui/Spinner";

type AgencyCampaign = {
  id: string;
  name?: string;
  utmSource?: string;
  status?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function CampaignPage() {
  const { data: campaigns, isLoading } = useQuery<AgencyCampaign[]>({
    queryKey: ["twentyCampaigns"],
    queryFn: async () => {
      return api.twentyCampaigns.list();
    },
    staleTime: Infinity,
  });

  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<AgencyCampaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<AgencyCampaign | null>(null);

  const filtered = useMemo(() => {
    if (!campaigns) return [];
    return campaigns.filter((c) => {
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || (c.name ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [campaigns, statusFilter, searchQuery]);

  async function handleDelete(campaign: AgencyCampaign) {
    // TODO: implement Twenty API delete
    setDeleteConfirm(null);
  }

  return (
    <PageCanvas
      title="Campaigns"
      actions={
        <>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-[12px] border border-[var(--ods-border)] rounded-[4px] bg-[var(--ods-bg-primary)] text-[var(--ods-text-primary)] placeholder:text-[var(--ods-text-tertiary)] outline-none focus:border-[var(--ods-brand-500)]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-[12px] border border-[var(--ods-border)] rounded-[4px] bg-[var(--ods-bg-primary)] text-[var(--ods-text-primary)] outline-none focus:border-[var(--ods-brand-500)] appearance-none cursor-pointer"
          >
            <option value="all">All</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="DRAFT">Draft</option>
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--ods-brand-600)] rounded-[4px] hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            New Campaign
          </button>
        </>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spokes className="h-8 w-8 text-[var(--ods-brand-600)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-[var(--ods-text-secondary)] bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)] rounded-[6px]">
          No campaigns found in Twenty CRM
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((campaign) => (
            <WidgetCard
              key={campaign.id}
              title={campaign.name || "Unnamed Campaign"}
              action={<StatusBadge status={(campaign.status as any) || "DRAFT"} />}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[12px] text-[var(--ods-text-secondary)]">
                  <Target className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />
                  <span className="capitalize">{campaign.utmSource || "outbound"}</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[var(--ods-text-secondary)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />
                  <span>Created {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "—"}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--ods-border)]">
                <button
                  onClick={() => setEditingCampaign(campaign)}
                  className="flex items-center gap-1 text-[11px] text-[var(--ods-brand-600)] hover:text-[var(--ods-brand-700)] font-medium"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => setDeleteConfirm(campaign)}
                  className="flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-medium ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </WidgetCard>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--ods-bg-primary)] rounded-[6px] p-4 w-full max-w-md">
            <h3 className="text-[13px] font-semibold mb-4">New Campaign</h3>
            <p className="text-[12px] text-[var(--ods-text-secondary)]">Create campaign in Twenty CRM (integration pending)</p>
            <button
              onClick={() => setShowForm(false)}
              className="mt-4 px-3 py-1.5 text-[12px] bg-[var(--ods-bg-secondary)] rounded-[4px] hover:bg-[var(--ods-border)]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Campaign"
        message="Delete this campaign from Twenty CRM?"
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </PageCanvas>
  );
}
