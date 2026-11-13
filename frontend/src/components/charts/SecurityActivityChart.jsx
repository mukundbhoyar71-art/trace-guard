import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Activity } from 'lucide-react';
import { securityService } from '../../services/securityService';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#101214] p-3 rounded-xl border border-[#292D32] shadow-2xl text-xs space-y-1">
        <div className="font-bold text-white mb-1">{label}</div>
        <div className="text-[#078BFF] flex items-center justify-between gap-4">
          <span>Audit / Scan Events:</span>
          <span className="font-mono font-bold">{payload[0]?.value ?? 0}</span>
        </div>
        <div className="text-[#22C55E] flex items-center justify-between gap-4">
          <span>Remediations / Resolved:</span>
          <span className="font-mono font-bold">{payload[1]?.value ?? 0}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const SecurityActivityChart = ({ activities: initialActivities }) => {
  const [activities, setActivities] = useState(initialActivities || []);
  const [loading, setLoading] = useState(initialActivities === undefined);

  useEffect(() => {
    if (initialActivities !== undefined) {
      setActivities(initialActivities || []);
      setLoading(false);
      return;
    }
    let active = true;
    securityService
      .getActivities(1, 50)
      .then((res) => {
        if (active) setActivities(res?.items || []);
      })
      .catch(() => {
        if (active) setActivities([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialActivities]);

  const chartSeries = useMemo(() => {
    if (!activities || activities.length === 0) return [];
    const byDate = {};

    activities.forEach((act) => {
      const dt = new Date(act.created_at);
      if (Number.isNaN(dt.getTime())) return;
      const key = dt.toISOString().slice(0, 10);
      const label = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (!byDate[key]) {
        byDate[key] = { key, dateLabel: label, audits: 0, mitigated: 0 };
      }

      const t = (act.activity_type || '').toUpperCase();
      if (
        t === 'RECOMMENDATION_UPDATED' &&
        (act.metadata_json?.new_status === 'completed' || act.status === 'success')
      ) {
        byDate[key].mitigated += 1;
      } else if (t === 'BREACH_RESOLVED' || t === 'MEDIA_SANITIZED') {
        byDate[key].mitigated += 1;
        byDate[key].audits += 1;
      } else {
        byDate[key].audits += 1;
      }
    });

    return Object.values(byDate)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-10);
  }, [activities]);

  return (
    <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#078BFF]"></span>
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Security Activity Over Time
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-[#9CA3AF]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#078BFF]"></span> Audits
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span> Mitigated
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-44 flex items-center justify-center text-xs text-[#9CA3AF]">
          Loading chronological security events...
        </div>
      ) : chartSeries.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-center px-4 border border-dashed border-[#292D32] rounded-xl bg-[#101214]/50 my-2">
          <Activity className="w-8 h-8 text-[#9CA3AF]/60 mb-2" />
          <div className="text-xs font-bold text-white">No Recorded Security Events Yet</div>
          <p className="text-[11px] text-[#9CA3AF] mt-1 max-w-xs">
            Run scans, password audits, or complete recommendations to populate your real activity timeline.
          </p>
        </div>
      ) : (
        <div className="h-44 w-full my-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartSeries} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAudits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#078BFF" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#078BFF" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorMitigatedReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#292D32" vertical={false} />
              <XAxis dataKey="dateLabel" stroke="#9CA3AF" fontSize={11} tickLine={false} />
              <YAxis allowDecimals={false} stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="audits"
                stroke="#078BFF"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAudits)"
              />
              <Area
                type="monotone"
                dataKey="mitigated"
                stroke="#22C55E"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorMitigatedReal)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="pt-2 border-t border-[#292D32] text-[11px] text-[#9CA3AF] text-center">
        {chartSeries.length > 0
          ? `Aggregated from ${activities.length} authenticated database event${activities.length === 1 ? '' : 's'}.`
          : '100% database-driven telemetry — zero synthetic placeholders.'}
      </div>
    </div>
  );
};
