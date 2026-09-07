import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCallLogs } from "@/hooks/useCallLogs";
import { Search, Phone, User } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Spokes } from "@/components/ui/Spinner";
import type { Database } from "@/types/database";
import { api } from "@/lib/apiClient";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type CallLog = Database["public"]["Tables"]["call_logs"]["Row"];

export function CallHistoryPage() {
  const navigate = useNavigate();
  const { data: callLogs, isLoading } = useCallLogs();
  const [searchQuery, setSearchQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");

  const leadIds = [...new Set((callLogs ?? []).map((l) => l.lead_id).filter(Boolean))];
  const { data: leadsMap } = useQuery<Record<string, Lead>>({
    queryKey: ["leads", "batch", ...leadIds],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      const leads = await api.leads.list();
      const map: Record<string, Lead> = {};
      leads.forEach((l: Lead) => { map[l.id] = l; });
      return map;
    },
    enabled: leadIds.length > 0,
    staleTime: Infinity,
  });

  // Fetch all users/profiles
  const { data: profiles } = useQuery<Profile[]>({
    queryKey: ["profiles"],
    queryFn: async () => {
      const res = await api.profiles.list();
      return res as Profile[];
    },
    staleTime: Infinity,
  });

  const profilesMap = useMemo(() => {
    if (!profiles) return {};
    const map: Record<string, Profile> = {};
    profiles.forEach((p) => { map[p.id] = p; });
    return map;
  }, [profiles]);

  const filtered = useMemo(() => {
    if (!callLogs) return [];
    return callLogs.filter((log) => {
      const matchesOutcome = outcomeFilter === "all" || log.outcome === outcomeFilter;
      const q = searchQuery.toLowerCase();
      const lead = log.lead_id ? leadsMap?.[log.lead_id] : null;
      const leadName = lead ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.toLowerCase() : "";
      const user = log.user_id ? profilesMap?.[log.user_id] : null;
      const userName = user?.full_name?.toLowerCase() || "";
      const matchesSearch = !q || leadName.includes(q) || (log.notes ?? "").toLowerCase().includes(q) || userName.includes(q);
      return matchesOutcome && matchesSearch;
    });
  }, [callLogs, outcomeFilter, searchQuery, leadsMap, profilesMap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spokes className="h-8 w-8 text-[var(--ods-brand-600)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full select-none bg-[var(--ods-bg-primary)]">
      {/* Twenty-style Action Bar */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-[var(--ods-border)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--ods-text-primary)]">Call History</span>
          <span className="text-[11px] font-medium text-[var(--ods-text-secondary)] px-1.5 py-0.5 rounded-[4px] bg-[var(--ods-bg-secondary)] border border-[var(--ods-border)]">
            {filtered.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
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
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="px-3 py-1.5 text-[12px] border border-[var(--ods-border)] rounded-[4px] bg-[var(--ods-bg-primary)] text-[var(--ods-text-primary)] outline-none focus:border-[var(--ods-brand-500)] appearance-none cursor-pointer"
          >
            <option value="all">All Outcomes</option>
            <option value="answered">Answered</option>
            <option value="no_answer">No Answer</option>
            <option value="busy">Busy</option>
            <option value="voicemail">Voicemail</option>
            <option value="dnc">DNC</option>
            <option value="wrong_number">Wrong Number</option>
            <option value="disconnected">Disconnected</option>
          </select>
        </div>
      </div>

      {/* Flush Full-Bleed Table */}
      <div className="flex-1 w-full overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-[var(--ods-bg-secondary)] z-10">
            <tr className="h-8 border-b border-[var(--ods-border)]">
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Agent</th>
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Lead</th>
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Outcome</th>
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Duration</th>
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Notes</th>
              <th className="px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--ods-text-secondary)]">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ods-border)]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-[13px] text-[var(--ods-text-secondary)]">
                  No call records found
                </td>
              </tr>
            ) : filtered.map((log) => {
              const lead = log.lead_id ? leadsMap?.[log.lead_id] : null;
              const leadName = lead ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.phone || "—" : "—";
              const user = log.user_id ? profilesMap?.[log.user_id] : null;
              const agentName = user?.full_name || "Unknown";

              return (
                <tr
                  key={log.id}
                  onClick={() => navigate(`/history/${log.id}`)}
                  className="h-8 hover:bg-[var(--ods-bg-secondary)] transition-colors cursor-pointer"
                >
                  <td className="px-3">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />
                      <span className="text-[13px] font-medium truncate max-w-[150px] cursor-pointer hover:text-[var(--ods-brand-600)] transition-colors">{agentName}</span>
                    </div>
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[var(--ods-text-tertiary)]" />
                      <span className="text-[13px] font-medium text-[var(--ods-text-primary)] truncate max-w-[200px]">{leadName}</span>
                    </div>
                  </td>
                  <td className="px-3"><StatusBadge status={log.outcome} /></td>
                  <td className="px-3 text-[13px] text-[var(--ods-text-secondary)]">{log.duration_seconds}s</td>
                  <td className="px-3 text-[13px] text-[var(--ods-text-secondary)] max-w-xs truncate">{log.notes ?? "—"}</td>
                  <td className="px-3 text-[12px] text-[var(--ods-text-tertiary)]">{log.created_at ? new Date(log.created_at).toLocaleString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
