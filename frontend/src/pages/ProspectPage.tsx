import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LeadForm } from "@/components/leads/LeadForm";
import { CsvImport } from "@/components/leads/CsvImport";
import { Search, Plus, Filter, Mail, Phone, MapPin, MoreHorizontal, Download, Upload, RefreshCw } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredProspects.length} of {prospects?.length ?? 0} prospects
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncFromTwenty}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            Sync from Twenty
          </button>
          <button
            onClick={() => setShowCsvImport(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition"
          >
            <Plus className="w-4 h-4" />
            New Prospect
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search prospects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="not_interested">Not Interested</option>
            <option value="callback">Callback</option>
            <option value="converted">Converted</option>
            <option value="do_not_contact">DNC</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">Loading prospects...</p>
        </div>
      ) : filteredProspects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">
            {prospects?.length === 0 ? "No prospects yet. Click 'Sync from Twenty' to import leads." : "No prospects match your filters"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProspects.map((prospect) => (
                  <tr key={prospect.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:text-brand-600" onClick={() => navigate(`/leads/${prospect.id}`)}>
                      {prospect.first_name} {prospect.last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{prospect.company ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Phone className="w-3.5 h-3.5" />
                        {prospect.phone ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={prospect.status}
                        onChange={(e) => handleStatusChange(prospect.id, e.target.value)}
                        className="text-xs border-none bg-transparent focus:ring-0 cursor-pointer"
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
                    <td className="px-4 py-3 text-gray-500">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {prospect.source || "Twenty"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <a
                          href={`tel:${prospect.phone}`}
                          className="p-1.5 text-gray-400 hover:text-brand-600 rounded"
                          title="Call"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        <a
                          href={`mailto:${prospect.email}`}
                          className="p-1.5 text-gray-400 hover:text-brand-600 rounded"
                          title="Email"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => setDeleteConfirm({ id: prospect.id, name: `${prospect.first_name} ${prospect.last_name}` })}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          title="Delete"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
