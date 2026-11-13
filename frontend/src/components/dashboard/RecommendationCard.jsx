import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, AlertCircle, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import { securityService } from '../../services/securityService';

export const RecommendationCard = ({ onToast }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchRecommendations = async () => {
    try {
      const data = await securityService.getRecommendations();
      setRecommendations(data?.items || []);
    } catch (err) {
      console.error('Failed to load dashboard recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const toggleComplete = async (item) => {
    const nextStatus = item.status === 'completed' ? 'pending' : 'completed';
    setUpdatingId(item.id);
    try {
      await securityService.updateRecommendationStatus(item.id, nextStatus);
      if (onToast) {
        onToast(
          nextStatus === 'completed'
            ? `Remediation marked completed: "${item.title}"`
            : `Remediation reopened: "${item.title}"`
        );
      }
      setRecommendations((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, status: nextStatus } : r))
      );
    } catch (err) {
      if (onToast) onToast('Failed to update recommendation status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount = recommendations.filter((r) => r.status === 'pending').length;

  return (
    <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#078BFF]"></span>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Security Recommendations</span>
              <Sparkles className="w-3.5 h-3.5 text-[#00CFFF]" />
            </h2>
          </div>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {pendingCount} Pending
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Loading recommendations...</span>
          </div>
        ) : recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.slice(0, 3).map((r) => {
              const isCompleted = r.status === 'completed';
              const isUpdating = updatingId === r.id;
              const prioColor =
                r.priority === 'critical'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : r.priority === 'high'
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                  : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';

              return (
                <div
                  key={r.id}
                  onClick={() => !isUpdating && toggleComplete(r)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isCompleted
                      ? 'bg-[#101214]/40 border-[#292D32]/50 opacity-60'
                      : 'bg-[#151719] border-[#292D32] hover:border-indigo-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`text-xs font-bold ${isCompleted ? 'line-through text-slate-500' : 'text-white'}`}>
                      {r.title}
                    </span>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${prioColor}`}>
                      {r.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{r.reason || r.description}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-6 text-center">No security recommendations pending.</p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#292D32] flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">Dynamic Recommendation Engine</span>
        <Link
          to="/security-alerts"
          className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
        >
          <span>View All Advisories</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default RecommendationCard;
