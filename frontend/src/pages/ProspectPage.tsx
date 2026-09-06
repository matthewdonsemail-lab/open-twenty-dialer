import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { StatusSelect } from "@/components/common/StatusSelect";
import { RecordIndexCommandMenu } from "@/components/common/RecordIndexCommandMenu";
import { ColumnVisibilityDropdown, ColumnDef } from "@/components/common/ColumnVisibilityDropdown";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LeadForm } from "@/components/leads/LeadForm";
import { CsvImport } from "@/components/leads/CsvImport";
import { useToast } from "@/components/ui/Toast";
import { Mail, Phone, MoreHorizontal, RefreshCw } from "lucide-react";

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
  const { success, error: toastError } = useToast();

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnDef[]>([
    { key: 'name', label: 'Name', visible: true },
    { key: 'company', label: 'Company', visible: true },
    { key: 'phone', label: 'Phone', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'source', label: 'Source', visible: true },
  ]);

  const isVisible = (key: string) => columns.find(c => c.key === key)?.visible ?? true;

  const handleColumnToggle = (key: string, visible: boolean) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, visible } : c));
  };

  const filteredProspects = useMemo(() => {
    if (!prospects) return [];
    return prospects.filter((prospect) => {
      const matchesStatus = statusFilter === "all" || prospect.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        `${prospect.first_name ?? ""} ${prospect.last_name ?? ""}`.toLowerCase().includes(q) ||
        (prospect.company ?? "").toLowerCase().includes(q) ||
        (prospect.phone ?? "").includes(q) ||
        (prospect.email ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [prospects, statusFilter, searchQuery]);

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      await api.prospects.delete(deleteConfirm.id);
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setDeleteConfirm(null);
      success("Prospect deleted", `${deleteConfirm.name} has been removed from the list`);
    } catch (err) {
      toastError("Error", "Failed to delete the prospect");
    }
  }

  async function handleStatusChange(prospectId: string, newStatus: string) {
    await api.prospects.update(prospectId, { status: newStatus as any });
    queryClient.invalidateQueries({ queryKey: ["prospects"] });
    success("Status updated", `Status changed to "${newStatus}"`);
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
      
      if (!res.ok) {
        throw new Error(`Sync failed (${res.status}): ${await res.text()}`);
      }
      
      await queryClient.invalidateQueries({ queryKey: ["prospects"] });
      success("Sync complete", "Prospects synced from Twenty");
    } catch (err: any) {
      toastError("Erreur de sync", err.message || "Impossible de synchroniser");
    } finally {
      setSyncing(false);
    }
  }

  async function handleBulkStatusChange(newStatus: string) {
    try {
      await Promise.all(Array.from(selectedIds).map(id =>
        api.prospects.update(id, { status: newStatus as any })
      ));
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      success("Status updated", `${selectedIds.size} prospect(s) updated`);
    } catch (err) {
      toastError("Erreur", "Impossible de mettre à jour les prospects");
    }
  }

  async function handleBulkDelete() {
    try {
      await Promise.all(Array.from(selectedIds).map(id => api.prospects.delete(id)));
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      success("Deleted", `${selectedIds.size} prospect(s) deleted`);
    } catch (err) {
      toastError("Error", "Failed to delete prospects");
    }
  }

  async function handleBulkEdit() {
    // Future: open a modal for batch edit
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProspects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProspects.map(p => p.id)));
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const isAllSelected = filteredProspects.length > 0 && selectedIds.size === filteredProspects.length;

  return (
    <div className="flex flex-col h-full w-full select-none bg-[var(--ods-bg-primary)]">
      {/* Twenty-style Action Bar */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-[var(--ods-border)] shrink-0">
        {selectedIds.size > 0 ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[var(--ods-text-primary)]">Prospects</span>
              <span className="text-[11px] font-medium text-[var(--ods-text-secondary)] px-1.5 py-0.5 rounded-[4px] bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)]">
                {selectedIds.size} selected
              </span>
            </div>
            <RecordIndexCommandMenu
              selectedCount={selectedIds.size}
              onClear={() => setSelectedIds(new Set())}
              onDelete={handleBulkDelete}
              onEdit={handleBulkEdit}
            />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[var(--ods-text-primary)]">All Prospects</span>
              <span className="text-[11px] font-medium text-[var(--ods-text-secondary)] px-1.5 py-0.5 rounded-[4px] bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)]">
                {filteredProspects.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ColumnVisibilityDropdown
                columns={columns}
                onChange={handleColumnToggle}
              />
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
          </>
        )}
      </div>

      {/* Flush Full-Bleed Table */}
      <div className="flex-1 w-full overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-[var(--ods-bg-secondary)] z-10">
            <tr className="h-8 border-b border-[var(--ods-border)]">
              <th className="w-8 px-2 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded-[3px] border-[var(--ods-border)] accent-[var(--ods-brand-600)]"
                />
              </th>
              {isVisible('name') && <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Name</th>}
              {isVisible('company') && <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Company</th>}
              {isVisible('phone') && <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Phone</th>}
              {isVisible('status') && <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Status</th>}
              {isVisible('source') && <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Source</th>}
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
              <tr key={prospect.id} className={`h-8 transition-colors ${selectedIds.has(prospect.id) ? 'bg-[var(--ods-bg-secondary)]' : 'hover:bg-[var(--ods-bg-secondary)]'}`}>
                <td className="w-8 px-2 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(prospect.id)}
                    onChange={() => toggleRow(prospect.id)}
                    className="rounded-[3px] border-[var(--ods-border)] accent-[var(--ods-brand-600)]"
                  />
                </td>
                {isVisible('name') && (
                  <td className="px-3 text-[13px] font-medium text-[var(--ods-text-primary)] truncate max-w-[200px] cursor-pointer hover:text-[var(--ods-brand-600)]" onClick={() => navigate(`/prospects/${prospect.id}`)}>
                    {prospect.first_name} {prospect.last_name}
                  </td>
                )}
                {isVisible('company') && (
                  <td className="px-3 text-[13px] text-[var(--ods-text-secondary)] truncate max-w-[180px]">{prospect.company ?? "—"}</td>
                )}
                {isVisible('phone') && (
                  <td className="px-3 text-[13px] text-[var(--ods-text-secondary)] font-mono">{prospect.phone ?? "—"}</td>
                )}
                {isVisible('status') && (
                  <td className="px-3">
                    <StatusSelect
                      value={prospect.status}
                      onChange={(newStatus) => handleStatusChange(prospect.id, newStatus)}
                    />
                  </td>
                )}
                {isVisible('source') && (
                  <td className="px-3 text-[13px] text-[var(--ods-text-secondary)]">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)] text-[var(--ods-text-primary)]">
                      {prospect.source || "Twenty"}
                    </span>
                  </td>
                )}
                <td className="w-16 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
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
            success("Prospect created", `${data.first_name} ${data.last_name} has been added`);
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
            success("Import complete", `${rows.length} prospect(s) imported`);
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
