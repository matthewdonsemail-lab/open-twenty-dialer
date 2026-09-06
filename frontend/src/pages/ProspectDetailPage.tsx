import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { Softphone } from "@/components/softphone/Softphone";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ArrowLeft, Edit3, Trash2, Phone, Clock, Mail, Globe, MapPin, FileText, Calendar } from "lucide-react";
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
  const [showScript, setShowScript] = useState(false);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Prospect not found</p>
        <button onClick={() => navigate("/prospects")} className="mt-4 text-brand-600 hover:text-brand-700 text-sm">
          Back to Prospects
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/prospects")} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {prospect.first_name} {prospect.last_name}
            </h1>
            <StatusBadge status={prospect.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {prospect.company ?? "No company"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEdit(true)} className="p-2 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-brand-50 transition" title="Edit">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Softphone lead={prospect as any} onCallEnd={handleCallEnd} />
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-brand-600" />
              <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{prospect.notes ?? "No notes yet"}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Prospect Details</h2>
            <dl className="space-y-3">
              {[
                ["Company", prospect.company ?? "—"],
                ["Phone", prospect.phone ?? "—"],
                ["Email", prospect.email ?? "—"],
                ["Source", prospect.source ?? "Twenty"],
                ["Status", prospect.status ?? "—"],
                ["Created", prospect.created_at ? new Date(prospect.created_at).toLocaleDateString() : "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-gray-400 uppercase">{label}</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{value as string}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Edit Prospect</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="First Name"
                value={prospect.first_name ?? ""}
                onChange={(e) => setEditingData({ ...editingData, first_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Last Name"
                value={prospect.last_name ?? ""}
                onChange={(e) => setEditingData({ ...editingData, last_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Company"
                value={prospect.company ?? ""}
                onChange={(e) => setEditingData({ ...editingData, company: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <textarea
                placeholder="Notes"
                value={prospect.notes ?? ""}
                onChange={(e) => setEditingData({ ...editingData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[100px]"
              />
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => updateProspect.mutateAsync(editingData)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700"
              >
                Save
              </button>
              <button
                onClick={() => setShowEdit(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
