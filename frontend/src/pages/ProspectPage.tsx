import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LeadForm } from "@/components/leads/LeadForm";
import { CsvImport } from "@/components/leads/CsvImport";
import { Search, Plus, Mail, Phone, MoreHorizontal, RefreshCw } from "lucide-react";

type StatusFilter = string | "all";

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

export function ProspectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: prospects, isLoading, refetch } = useQuery<Prospect[]>({
    queryKey: ["prospects"],
    queryFn: async () => {
      return api.prospects.list();
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const filteredProspects = useMemo(() => {
    if (!prospects) return [];
    return prospects.filter((prospect) => {
      const matchesStatus =
        statusFilter === "all" || prospect.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        `${prospect.first_name ?? ""} ${prospect.last_name ?? ""}`.toLowerCase().includes(q) ||
        (prospect.company ?? "").toLowerCase().includes(q) ||
        (prospect.phone ?? "").includes(q) ||
        (prospect.email ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [prospects, statusFilter, searchQuery]);

  async function handleDelete() {
    if (!deleteConfirm) return;
    await api.prospects.delete(deleteConfirm.id);
    queryClient.invalidateQueries({ queryKey: ["prospects"] });
    setDeleteConfirm(null);
  }

  async function handleStatusChange(prospectId: string, newStatus: string) {
    await api.prospects.update(prospectId, { status: newStatus as any });
    queryClient.invalidateQueries({ queryKey: ["prospects"] });
  }

  async function handleSyncFromTwenty() {
    setSyncing(true);
    try {
      const token = localStorage.getItem("cold-dialer-token");
      const res = await fetch("/api/sync/inbound", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      
      // Log detailed response info
      console.log("[sync] Response status:", res.status);
      const text = await res.text();
      console.log("[sync] Response body:", text);
      
      if (!res.ok) {
        throw new Error(`Sync failed (${res.status}): ${text}`);
      }
      
      const data = JSON.parse(text);
      console.log("[sync] Sync result:", data);
      
      await queryClient.invalidateQueries({ queryKey: ["prospects"] });
    } catch (err: any) {
      console.error("[sync] Full error:", err);
      alert(`Sync error: ${err.message || String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col h-full w-full select-none bg-[var(--ods-bg-primary)]">
      {/* Twenty-style 40px Action Bar */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-[var(--ods-border)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--ods-text-primary)]">All Prospects</span>
          <span className="text-[11px] font-medium text-[var(--ods-text-secondary)] px-1.5 py-0.5 rounded-[4px] bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)]">
            {prospects?.length ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncFromTwenty}
            disabled={syncing}
            className="h-7 px-2.5 rounded-[6px] text-[12px] font-medium border border-[var(--ods-border)] text-[var(--ods-text-primary)] hover:bg-[var(--ods-bg-secondary)] transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="h-7 px-2.5 rounded-[6px] text-[12px] font-medium bg-[var(--ods-brand-600)] text-white hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            + New prospect
          </button>
        </div>
      </div>

      {/* Flush Full-Bleed Table */}
      <div className="flex-1 w-full overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-[var(--ods-bg-secondary)] z-10">
            <tr className="h-8 border-b border-[var(--ods-border)]">
              <th className="w-8 px-2 text-center">
                <input type="checkbox" className="rounded-[3px] border-[var(--ods-border)] accent-[var(--ods-brand-600)]" />
              </th>
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Name</th>
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Company</th>
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Phone</th>
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Status</th>
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Source</th>
              <th className="w-16 px-3 text-right text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ods-border)]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-[13px] text-[var(--ods-text-secondary)]">
                  Loading...
                </td>
              </tr>
            ) : prospects?.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-[13px] text-[var(--ods-text-secondary)]">
                  No prospects yet. Click "Sync" to import from Twenty.
                </td>
              </tr>
            ) : filteredProspects.map((prospect) => (
              <tr key={prospect.id} className="h-8 hover:bg-[var(--ods-bg-secondary)] transition-colors group">
                <td className="w-8 px-2 text-center">
                  <input type="checkbox" className="rounded-[3px] border-[var(--ods-border)] accent-[var(--ods-brand-600)] opacity-0 group-hover:opacity-100 focus:opacity-100" />
                </td>
                <td className="px-3 text-[13px] font-medium text-[var(--ods-text-primary)] truncate max-w-[200px] cursor-pointer hover:text-[var(--ods-brand-600)]" onClick={() => navigate(`/leads/${prospect.id}`)}>
                  {prospect.first_name} {prospect.last_name}
                </td>
                <td className="px-3 text-[13px] text-[var(--ods-text-secondary)] truncate max-w-[180px]">{prospect.company ?? "—"}</td>
                <td className="px-3 text-[13px] text-[var(--ods-text-secondary)] font-mono">{prospect.phone ?? "—"}</td>
                <td className="px-3">
                  <select
                    value={prospect.status}
                    onChange={(e) => handleStatusChange(prospect.id, e.target.value)}
                    className="text-[11px] font-medium bg-transparent border-none cursor-pointer text-[var(--ods-text-primary)] focus:ring-0"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="interested">Interested</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="callback">Callback</option>
                    <option value="converted">Converted</option>
                    <option value="do_not_contact">DNC</option>
                  </select>
                </td>
                <td className="px-3 text-[13px] text-[var(--ods-text-secondary)]">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)] text-[var(--ods-text-primary)]">
                    {prospect.source || "Twenty"}
                  </span>
                </td>
                <td className="w-16 px-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={`tel:${prospect.phone}`} className="p-1 text-[var(--ods-text-secondary)] hover:text-[var(--ods-brand-600)]" title="Call">
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    {prospect.email && (
                      <a href={`mailto:${prospect.email}`} className="p-1 text-[var(--ods-text-secondary)] hover:text-[var(--ods-brand-600)]" title="Email">
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => setDeleteConfirm({ id: prospect.id, name: `${prospect.first_name} ${prospect.last_name}` })} className="p-1 text-[var(--ods-text-secondary)] hover:text-red-600" title="Delete">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <LeadForm
          onClose={() => setShowForm(false)}
          onSubmit={async (data) => {
            await api.prospects.create(data as any);
            queryClient.invalidateQueries({ queryKey: ["prospects"] });
            setShowForm(false);
          }}
        />
      )}

      {showCsvImport && (
        <CsvImport
          onClose={() => setShowCsvImport(false)}
          onImport={async (rows) => {
            for (const row of rows) {
              await api.prospects.create(row as any);
            }
            queryClient.invalidateQueries({ queryKey: ["prospects"] });
            setShowCsvImport(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Prospect"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
