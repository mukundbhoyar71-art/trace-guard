import React from 'react';
import { ShieldCheck, RefreshCw, AlertCircle, ArrowUpRight, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const RiskGauge = ({
  score = null,
  grade = '--',
  hasSufficientData = false,
  coveragePercentage = 0,
  statusMessage = '',
  factors = [],
  lastScan = 'No exposure scan performed yet',
  onRecalculate,
}) => {
  const navigate = useNavigate();

  // Scoring categories:
  // 0-19: Low (Green)
  // 20-39: Moderate (Indigo/Cyan)
  // 40-69: High (Amber/Orange)
  // 70-100: Critical (Red)
  const getRiskDetails = (val) => {
    if (val === null || val === undefined || !hasSufficientData) {
      return {
        label: 'Insufficient Data',
        color: '#64748B',
        badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
        summary: statusMessage || 'Insufficient security data. Complete your first security scan to calculate your score.',
      };
    }
    if (val <= 19) {
      return {
        label: 'Low Risk',
        color: '#22C55E',
        badge: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
        summary: 'Minimal exposure detected across verified security records and permission audits.',
      };
    }
    if (val <= 39) {
      return {
        label: 'Moderate Risk',
        color: '#078BFF',
        badge: 'bg-[#078BFF]/15 text-[#00CFFF] border-[#078BFF]/30',
        summary: 'Controlled exposure posture. Minor elevated findings or permissions recommend review.',
      };
    }
    if (val <= 69) {
      return {
        label: 'High Risk',
        color: '#F59E0B',
        badge: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
        summary: 'Active credential leaks or excessive hardware scopes confirmed. Remediation advised.',
      };
    }
    return {
      label: 'Critical Risk',
      color: '#EF4444',
      badge: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
      summary: 'Confirmed exposed passwords and critical findings require immediate password rotation.',
    };
  };

  const risk = getRiskDetails(score);

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = !hasSufficientData || score === null
    ? circumference
    : circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const getStatusBadge = (status, statusLabel) => {
    switch (status) {
      case 'CLEAN_CHECK':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {statusLabel || 'Clean'}
          </span>
        );
      case 'VERIFIED_FINDING':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
            {statusLabel || 'Finding'}
          </span>
        );
      case 'EXPIRED_STALE':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
            {statusLabel || 'Stale'}
          </span>
        );
      case 'CHECK_NOT_PERFORMED':
      default:
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {statusLabel || 'Pending'}
          </span>
        );
    }
  };

  return (
    <div className="cyber-card p-6 lg:p-7 rounded-2xl relative overflow-hidden flex flex-col justify-between">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${hasSufficientData ? 'bg-[#078BFF] animate-pulse' : 'bg-slate-500'}`}></div>
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            Privacy & Attack Surface Score
          </h2>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Real Data Engine v3
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            Coverage: {coveragePercentage}%
          </span>
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30">
            Grade {grade}
          </span>
        </div>
      </div>

      {/* Main Gauge Body */}
      <div className="flex flex-col md:flex-row items-center gap-8 py-2">
        {/* Animated Circular Gauge */}
        <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
            {/* Background Track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="#1B1E22"
              strokeWidth="12"
              fill="transparent"
            />
            {/* Animated Score Progress */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke={risk.color}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
              style={{ filter: hasSufficientData ? `drop-shadow(0 0 8px ${risk.color}66)` : 'none' }}
            />
          </svg>

          {/* Centered Score */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {!hasSufficientData || score === null ? (
              <>
                <span className="text-3xl font-black text-slate-400 tracking-tight">--</span>
                <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">/ 100 Index</span>
              </>
            ) : (
              <>
                <span className="text-4xl font-black text-white tracking-tight">{score}</span>
                <span className="text-[10px] font-mono text-[#9CA3AF] uppercase">/ 100 Index</span>
              </>
            )}
            <span className={`mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${risk.badge}`}>
              {risk.label}
            </span>
          </div>
        </div>

        {/* Explanation & Dynamic Factor Breakdown */}
        <div className="flex-1 space-y-3 text-center md:text-left">
          <div>
            <div className="text-sm font-bold text-white flex items-center justify-center md:justify-start gap-2">
              <span>{risk.label} Posture</span>
              {hasSufficientData ? (
                <span className="text-xs text-[#22C55E] font-medium font-mono">
                  [Verified Telemetry]
                </span>
              ) : (
                <span className="text-xs text-amber-400 font-medium font-mono">
                  [Action Required]
                </span>
              )}
            </div>
            <p className="text-xs text-[#9CA3AF] leading-relaxed mt-1">
              {risk.summary}
            </p>
          </div>

          {/* Contributing Verified Factors Grid (Dynamic Real Data) */}
          {factors && factors.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
              {factors.map((f, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-[#101214] border border-[#292D32] flex flex-col justify-between">
                  <div className="text-[9px] uppercase font-mono font-bold text-[#9CA3AF] truncate" title={f.name}>
                    {f.name.replace(" Security", "").replace(" & Monitoring", "").replace(" Verification", "")}
                  </div>
                  <div className="my-1 flex items-baseline justify-between gap-1">
                    <span className={`text-xs font-bold ${f.score > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {f.score} pts
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">/{f.weight}</span>
                  </div>
                  <div>
                    {getStatusBadge(f.status, f.status_label)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-[#101214] border border-[#292D32] text-xs text-slate-400">
              Run an exposure scan or audit browser permissions to establish your real security factor breakdown.
            </div>
          )}
        </div>
      </div>

      {/* Card Footer: Last Scan & Action */}
      <div className="mt-4 pt-3 border-t border-[#292D32] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#9CA3AF]">
        <div className="font-mono text-[11px]">
          Last evaluated: <span className="text-white">{lastScan}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/risk-score')}
            className="px-3 py-1.5 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-300 hover:text-white border border-[#292D32] text-xs transition-colors"
          >
            Inspect Vectors
          </button>
          <button
            onClick={onRecalculate}
            className="px-3.5 py-1.5 rounded-lg bg-[#1B1E22] hover:bg-[#202428] text-white font-semibold border border-[#292D32] hover:border-[#078BFF]/40 text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#078BFF]" />
            <span>Recalculate</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RiskGauge;
