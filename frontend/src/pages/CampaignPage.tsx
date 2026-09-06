import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCreateCampaign } from "@/hooks/useCampaigns";
import { useDeleteCampaign } from "@/hooks/useCampaigns";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Plus, Edit3, Trash2, Search, Target, Clock } from "lucide-react";
import { PageCanvas } from "@/components/common/PageCanvas";
import { WidgetCard } from "@/components/ui/WidgetCard";
import type { Database } from "@/types/database";
import { api } from "@/lib/apiClient";
import { CampaignForm } from "@/components/campaigns/CampaignForm";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];

export function CampaignPage() {
  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      return api.campaigns.list();
    },
  });
  const createCampaign = useCreateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const filtered = useMemo(() => {
    if (!campaigns) return [];
    return campaigns.filter((c) => {
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || c.name.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [campaigns, statusFilter, searchQuery]);

  async function handleDelete(campaign: Campaign) {
    await deleteCampaign.mutateAsync(campaign.id);
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
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
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
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-[var(--ods-text-secondary)] bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)] rounded-[6px]">
          No campaigns found
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((campaign) => (
            <WidgetCard
              key={campaign.id}
              title={campaign.name}
              action={<StatusBadge status={campaign.status} />}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[12px] text-[var(--ods-text-secondary)]">
                  <Target className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />
                  <span className="capitalize">{campaign.type}</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[var(--ods-text-secondary)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />
                  <span>Created {new Date(campaign.created_at).toLocaleDateString()}</span>
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
        <CampaignForm
          onClose={() => setShowForm(false)}
          onSubmit={async (data) => {
            await createCampaign.mutateAsync(data);
            setShowForm(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Campaign"
        message="Delete this campaign? Leads will not be deleted."
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </PageCanvas>
  );
}
