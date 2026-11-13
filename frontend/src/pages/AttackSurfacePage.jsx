import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Gauge,
  TrendingDown,
  TrendingUp,
  Minus,
  Sparkles,
  Info,
  CheckCircle2,
  Lock,
  Database,
  Smartphone,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileSearch,
  ExternalLink,
  Shield,
  Activity,
  Layers,
} from 'lucide-react';
import { securityService } from '../services/securityService';

export const AttackSurfacePage = () => {
  const [riskData, setRiskData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedFactor, setExpandedFactor] = useState(null);

  const fetchScore = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [scoreRes, histRes] = await Promise.all([
        securityService.getRiskScore(),
        securityService.getRiskHistory(10),
      ]);
      setRiskData(scoreRes);
      setHistory(histRes || []);
    } catch (err) {
      console.error('Failed to load risk score data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  const score = riskData?.score ?? null;
  const category = riskData?.category || 'Insufficient Data';
  const hasData = riskData?.has_sufficient_data ?? false;
  const coverage = riskData?.coverage_percentage ?? 0;
  const engineVersion = riskData?.engine_version || '3.0';

  const getScoreColor = (sc, cat) => {
    if (sc === null || cat === 'Insufficient Data' || !hasData) return '#94A3B8'; // Slate
    if (sc >= 70) return '#EF4444'; // Red
    if (sc >= 40) return '#F97316'; // Orange
    if (sc >= 20) return '#F59E0B'; // Amber
    return '#10B981'; // Green
  };

  const getCategoryBadgeClass = (cat) => {
    switch (cat?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'moderate':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'low':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
    }
  };

  const getStatusBadge = (status, statusLabel) => {
    switch (status) {
      case 'CLEAN_CHECK':
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{statusLabel || 'Clean Check'}</span>
          </span>
        );
      case 'VERIFIED_FINDING':
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            <span>{statusLabel || 'Verified Finding'}</span>
          </span>
        );
      case 'EXPIRED_STALE':
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{statusLabel || 'Stale / Expired'}</span>
          </span>
        );
      case 'CHECK_NOT_PERFORMED':
      default:
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
            <Info className="w-3 h-3" />
            <span>{statusLabel || 'Check Pending'}</span>
          </span>
        );
    }
  };

  // SVG Gauge calculations
  const radius = 80;
  const strokeWidth = 14;
  const normalizedRadius = radius - strokeWidth * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    score !== null && hasData
      ? circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference * 0.75
      : circumference;

  const verifiedFindingsCount = riskData?.verified_findings_count ?? 0;
  const resolvedFindingsCount = riskData?.resolved_findings_count ?? 0;
  const factors = riskData?.factors || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#292D32]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Privacy & Attack Surface Score</h1>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Engine v{engineVersion}
            </span>
          </div>
          <p className="text-sm text-[#9CA3AF] mt-1">
            100% genuine data-driven exposure score synthesized across identity records, breach scans, external checks, and hardware scopes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151719] border border-[#292D32] text-xs">
            <span className="text-slate-400">Assessment Coverage:</span>
            <span className="font-bold text-cyan-400">{coverage}%</span>
          </div>

          <button
            onClick={() => fetchScore(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-300 hover:text-white border border-[#292D32] transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {/* Main Gauge & Overview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Animated Radial Gauge */}
        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg height={radius * 2} width={radius * 2} className="transform -rotate-135">
              <circle
                stroke="#1E293B"
                fill="transparent"
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference * 0.75} ${circumference}`}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                strokeLinecap="round"
              />
              <circle
                stroke={getScoreColor(score, category)}
                fill="transparent"
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference * 0.75} ${circumference}`}
                style={{
                  strokeDashoffset,
                  transition: 'stroke-dashoffset 0.8s ease-in-out',
                }}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                strokeLinecap="round"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
              <span className="text-4xl font-extrabold text-white tracking-tight">
                {score !== null && hasData ? score : '--'}
              </span>
              <span className="text-xs text-slate-500 font-medium">/ 100 Index</span>
            </div>
          </div>

          <div className="mt-2 space-y-2">
            <span
              className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${getCategoryBadgeClass(
                category
              )}`}
            >
              {category}
            </span>

            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              {riskData?.status_message || 'Evaluating digital footprint posture...'}
            </p>
          </div>

          {/* Assessment Coverage Bar */}
          <div className="mt-4 pt-3 border-t border-[#292D32] w-full space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Assessment Confidence:</span>
              <span className="font-semibold text-white">{coverage}% Evaluated</span>
            </div>
            <div className="w-full bg-[#151719] h-2 rounded-full overflow-hidden border border-[#292D32]">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${coverage}%` }}
              />
            </div>
          </div>

          {riskData?.score_delta !== null && riskData?.score_delta !== undefined && (
            <div className="mt-3 pt-2 border-t border-[#292D32] w-full flex items-center justify-center gap-2 text-xs">
              <span className="text-slate-500">Delta vs previous:</span>
              <span
                className={`font-semibold flex items-center gap-0.5 ${
                  riskData.score_delta > 0
                    ? 'text-rose-400'
                    : riskData.score_delta < 0
                    ? 'text-emerald-400'
                    : 'text-slate-400'
                }`}
              >
                {riskData.score_delta > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : riskData.score_delta < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                {riskData.score_delta > 0 ? `+${riskData.score_delta}` : riskData.score_delta} pts
              </span>
            </div>
          )}
        </div>

        {/* 5 Real-Data Pillar Decomposition */}
        <div className="lg:col-span-2 bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#292D32]">
            <div>
              <h2 className="text-base font-semibold text-white">Security Pillar Decomposition</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every factor reflects genuine records from the authenticated database. Click any pillar to inspect telemetry details.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                {verifiedFindingsCount} Findings
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {resolvedFindingsCount} Resolved
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {factors.map((f, idx) => {
              const isExpanded = expandedFactor === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#151719] border border-[#292D32] rounded-lg p-3.5 space-y-2.5 transition-colors cursor-pointer hover:border-slate-700"
                  onClick={() => setExpandedFactor(isExpanded ? null : idx)}
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-white">{f.name}</span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {f.weight}% Max Impact
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(f.status, f.status_label)}
                      <span
                        className={`text-xs font-bold ${
                          f.score >= 15 ? 'text-rose-400' : f.score > 0 ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {f.score} / {f.weight} pts
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="w-full bg-[#101214] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        f.score >= 15
                          ? 'bg-rose-500'
                          : f.score > 0
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (f.score / f.weight) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
                    <span>{f.description}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Checked: {f.records_checked_count} record(s)
                    </span>
                  </div>

                  {/* Expanded Telemetry Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#292D32] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-[#101214]/60 p-3 rounded-lg">
                      <div className="space-y-1.5">
                        <div className="text-slate-500 font-mono text-[10px] uppercase">Telemetry Source</div>
                        <div className="text-slate-200 font-semibold">{f.data_source}</div>
                        <div className="text-slate-500 font-mono text-[10px] uppercase pt-1">Evidence Summary</div>
                        <div className="text-slate-300">{f.evidence_summary}</div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-slate-500 font-mono text-[10px] uppercase">Last Evaluation Date</div>
                        <div className="text-slate-200">
                          {f.last_checked_at ? new Date(f.last_checked_at).toLocaleString() : 'Not evaluated yet'}
                        </div>
                        <div className="text-slate-500 font-mono text-[10px] uppercase pt-1">Recommended Mitigation</div>
                        <div className="text-indigo-300 font-medium">{f.suggested_action}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Suggested Security Improvements & Historical Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dynamic Recommendations */}
        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#292D32]">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Genuine Score Improvement Opportunities</h2>
          </div>

          {riskData?.improvement_recommendations && riskData.improvement_recommendations.length > 0 ? (
            <ul className="space-y-2.5">
              {riskData.improvement_recommendations.map((rec, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-[#151719] border border-[#292D32] text-xs text-slate-300"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
              Posture optimized! No pending critical risk reductions identified for current verified telemetry.
            </div>
          )}
        </div>

        {/* Score History Snapshots */}
        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#292D32]">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-semibold text-white">Score Progression History</h2>
            </div>
            <span className="text-xs text-slate-400">Verified Database Snapshots</span>
          </div>

          {history.length > 0 ? (
            <div className="space-y-2.5">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#151719] border border-[#292D32] text-xs"
                >
                  <div>
                    <span className="text-white font-medium block">
                      {new Date(h.calculated_at).toLocaleString()}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Coverage: {h.coverage_percentage ?? 0}% · Engine v{h.engine_version || '3.0'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-[11px] ${getCategoryBadgeClass(
                        h.category
                      )}`}
                    >
                      {h.category}
                    </span>
                    <span className="font-extrabold text-white text-sm">{h.score}/100</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">
              No historical score snapshots recorded yet. Scores are automatically snapshotted upon verified scans and audits.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttackSurfacePage;
