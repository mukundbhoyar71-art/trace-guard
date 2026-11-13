import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const data = [
  { month: 'Jun', exposure: 62, mitigated: 20 },
  { month: 'Jul', exposure: 55, mitigated: 28 },
  { month: 'Aug', exposure: 48, mitigated: 35 },
  { month: 'Sep', exposure: 40, mitigated: 44 },
  { month: 'Oct', exposure: 32, mitigated: 52 },
  { month: 'Nov', exposure: 24, mitigated: 65 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0A0D14] p-3 rounded-xl border border-slate-700 shadow-2xl text-xs space-y-1">
        <div className="font-bold text-white mb-1">{label} Audit Interval</div>
        <div className="text-red-400 flex items-center justify-between gap-4">
          <span>Active Threat Exposure:</span>
          <span className="font-mono font-bold">{payload[0].value}%</span>
        </div>
        <div className="text-emerald-400 flex items-center justify-between gap-4">
          <span>Mitigated Vectors:</span>
          <span className="font-mono font-bold">{payload[1].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

export const ThreatExposureChart = () => {
  return (
    <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Threat Exposure Trend
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> Active Exposure
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Mitigated
          </span>
        </div>
      </div>

      <div className="h-44 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorExposure" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorMitigated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
            <XAxis dataKey="month" stroke="#64748B" fontSize={11} tickLine={false} />
            <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="exposure"
              stroke="#EF4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorExposure)"
            />
            <Area
              type="monotone"
              dataKey="mitigated"
              stroke="#6366F1"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorMitigated)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[11px] text-slate-400 text-center">
        Exposure decreased by <span className="text-emerald-400 font-bold">61%</span> following password rotation and permission revocation.
      </div>
    </div>
  );
};

