import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLeads } from "@/hooks/useLeads";
import { useCreateLead, useDeleteLead, useUpdateLead } from "@/hooks/useLeads";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LeadForm } from "@/components/leads/LeadForm";
import { CsvImport } from "@/components/leads/CsvImport";
import { Mail, Phone, MoreHorizontal } from "lucide-react";

type StatusFilter = string | "all";

export function LeadsPage() {
  const navigate = useNavigate();
  const { data: leads, isLoading } = useLeads();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();

  const [showForm, setShowForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter((lead) => {
      const matchesStatus =
        statusFilter === "all" || lead.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.toLowerCase().includes(q) ||
        (lead.company ?? "").toLowerCase().includes(q) ||
        (lead.phone ?? "").includes(q) ||
        (lead.email ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [leads, statusFilter, searchQuery]);

  async function handleDelete() {
    if (!deleteConfirm) return;
    await deleteLead.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  }

  async function handleStatusChange(leadId: string, newStatus: string) {
    await updateLead.mutateAsync({ id: leadId, status: newStatus as any });
  }

  return (
    <div className="flex flex-col h-full w-full select-none bg-[var(--ods-bg-primary)]">
      {/* Twenty-style 40px Action & Filter Bar */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-[var(--ods-border)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--ods-text-primary)]">All Leads</span>
          <span className="text-[11px] font-medium text-[var(--ods-text-secondary)] px-1.5 py-0.5 rounded-[4px] bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)]">
            {leads?.length ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="h-7 px-2.5 rounded-[6px] text-[12px] font-medium bg-[var(--ods-brand-600)] text-white hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            + New lead
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
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Last Called</th>
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
              <tr key={lead.id} className="h-8 hover:bg-[var(--ods-bg-secondary)] transition-colors group">
                <td className="w-8 px-2 text-center">
                  <input type="checkbox" className="rounded-[3px] border-[var(--ods-border)] accent-[var(--ods-brand-600)] opacity-0 group-hover:opacity-100 focus:opacity-100" />
                </td>
                <td className="px-3 text-[13px] font-medium text-[var(--ods-text-primary)] truncate max-w-[200px] cursor-pointer hover:text-[var(--ods-brand-600)]" onClick={() => navigate(`/leads/${lead.id}`)}>
                  {lead.first_name} {lead.last_name}
                </td>
                <td className="px-3 text-[13px] text-[var(--ods-text-secondary)] truncate max-w-[180px]">{lead.company ?? "—"}</td>
                <td className="px-3 text-[13px] text-[var(--ods-text-secondary)] font-mono">{lead.phone ?? "—"}</td>
                <td className="px-3">
                  <select
                    value={lead.status}
                    onChange={(e) => handleStatusChange(lead.id, e.target.value)}
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
                  {lead.last_called_at ? new Date(lead.last_called_at).toLocaleDateString() : "—"}
                </td>
                <td className="w-16 px-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={`tel:${lead.phone}`} className="p-1 text-[var(--ods-text-secondary)] hover:text-[var(--ods-brand-600)]" title="Call">
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="p-1 text-[var(--ods-text-secondary)] hover:text-[var(--ods-brand-600)]" title="Email">
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => setDeleteConfirm({ id: lead.id, name: `${lead.first_name} ${lead.last_name}` })} className="p-1 text-[var(--ods-text-secondary)] hover:text-red-600" title="Delete">
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
            await createLead.mutateAsync(data as any);
            setShowForm(false);
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
