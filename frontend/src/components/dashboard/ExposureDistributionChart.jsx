import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const data = [
  { name: 'App Permissions', value: 42, color: '#F59E0B' },
  { name: 'Social OSINT Footprint', value: 28, color: '#8B5CF6' },
  { name: 'Credential Exposure', value: 12, color: '#22C55E' },
  { name: 'Public Identifiers', value: 18, color: '#38BDF8' },
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-[#0A0D14] p-2.5 rounded-lg border border-slate-700 shadow-xl text-xs">
        <span className="font-semibold text-white">{item.name}: </span>
        <span className="font-bold text-indigo-400">{item.value}%</span>
      </div>
    );
  }
  return null;
};

export const ExposureDistributionChart = () => {
  return (
    <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Exposure Distribution
          </h3>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          Telemetry Breakdown
        </span>
      </div>

      <div className="h-48 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            <Pie
              data={data}
              innerRadius={50}
              outerRadius={75}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-[11px]">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            ></span>
            <span className="text-slate-400 truncate">{item.name}</span>
            <span className="font-mono font-semibold text-slate-200 ml-auto">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

