import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  RotateCcw,
} from 'lucide-react';
import { securityService } from '../services/securityService';

export const SecurityAlertsPage = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'completed'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await securityService.getRecommendations();
      setRecommendations(data?.items || []);
      setCompletedCount(data?.completed_count || 0);
      setPendingCount(data?.pending_count || 0);
    } catch (err) {
      console.error('Failed to load security alerts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleToggleStatus = async (item) => {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    setUpdatingId(item.id);
    try {
      await securityService.updateRecommendationStatus(item.id, newStatus);
      await fetchAlerts(true);
    } catch (err) {
      console.error('Failed to update recommendation status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredItems = recommendations.filter((r) => {
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'completed') return r.status === 'completed';
    return true;
  });

  const getPriorityBadge = (prio) => {
    switch (prio?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'medium':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#292D32]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Security Alerts & Remediation</h1>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Recommendation Engine
            </span>
          </div>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Dynamic, prioritized threat remediation actions synthesized from your breach findings, password audits, and app scopes.
          </p>
        </div>

        <button
          onClick={() => fetchAlerts(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-300 hover:text-white border border-[#292D32] transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-5 space-y-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Advisories</span>
          <div className="text-2xl font-bold text-white">{recommendations.length}</div>
          <p className="text-xs text-slate-400">Active recommendations tailored to your security posture.</p>
        </div>

        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-5 space-y-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Pending Actions</span>
          <div className="text-2xl font-bold text-rose-400">{pendingCount}</div>
          <p className="text-xs text-slate-400">Remediations awaiting implementation.</p>
        </div>

        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-5 space-y-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Remediated</span>
          <div className="text-2xl font-bold text-emerald-400">{completedCount}</div>
          <p className="text-xs text-slate-400">Threat mitigations executed and confirmed.</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-[#151719] text-slate-400 hover:text-white border border-[#292D32]'
          }`}
        >
          All Advisories ({recommendations.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'pending'
              ? 'bg-indigo-600 text-white'
              : 'bg-[#151719] text-slate-400 hover:text-white border border-[#292D32]'
          }`}
        >
          Pending Remediation ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'completed'
              ? 'bg-indigo-600 text-white'
              : 'bg-[#151719] text-slate-400 hover:text-white border border-[#292D32]'
          }`}
        >
          Completed ({completedCount})
        </button>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const isCompleted = item.status === 'completed';
            const isUpdating = updatingId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-[#101214] border rounded-xl p-5 space-y-3 transition-colors ${
                  isCompleted ? 'border-emerald-500/30 opacity-80' : 'border-[#292D32] hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getPriorityBadge(
                          item.priority
                        )}`}
                      >
                        {item.priority} Priority
                      </span>
                      <span className="text-xs uppercase text-slate-500 font-semibold">{item.category}</span>
                    </div>
                    <h3 className={`text-base font-bold ${isCompleted ? 'line-through text-slate-400' : 'text-white'}`}>
                      {item.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(item)}
                    disabled={isUpdating}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                    }`}
                  >
                    {isUpdating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isCompleted ? (
                      <RotateCcw className="w-3.5 h-3.5" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{isCompleted ? 'Reopen Action' : 'Mark Completed'}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="bg-[#151719] p-3 rounded-lg border border-[#292D32]/60">
                    <span className="text-indigo-400 font-semibold block mb-1">Threat Rationale & Impact:</span>
                    <p className="text-slate-400">{item.reason}</p>
                  </div>

                  <div className="bg-[#151719] p-3 rounded-lg border border-[#292D32]/60">
                    <span className="text-emerald-400 font-semibold block mb-1">Recommended Remediation Action:</span>
                    <p className="text-slate-400">{item.suggested_action}</p>
                  </div>
                </div>

                {isCompleted && item.completed_at && (
                  <div className="text-[11px] text-emerald-400/90 flex items-center gap-1.5 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mitigation marked completed on {new Date(item.completed_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-slate-500 text-xs bg-[#101214] border border-[#292D32] rounded-xl">
            No advisories match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityAlertsPage;
