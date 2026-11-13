import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Database, KeyRound, ShieldAlert, CheckCircle2, UserCheck, Shield, Clock, ArrowRight, RefreshCw } from 'lucide-react';
import { securityService } from '../../services/securityService';

export const ActivityTimeline = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const data = await securityService.getActivities(1, 4);
        setActivities(data?.items || []);
      } catch (err) {
        console.error('Failed to load dashboard activities:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'USER_LOGIN':
        return <UserCheck className="w-3.5 h-3.5 text-blue-400" />;
      case 'BREACH_SCAN_COMPLETED':
      case 'DEMO_SCAN_COMPLETED':
        return <Database className="w-3.5 h-3.5 text-emerald-400" />;
      case 'RECOMMENDATION_UPDATED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]"></span>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Recent Security Activities
            </h2>
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#101214] text-[#9CA3AF] border border-[#292D32]">
            Zero-Knowledge
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Loading activity timeline...</span>
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-[#151719] border border-[#292D32]/70">
                <div className="p-1.5 rounded-lg bg-[#101214] border border-[#292D32] shrink-0 mt-0.5">
                  {getIcon(a.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">{a.title}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-6 text-center">No security activities recorded yet.</p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#292D32] flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">Audit Event Stream</span>
        <Link
          to="/history"
          className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
        >
          <span>View Audit History</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default ActivityTimeline;
