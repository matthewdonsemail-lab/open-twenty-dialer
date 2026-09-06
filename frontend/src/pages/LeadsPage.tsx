import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLeads } from "@/hooks/useLeads";
import { useCreateLead, useDeleteLead, useUpdateLead } from "@/hooks/useLeads";
import { StatusSelect } from "@/components/common/StatusSelect";
import { RecordIndexCommandMenu } from "@/components/common/RecordIndexCommandMenu";
import { ColumnVisibilityDropdown, ColumnDef } from "@/components/common/ColumnVisibilityDropdown";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LeadForm } from "@/components/leads/LeadForm";
import { CsvImport } from "@/components/leads/CsvImport";
import { useToast } from "@/components/ui/Toast";
import { Mail, Phone } from "lucide-react";
import { ActionsMenu } from "@/components/common/ActionsMenu";

type StatusFilter = string | "all";

export function LeadsPage() {
  const navigate = useNavigate();
  const { data: leads, isLoading } = useLeads();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const { success, error: toastError } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [actionsMenuId, setActionsMenuId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnDef[]>([
    { key: 'name', label: 'Name', visible: true },
    { key: 'company', label: 'Company', visible: true },
    { key: 'phone', label: 'Phone', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'last_called', label: 'Last Called', visible: true },
  ]);

  const isVisible = (key: string) => columns.find(c => c.key === key)?.visible ?? true;

  const handleColumnToggle = (key: string, visible: boolean) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, visible } : c));
  };

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter((lead) => {
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.toLowerCase().includes(q) ||
        (lead.company ?? "").toLowerCase().includes(q) ||
        (lead.phone ?? "").includes(q) ||
        (lead.email ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [leads, statusFilter, searchQuery]);

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      await deleteLead.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
      success("Lead deleted", `${deleteConfirm.name} has been removed`);
    } catch (err) {
      toastError("Error", "Failed to delete the lead");
    }
  }

  async function handleStatusChange(leadId: string, newStatus: string) {
    await updateLead.mutateAsync({ id: leadId, status: newStatus as any });
    success("Status updated", `Status changed to "${newStatus}"`);
  }

  async function handleBulkDelete() {
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteLead.mutateAsync(id)));
      setSelectedIds(new Set());
      success("Deleted", `${selectedIds.size} lead(s) deleted`);
    } catch (err) {
      toastError("Error", "Failed to delete the leads");
    }
  }

  async function handleBulkEdit() {
    // Future: open a modal for batch edit
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const isAllSelected = filteredLeads.length > 0 && selectedIds.size === filteredLeads.length;

  return (
    <div className="flex flex-col h-full w-full select-none bg-[var(--ods-bg-primary)]">
      {/* Twenty-style Action Bar */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-[var(--ods-border)] shrink-0">
        {selectedIds.size > 0 ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[var(--ods-text-primary)]">Leads</span>
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
              <span className="text-[13px] font-semibold text-[var(--ods-text-primary)]">All Leads</span>
              <span className="text-[11px] font-medium text-[var(--ods-text-secondary)] px-1.5 py-0.5 rounded-[4px] bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)]">
                {filteredLeads.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ColumnVisibilityDropdown
                columns={columns}
                onChange={handleColumnToggle}
              />
              <button
                onClick={() => setShowForm(true)}
                className="h-7 px-2.5 rounded-[6px] text-[12px] font-medium bg-[var(--ods-brand-600)] text-white hover:opacity-90 transition-opacity flex items-center gap-1"
              >
                + New lead
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
              {isVisible('last_called') && <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Last Called</th>}
              <th className="w-16 px-3 text-right text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ods-border)]">
            {leads?.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-[13px] text-[var(--ods-text-secondary)]">
                  No leads yet
                </td>
              </tr>
            ) : filteredLeads.map((lead) => (
              <tr key={lead.id} className={`h-8 transition-colors ${selectedIds.has(lead.id) ? 'bg-[var(--ods-bg-secondary)]' : 'hover:bg-[var(--ods-bg-secondary)]'}`}>
                <td className="w-8 px-2 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={() => toggleRow(lead.id)}
                    className="rounded-[3px] border-[var(--ods-border)] accent-[var(--ods-brand-600)]"
                  />
                </td>
                {isVisible('name') && (
                  <td className="px-3 text-[13px] font-medium text-[var(--ods-text-primary)] truncate max-w-[200px] cursor-pointer hover:text-[var(--ods-brand-600)]" onClick={() => navigate(`/leads/${lead.id}`)}>
                    {lead.first_name} {lead.last_name}
                  </td>
                )}
                {isVisible('company') && (
                  <td className="px-3 text-[13px] text-[var(--ods-text-secondary)] truncate max-w-[180px]">{lead.company ?? "—"}</td>
                )}
                {isVisible('phone') && (
                  <td className="px-3 text-[13px] text-[var(--ods-text-secondary)] font-mono">{lead.phone ?? "—"}</td>
                )}
                {isVisible('status') && (
                  <td className="px-3">
                    <StatusSelect
                      value={lead.status}
                      onChange={(newStatus) => handleStatusChange(lead.id, newStatus)}
                    />
                  </td>
                )}
                {isVisible('last_called') && (
                  <td className="px-3 text-[13px] text-[var(--ods-text-secondary)]">
                    {lead.last_called_at ? new Date(lead.last_called_at).toLocaleDateString() : "—"}
                  </td>
                )}
                <td className="w-16 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <a href={`tel:${lead.phone}`} className="p-1 text-[var(--ods-text-secondary)] hover:text-[var(--ods-brand-600)]" title="Call">
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="p-1 text-[var(--ods-text-secondary)] hover:text-[var(--ods-brand-600)]" title="Email">
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <ActionsMenu
                      leadId={lead.id}
                      leadName={`${lead.first_name} ${lead.last_name}`}
                      onView={(id) => navigate(`/leads/${id}`)}
                      onDelete={(id, name) => setDeleteConfirm({ id, name })}
                    />
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
            await createLead.mutateAsync(data as any);
            setShowForm(false);
            success("Lead created", `${data.first_name} ${data.last_name} has been added`);
          }}
        />
      )}

      {showCsvImport && (
        <CsvImport
          onClose={() => setShowCsvImport(false)}
          onImport={async (rows) => {
            for (const row of rows) {
              await createLead.mutateAsync(row as any);
            }
            setShowCsvImport(false);
            success("Import complete", `${rows.length} lead(s) imported`);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Lead"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
