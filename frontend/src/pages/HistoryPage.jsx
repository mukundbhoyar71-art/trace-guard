import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Clock,
  Filter,
  LogIn,
  Database,
  CheckCircle2,
  Smartphone,
  FileText,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { securityService } from '../services/securityService';

const ACTIVITY_FILTERS = [
  { label: 'All Activities', value: null },
  { label: 'Logins', value: 'USER_LOGIN' },
  { label: 'Breach Scans', value: 'BREACH_SCAN_COMPLETED' },
  { label: 'Demo Scans', value: 'DEMO_SCAN_COMPLETED' },
  { label: 'Remediation Actions', value: 'RECOMMENDATION_UPDATED' },
  { label: 'External Audits', value: 'EXTERNAL_CHECK_LOGGED' },
  { label: 'App Permissions', value: 'PERMISSION_AUDITED' },
  { label: 'PDF Reports', value: 'REPORT_GENERATED' },
];

export const HistoryPage = ({ embedded = false }) => {
  const [activities, setActivities] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivities = useCallback(async (isRefresh = false, targetPage = page, targetFilter = selectedFilter) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await securityService.getActivities(targetPage, 15, targetFilter);
      setActivities(data?.items || []);
      setTotal(data?.total || 0);
      setPage(data?.page || 1);
      setTotalPages(data?.total_pages || 1);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, selectedFilter]);

  useEffect(() => {
    fetchActivities(false, page, selectedFilter);
  }, [fetchActivities, page, selectedFilter]);

  const handleFilterChange = (filterVal) => {
    setSelectedFilter(filterVal);
    setPage(1);
  };

  const getActivityIcon = (type, status) => {
    switch (type) {
      case 'USER_LOGIN':
        return <LogIn className="w-4 h-4 text-blue-400" />;
      case 'BREACH_SCAN_COMPLETED':
        return <Database className="w-4 h-4 text-emerald-400" />;
      case 'DEMO_SCAN_COMPLETED':
        return <Database className="w-4 h-4 text-amber-400" />;
      case 'RECOMMENDATION_UPDATED':
        return <CheckCircle2 className="w-4 h-4 text-indigo-400" />;
      case 'EXTERNAL_CHECK_LOGGED':
        return <ShieldCheck className="w-4 h-4 text-purple-400" />;
      case 'PERMISSION_AUDITED':
      case 'PERMISSION_MODIFIED':
      case 'PERMISSION_DELETED':
        return <Smartphone className="w-4 h-4 text-cyan-400" />;
      case 'REPORT_GENERATED':
        return <FileText className="w-4 h-4 text-teal-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'warning':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'danger':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default:
        return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header (omitted when embedded inside ScanHistoryPage) */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#292D32]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">Security Activity Timeline</h1>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Zero-Knowledge Log
              </span>
            </div>
            <p className="text-sm text-[#9CA3AF] mt-1">
              Immutable chronological telemetry across authentications, scans, external audits, and remediation actions.
            </p>
          </div>

          <button
            onClick={() => fetchActivities(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-300 hover:text-white border border-[#292D32] transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* Privacy Guarantee Banner */}
      <div className="bg-[#101214] border border-[#292D32] rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white block mb-0.5">Privacy Assurance:</span>
          Zero-knowledge activity logging is strictly enforced. Passwords, cryptographic session hashes, and sensitive API secrets are never stored or displayed in the activity timeline.
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-slate-500 mr-1" />
        {ACTIVITY_FILTERS.map((f) => {
          const isActive = selectedFilter === f.value;
          return (
            <button
              key={f.label}
              onClick={() => handleFilterChange(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#151719] text-slate-400 hover:text-white border border-[#292D32]'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Activities Timeline */}
      <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#292D32]">
          <h2 className="text-base font-semibold text-white">Event Log</h2>
          <span className="text-xs text-slate-400">{total} Total Events</span>
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Loading activity timeline...</span>
          </div>
        ) : activities.length > 0 ? (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#292D32]">
            {activities.map((act) => {
              const meta = act.metadata_json || {};
              return (
                <div key={act.id} className="relative group">
                  {/* Timeline Node Bullet */}
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#151719] border border-[#292D32] flex items-center justify-center group-hover:border-indigo-500 transition-colors">
                    {getActivityIcon(act.activity_type, act.status)}
                  </div>

                  <div className="bg-[#151719] border border-[#292D32] rounded-xl p-4 space-y-2 group-hover:border-slate-700 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{act.title}</span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getStatusBadge(
                            act.status
                          )}`}
                        >
                          {act.status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(act.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">{act.description}</p>

                    {/* Filtered Safe Metadata Pill display */}
                    {Object.keys(meta).length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {Object.entries(meta).map(([k, v]) => (
                          <span
                            key={k}
                            className="text-[10px] bg-[#101214] text-slate-400 px-2 py-0.5 rounded border border-[#292D32]"
                          >
                            <b className="text-slate-300">{k}:</b> {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-slate-500 text-xs">
            No events found matching the active filter.
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-[#292D32] text-xs">
            <span className="text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-[#151719] text-slate-300 hover:text-white disabled:opacity-40 border border-[#292D32]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-[#151719] text-slate-300 hover:text-white disabled:opacity-40 border border-[#292D32]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
