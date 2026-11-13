import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ShieldCheck } from 'lucide-react';

const PILLAR_COLORS = {
  account_security: '#078BFF',
  email_breaches: '#EF4444',
  external_checks: '#8B5CF6',
  permissions: '#F59E0B',
  monitoring: '#22C55E',
  hygiene: '#22C55E',
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-[#101214] p-2.5 rounded-lg border border-[#292D32] shadow-xl text-xs">
        <div className="font-semibold text-white">{item.name}</div>
        <div className="font-bold font-mono text-[#00CFFF]">
          {item.payload.points} risk pts ({item.value}%)
        </div>
      </div>
    );
  }
  return null;
};

export const RiskDistributionChart = ({ factors = [], hasSufficientData = false }) => {
  const totalRiskPoints = factors.reduce((sum, f) => sum + Number(f.score || 0), 0);

  const chartData =
    totalRiskPoints > 0
      ? factors
          .filter((f) => Number(f.score || 0) > 0)
          .map((f) => ({
            name: f.name,
            points: Number(f.score || 0),
            value: Math.round((Number(f.score || 0) / totalRiskPoints) * 100),
            color: PILLAR_COLORS[f.category_id] || '#078BFF',
          }))
      : [];

  return (
    <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00CFFF]"></span>
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Pillar Risk Contribution Split
          </h2>
        </div>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#101214] text-[#9CA3AF] border border-[#292D32]">
          {chartData.length > 0 ? 'REAL ENGINE WEIGHTS' : hasSufficientData ? 'ZERO RISK POINTS' : 'NOT ASSESSED'}
        </span>
      </div>

      {chartData.length > 0 ? (
        <>
          <div className="h-44 w-full flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Pie
                  data={chartData}
                  innerRadius={46}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#292D32]">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-[11px]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                ></span>
                <span className="text-[#9CA3AF] truncate">{item.name}</span>
                <span className="font-mono font-semibold text-white ml-auto">{item.value}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-52 flex flex-col items-center justify-center text-center px-4 border border-dashed border-[#292D32] rounded-xl bg-[#101214]/50 my-2">
          <ShieldCheck className="w-8 h-8 text-[#22C55E] mb-2" />
          <div className="text-xs font-bold text-white">
            {hasSufficientData ? '0 Active Risk Deduction Points' : 'Assessment Pending'}
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-1 max-w-xs">
            {hasSufficientData
              ? 'Your evaluated pillars currently contribute 0 risk penalty points.'
              : 'Complete live scans, HIBP checks, or permission audits to compute pillar risk distribution.'}
          </p>
        </div>
      )}
    </div>
  );
};
