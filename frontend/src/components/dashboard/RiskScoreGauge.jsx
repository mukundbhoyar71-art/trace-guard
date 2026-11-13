import React from 'react';
import { ShieldCheck, ShieldAlert, AlertOctagon, HelpCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const RiskScoreGauge = ({
  score = null,
  hasSufficientData = false,
  coveragePercentage = 0,
  factors = [],
  lastScan = 'No exposure scan performed yet',
  onRecalculate,
}) => {
  const navigate = useNavigate();

  const getRiskCategory = (val) => {
    if (val === null || val === undefined || !hasSufficientData) {
      return {
        label: 'Insufficient Data',
        color: 'text-slate-400',
        badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        stroke: '#64748B',
      };
    }
    if (val <= 19) return { label: 'Low Risk', color: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', stroke: '#22C55E' };
    if (val <= 39) return { label: 'Moderate Risk', color: 'text-indigo-400', badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', stroke: '#6366F1' };
    if (val <= 69) return { label: 'High Risk', color: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', stroke: '#F59E0B' };
    return { label: 'Critical Risk', color: 'text-red-500', badge: 'bg-red-500/20 text-red-400 border-red-500/30', stroke: '#EF4444' };
  };

  const risk = getRiskCategory(score);

  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = !hasSufficientData || score === null
    ? circumference
    : circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="cyber-card p-6 lg:p-7 rounded-2xl relative overflow-hidden">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
        {/* Left: Circular Animated Gauge */}
        <div className="flex flex-col sm:flex-row items-center gap-6 shrink-0">
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="#1F293D"
                strokeWidth="12"
                fill="transparent"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke={risk.stroke}
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
                style={{ filter: hasSufficientData ? `drop-shadow(0 0 8px ${risk.stroke}66)` : 'none' }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-4xl lg:text-5xl font-black text-white tracking-tighter">
                {hasSufficientData && score !== null ? score : '--'}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Risk Score
              </span>
              <span className={`text-[10px] font-extrabold uppercase mt-1 px-2 py-0.5 rounded-full border ${risk.badge}`}>
                {risk.label}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-center sm:text-left max-w-xs">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Audited Digital Footprint
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">
              {hasSufficientData ? 'Controlled Exposure Profile' : 'Awaiting Initial Security Scan'}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {hasSufficientData
                ? `Synthesized from genuine identity records, active breach registries, and device scopes. Coverage: ${coveragePercentage}%.`
                : 'Insufficient security data. Complete your first security scan to calculate your score.'}
            </p>
            <div className="text-[11px] text-slate-500 font-mono">
              Last evaluation: <span className="text-slate-300">{lastScan}</span>
            </div>
          </div>
        </div>

        {/* Middle: Contributing Real Factor Breakdown */}
        {factors && factors.length > 0 && (
          <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            {factors.slice(0, 4).map((f, i) => (
              <div key={i} className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 truncate">{f.name}</div>
                <div className={`text-sm font-bold ${f.score > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {f.score} pts
                </div>
                <div className="text-[10px] text-slate-500">{f.status_label || f.status}</div>
              </div>
            ))}
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex flex-col gap-2.5 shrink-0 w-full sm:w-auto">
          <button
            onClick={onRecalculate || (() => navigate('/breach-scanner'))}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recalculate Score</span>
          </button>
          <button
            onClick={() => navigate('/risk-score')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <span>Inspect Threat Map</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RiskScoreGauge;
