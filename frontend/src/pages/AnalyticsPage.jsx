import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  ShieldAlert,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  FileText,
  Lock,
  Camera,
  Mic,
  MapPin,
  Bell,
  ArrowRight,
  ShieldCheck,
  Activity,
  Sliders,
  Info,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { analyticsService } from '../services/analyticsService';

const SEVERITY_COLORS = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#10B981',
};

const STATUS_COLORS = {
  granted: '#EF4444',
  prompt: '#F59E0B',
  denied: '#10B981',
  unsupported: '#6B7280',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const pointData = payload[0]?.payload;
    return (
      <div className="bg-[#101214] p-3 rounded-xl border border-[#292D32] shadow-2xl text-xs space-y-1.5 font-mono">
        <div className="text-white font-bold">{pointData?.fullDate || label}</div>
        {pointData?.version && (
          <div className="text-[10px] text-[#9CA3AF] flex items-center gap-1.5">
            <span>Scoring Engine:</span>
            <span className="font-bold text-[#00CFFF]">v{pointData.version}</span>
            {pointData.methodology_change && (
              <span className="text-amber-400 font-semibold">(Methodology Shift)</span>
            )}
          </div>
        )}
        <div className="pt-1 border-t border-[#292D32]/60 space-y-1">
          {payload.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[#E5E7EB]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: p.color || p.fill }}
                />
                {p.name}:
              </span>
              <span className="font-bold text-white">{p.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const AnalyticsPage = () => {
  const [overview, setOverview] = useState(null);
  const [riskTrends, setRiskTrends] = useState([]);
  const [trendMeta, setTrendMeta] = useState({ engine_versions_present: [], has_methodology_transition: false });
  const [exposureData, setExposureData] = useState(null);
  const [permissionsData, setPermissionsData] = useState(null);
  const [recommendationsData, setRecommendationsData] = useState(null);
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPillarsBreakdown, setShowPillarsBreakdown] = useState(true);

  const fetchAllAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, tr, exp, perms, recs, act] = await Promise.all([
        analyticsService.getOverview().catch(() => null),
        analyticsService.getRiskTrends().catch(() => ({ trends: [], engine_versions_present: [], has_methodology_transition: false })),
        analyticsService.getExposureAnalytics().catch(() => null),
        analyticsService.getPermissionsAnalytics().catch(() => null),
        analyticsService.getRecommendationsAnalytics().catch(() => null),
        analyticsService.getActivityAnalytics().catch(() => ({ activities: [] })),
      ]);

      setOverview(ov);
      setRiskTrends(tr?.trends || []);
      setTrendMeta({
        engine_versions_present: tr?.engine_versions_present || [],
        has_methodology_transition: tr?.has_methodology_transition || false,
      });
      setExposureData(exp);
      setPermissionsData(perms);
      setRecommendationsData(recs);
      setActivityData(act?.activities || []);
    } catch (err) {
      console.error('Failed to load analytics telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  // Format Risk Trends Chart Data
  const trendChartData = riskTrends.map((t, idx) => {
    const d = new Date(t.calculated_at);
    const dateLabel = isNaN(d)
      ? `Snapshot ${idx + 1}`
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeLabel = !isNaN(d)
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    return {
      date: dateLabel,
      fullDate: timeLabel ? `${dateLabel} ${timeLabel}` : dateLabel,
      score: t.score,
      coverage: t.coverage_percentage,
      version: t.engine_version || '3.0',
      methodology_change: t.methodology_change,
    };
  });

  // If no historical trends exist but current score exists, create 1 point
  if (trendChartData.length === 0 && overview?.risk_score !== null && overview?.risk_score !== undefined) {
    trendChartData.push({
      date: 'Current',
      fullDate: 'Current Baseline',
      score: overview.risk_score,
      coverage: overview.coverage_percentage,
      version: '3.0',
      methodology_change: false,
    });
  }

  // Exposure Severity Chart Data
  const severityChartData = exposureData?.severity_breakdown
    ? [
        { name: 'Critical', count: exposureData.severity_breakdown.critical || 0, fill: SEVERITY_COLORS.critical },
        { name: 'High', count: exposureData.severity_breakdown.high || 0, fill: SEVERITY_COLORS.high },
        { name: 'Medium', count: exposureData.severity_breakdown.medium || 0, fill: SEVERITY_COLORS.medium },
        { name: 'Low', count: exposureData.severity_breakdown.low || 0, fill: SEVERITY_COLORS.low },
      ]
    : [];

  // Permissions Chart Data
  const permissionChartData = permissionsData?.status_counts
    ? [
        { name: 'Granted', count: permissionsData.status_counts.granted || 0, fill: STATUS_COLORS.granted },
        { name: 'Prompt', count: permissionsData.status_counts.prompt || 0, fill: STATUS_COLORS.prompt },
        { name: 'Denied', count: permissionsData.status_counts.denied || 0, fill: STATUS_COLORS.denied },
        { name: 'Unsupported', count: permissionsData.status_counts.unsupported || 0, fill: STATUS_COLORS.unsupported },
      ]
    : [];

  // Recommendations Chart Data
  const recommendationChartData = recommendationsData?.priority_counts
    ? [
        { name: 'Critical', value: recommendationsData.priority_counts.critical || 0, color: '#EF4444' },
        { name: 'High', value: recommendationsData.priority_counts.high || 0, color: '#F97316' },
        { name: 'Medium', value: recommendationsData.priority_counts.medium || 0, color: '#F59E0B' },
        { name: 'Low', value: recommendationsData.priority_counts.low || 0, color: '#10B981' },
      ].filter((d) => d.value > 0)
    : [];

  const sensitiveScopes = permissionsData?.sensitive_scopes || {
    camera: 'PROMPT',
    microphone: 'PROMPT',
    geolocation: 'PROMPT',
    notifications: 'PROMPT',
  };

  const getScopeBadge = (status) => {
    const s = (status || 'PROMPT').toUpperCase();
    if (s === 'GRANTED') {
      return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">GRANTED</span>;
    }
    if (s === 'DENIED') {
      return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">DENIED</span>;
    }
    if (s === 'UNSUPPORTED') {
      return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-gray-500/15 text-gray-400 border border-gray-500/30">UNSUPPORTED</span>;
    }
    return <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">PROMPT</span>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#14171A] border border-[#292D32] shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#078BFF]/20 to-[#00CFFF]/20 border border-[#078BFF]/40 flex items-center justify-center text-[#078BFF] shadow-[0_0_20px_rgba(7,139,255,0.25)]">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                Security Analytics & Intelligence
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#078BFF]/15 text-[#00CFFF] border border-[#078BFF]/30">
                Phase 4 Real Telemetry
              </span>
            </div>
            <p className="text-xs md:text-sm text-[#9CA3AF] mt-0.5">
              Transparent, evidence-grounded analytics tracking multi-pillar risk progression, verified scopes, and remediation provenance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <button
            onClick={fetchAllAnalytics}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#101214] hover:bg-[#1E2227] border border-[#292D32] text-xs font-semibold text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#078BFF]' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/reports"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#078BFF]/15 hover:bg-[#078BFF]/25 border border-[#078BFF]/40 text-xs font-semibold text-[#00CFFF] transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate Report</span>
          </Link>
        </div>
      </div>

      {/* 2. SUMMARY METRIC KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Risk Score */}
        <div className="p-4 rounded-xl bg-[#14171A] border border-[#292D32] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span className="font-semibold uppercase tracking-wider">Attack Surface Score</span>
            <Gauge className="w-4 h-4 text-[#078BFF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">
              {overview?.risk_score !== null && overview?.risk_score !== undefined
                ? overview.risk_score
                : '--'}
            </span>
            <span className="text-xs text-[#9CA3AF]">/ 100</span>
            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-[#101214] border border-[#292D32] text-[#00CFFF] ml-auto">
              Grade {overview?.grade || '--'}
            </span>
          </div>
          <div className="text-[11px] text-[#9CA3AF]">
            Category: <strong className="text-white">{overview?.risk_category || 'Insufficient Data'}</strong>
          </div>
        </div>

        {/* KPI 2: Assessment Coverage */}
        <div className="p-4 rounded-xl bg-[#14171A] border border-[#292D32] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span className="font-semibold uppercase tracking-wider">Assessment Coverage</span>
            <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">
              {overview?.coverage_percentage ?? 0}%
            </span>
            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-[#101214] border border-[#292D32] text-[#22C55E] ml-auto">
              {overview?.coverage_percentage >= 70 ? 'Optimal' : 'Incomplete'}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-[#101214] rounded-full h-1.5 overflow-hidden border border-[#292D32]">
            <div
              className="bg-gradient-to-r from-[#078BFF] to-[#22C55E] h-full transition-all duration-500"
              style={{ width: `${overview?.coverage_percentage || 0}%` }}
            />
          </div>
          <div className="text-[11px] text-[#9CA3AF] flex items-center justify-between pt-0.5">
            <span>5 Security Pillars</span>
            <button
              onClick={() => setShowPillarsBreakdown(!showPillarsBreakdown)}
              className="text-[#078BFF] hover:underline text-[10px] font-semibold cursor-pointer"
            >
              {showPillarsBreakdown ? 'Hide Evidence ▲' : 'View Evidence ▼'}
            </button>
          </div>
        </div>

        {/* KPI 3: Verified Breaches */}
        <div className="p-4 rounded-xl bg-[#14171A] border border-[#292D32] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span className="font-semibold uppercase tracking-wider">Verified Breaches</span>
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">
              {overview?.verified_breaches_count ?? 0}
            </span>
            <span className="text-xs text-[#9CA3AF]">in-app incidents</span>
            <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ml-auto ${
              (overview?.unresolved_breaches_count || 0) > 0
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            }`}>
              {overview?.unresolved_breaches_count || 0} Unresolved
            </span>
          </div>
          <div className="text-[11px] text-[#9CA3AF]">
            Live Scans Completed: <strong className="text-white">{overview?.total_scans ?? 0}</strong>
            {(overview?.total_scans ?? 0) === 0 && (
              <span className="text-amber-400 text-[10px] ml-1">(Scan Pending)</span>
            )}
          </div>
        </div>

        {/* KPI 4: Active Cadence & Mitigations */}
        <div className="p-4 rounded-xl bg-[#14171A] border border-[#292D32] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
            <span className="font-semibold uppercase tracking-wider">Audit Cadence & Recency</span>
            <Clock className="w-4 h-4 text-[#A855F7]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-white">
              {overview?.monitoring_status || 'Inactive'}
            </span>
            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-[#101214] border border-[#292D32] text-[#A855F7] ml-auto">
              Cadence
            </span>
          </div>
          <div className="text-[11px] text-[#9CA3AF]">
            Last Audit Check: <strong className="text-white">{overview?.last_audit_date ? new Date(overview.last_audit_date).toLocaleDateString() : 'None Recorded'}</strong>
            {overview?.last_audit_source && overview.last_audit_source !== 'None Recorded' && (
              <div className="text-[10px] text-[#9CA3AF] mt-0.5 flex items-center gap-1">
                <span>Source:</span>
                <span className="font-mono font-semibold text-[#00CFFF]">{overview.last_audit_source}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2B. FIVE PILLARS EVIDENCE & PROVENANCE BREAKDOWN */}
      {showPillarsBreakdown && overview?.pillars && overview.pillars.length > 0 && (
        <div className="p-5 rounded-2xl bg-[#14171A] border border-[#292D32] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#078BFF]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Five Security Pillars Evidence & Evaluation Status
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#9CA3AF]">
              {overview.coverage_percentage}% EVALUATED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview.pillars.map((pillar) => (
              <div
                key={pillar.pillar_id}
                className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white leading-tight">
                      {pillar.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 border ${
                        pillar.is_evaluated
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {pillar.is_evaluated ? 'EVALUATED' : 'NOT PERFORMED'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono">
                    <span className="text-[#9CA3AF]">Penalty:</span>
                    <span className={`font-bold ${pillar.score > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {pillar.score} / {pillar.weight} pts
                    </span>
                    <span className="text-[#9CA3AF]">•</span>
                    <span className="text-[#00CFFF] truncate">{pillar.status_label}</span>
                  </div>

                  <p className="text-[11px] text-[#9CA3AF] mt-2 leading-relaxed">
                    {pillar.evidence_summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#292D32]/60 text-[10px] font-mono text-[#9CA3AF] flex items-center justify-between">
                  <span className="text-[#6B7280]">Verification:</span>
                  <span className="text-white truncate font-medium">{pillar.verification_type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. CHARTS ROW 1: RISK SCORE PROGRESSION OVER TIME */}
      <div className="p-5 rounded-2xl bg-[#14171A] border border-[#292D32] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#292D32] pb-3">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-4 h-4 text-[#078BFF]" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Attack Surface Risk Progression Over Time
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-[#00CFFF]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00CFFF]" />
              Risk Score (0-100)
            </span>
            <span className="flex items-center gap-1.5 text-[#22C55E]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
              Assessment Coverage %
            </span>
          </div>
        </div>

        {/* Methodology Transition Notice */}
        {trendMeta.has_methodology_transition && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-300">Scoring Engine Version Transition Detected:</div>
              <p className="text-[11px] text-[#D1D5DB] mt-0.5 leading-relaxed">
                Your historical telemetry includes scores evaluated under differing engine versions ({trendMeta.engine_versions_present.map(v => `v${v}`).join(', ')}). 
                A score change across differing engine versions reflects updated 5-pillar weighting formulas and coverage gating rather than an organic threat remediation.
              </p>
            </div>
          </div>
        )}

        {trendChartData.length > 0 ? (
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#078BFF" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#078BFF" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="covGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#292D32" vertical={false} />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} domain={[0, 100]} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="score"
                  name="Risk Score"
                  stroke="#00CFFF"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#scoreGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="coverage"
                  name="Coverage %"
                  stroke="#22C55E"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#covGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-[#101214] rounded-xl border border-[#292D32]">
            <Activity className="w-8 h-8 text-[#9CA3AF] mb-2" />
            <div className="text-sm font-semibold text-white">No Historical Telemetry Recorded</div>
            <p className="text-xs text-[#9CA3AF] max-w-sm mt-1">
              Complete your first personal data exposure scan and breach audit to establish a historical risk score baseline.
            </p>
            <Link
              to="/data-exposure"
              className="mt-3 px-3 py-1.5 rounded-lg bg-[#078BFF] text-white text-xs font-semibold hover:bg-[#0576DB] transition-colors"
            >
              Run Exposure Scan
            </Link>
          </div>
        )}
      </div>

      {/* 4. CHARTS ROW 2: EXPOSURE SEVERITY & TOP COMPROMISED DATA CLASSES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Breach Severity Breakdown */}
        <div className="p-5 rounded-2xl bg-[#14171A] border border-[#292D32] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Breach Severity Distribution
              </h2>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#101214] border border-[#292D32] text-[#9CA3AF]">
              {exposureData?.total_breaches || 0} IN-APP INCIDENTS
            </span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityChartData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#292D32" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} allowDecimals={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Incidents" radius={[4, 4, 0, 0]}>
                  {severityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Resolution Rate Indicator */}
          <div className="pt-2 border-t border-[#292D32] flex items-center justify-between text-xs">
            <span className="text-[#9CA3AF]">Breach Remediation Rate:</span>
            <span className="font-mono font-bold text-[#22C55E]">
              {(exposureData?.total_breaches || 0) > 0
                ? `${exposureData?.resolution_rate || 0}% (${exposureData?.resolved_count || 0}/${exposureData?.total_breaches || 0} Resolved)`
                : 'N/A (0 In-App Incidents Recorded)'}
            </span>
          </div>
        </div>

        {/* Right: Top Exposed Data Classes */}
        <div className="p-5 rounded-2xl bg-[#14171A] border border-[#292D32] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00CFFF]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Exposed Personal Data Classes
              </h2>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#101214] border border-[#292D32] text-[#00CFFF]">
              PII CATEGORIES
            </span>
          </div>

          {exposureData?.top_exposed_categories && exposureData.top_exposed_categories.length > 0 ? (
            <div className="space-y-3 pt-1">
              {exposureData.top_exposed_categories.slice(0, 5).map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white font-medium">{item.category}</span>
                    <span className="font-mono text-[#00CFFF]">{item.count} incident(s)</span>
                  </div>
                  <div className="w-full bg-[#101214] h-2 rounded-full overflow-hidden border border-[#292D32]">
                    <div
                      className="bg-gradient-to-r from-[#078BFF] to-[#00CFFF] h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (item.count / (exposureData.total_breaches || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center p-4 bg-[#101214] rounded-xl border border-[#292D32]">
              <ShieldCheck className="w-7 h-7 text-[#22C55E] mb-2" />
              <div className="text-xs font-semibold text-white">No Compromised Data Classes</div>
              <p className="text-[11px] text-[#9CA3AF] max-w-xs mt-0.5">
                No personal data exposure has been detected in verified in-app breaches.
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-[#292D32] flex items-center justify-between text-xs">
            <span className="text-[#9CA3AF]">Scanned Identity:</span>
            <span className="font-mono text-white">Live Database Records</span>
          </div>
        </div>
      </div>

      {/* 5. CHARTS ROW 3: BROWSER PERMISSION AUDIT & SENSITIVE SCOPES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Permission Status Breakdown */}
        <div className="p-5 rounded-2xl bg-[#14171A] border border-[#292D32] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#F59E0B]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Browser Permission Scopes
              </h2>
            </div>
            <Link
              to="/app-permissions"
              className="text-[11px] font-semibold text-[#00CFFF] hover:underline flex items-center gap-1"
            >
              <span>Audit Tool</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={permissionChartData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#292D32" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={11} allowDecimals={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Permissions" radius={[4, 4, 0, 0]}>
                  {permissionChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sensitive Scopes Status Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#292D32]">
            <div className="p-2 rounded-lg bg-[#101214] border border-[#292D32] flex flex-col items-center text-center">
              <Camera className="w-4 h-4 text-[#9CA3AF] mb-1" />
              <span className="text-[10px] text-[#9CA3AF]">Camera</span>
              <div className="mt-1">{getScopeBadge(sensitiveScopes.camera)}</div>
            </div>

            <div className="p-2 rounded-lg bg-[#101214] border border-[#292D32] flex flex-col items-center text-center">
              <Mic className="w-4 h-4 text-[#9CA3AF] mb-1" />
              <span className="text-[10px] text-[#9CA3AF]">Microphone</span>
              <div className="mt-1">{getScopeBadge(sensitiveScopes.microphone)}</div>
            </div>

            <div className="p-2 rounded-lg bg-[#101214] border border-[#292D32] flex flex-col items-center text-center">
              <MapPin className="w-4 h-4 text-[#9CA3AF] mb-1" />
              <span className="text-[10px] text-[#9CA3AF]">Location</span>
              <div className="mt-1">{getScopeBadge(sensitiveScopes.geolocation)}</div>
            </div>

            <div className="p-2 rounded-lg bg-[#101214] border border-[#292D32] flex flex-col items-center text-center">
              <Bell className="w-4 h-4 text-[#9CA3AF] mb-1" />
              <span className="text-[10px] text-[#9CA3AF]">Alerts</span>
              <div className="mt-1">{getScopeBadge(sensitiveScopes.notifications)}</div>
            </div>
          </div>

          {/* Audit Provenance & Source Transparency List */}
          {permissionsData?.audit_provenance && permissionsData.audit_provenance.length > 0 && (
            <div className="pt-3 border-t border-[#292D32] space-y-2">
              <div className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center justify-between">
                <span>Audited Targets & Provenance</span>
                <span className="text-[10px] font-mono text-[#9CA3AF] font-normal">
                  {permissionsData.audit_provenance.length} TARGETS
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {permissionsData.audit_provenance.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-lg bg-[#101214] border border-[#292D32] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-semibold text-white truncate flex items-center gap-1.5">
                        <span>{item.app_name}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#1F2428] text-[#9CA3AF] border border-[#292D32]">
                          {item.platform}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
                        <span className="text-[#078BFF] font-medium">{item.provenance}</span>
                        {item.audit_date && <span>• {new Date(item.audit_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        item.risk_level === 'critical' || item.risk_level === 'high'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {item.risk_level.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#9CA3AF]/80 italic pt-1">
                Transparency Notice: Web Browser scopes are verified via live W3C Permissions APIs. Mobile/desktop app scopes are manual self-reported checklist entries and are not monitored by an on-device daemon.
              </p>
            </div>
          )}
        </div>

        {/* Right: Security Recommendations Priority */}
        <div className="p-5 rounded-2xl bg-[#14171A] border border-[#292D32] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#A855F7]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Remediation Recommendations
              </h2>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#101214] border border-[#292D32] text-[#A855F7]">
              {recommendationsData?.total || 0} TOTAL ACTIONS
            </span>
          </div>

          {recommendationChartData.length > 0 ? (
            <div className="h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie
                    data={recommendationChartData}
                    innerRadius={48}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {recommendationChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center p-4 bg-[#101214] rounded-xl border border-[#292D32]">
              <CheckCircle2 className="w-7 h-7 text-[#22C55E] mb-2" />
              <div className="text-xs font-semibold text-white">Recommendations Synchronized</div>
              <p className="text-[11px] text-[#9CA3AF] max-w-xs mt-0.5">
                All prioritized mitigation actions have been evaluated.
              </p>
            </div>
          )}

          {/* Status Breakdown Pills */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#292D32] text-center text-xs">
            <div className="p-2 rounded-lg bg-[#101214] border border-[#292D32]">
              <div className="text-[10px] text-[#9CA3AF]">PENDING</div>
              <div className="font-bold text-amber-400 font-mono">
                {recommendationsData?.status_counts?.pending || 0}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#101214] border border-[#292D32]">
              <div className="text-[10px] text-[#9CA3AF]">COMPLETED</div>
              <div className="font-bold text-emerald-400 font-mono">
                {recommendationsData?.status_counts?.completed || 0}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#101214] border border-[#292D32]">
              <div className="text-[10px] text-[#9CA3AF]">DISMISSED</div>
              <div className="font-bold text-[#9CA3AF] font-mono">
                {recommendationsData?.status_counts?.dismissed || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. CHRONOLOGICAL SECURITY ACTIVITY TIMELINE */}
      <div className="p-5 rounded-2xl bg-[#14171A] border border-[#292D32] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#078BFF]" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Recent Security Audit Activity
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#9CA3AF]">
            AUTHENTIC AUDIT TRAIL
          </span>
        </div>

        {activityData && activityData.length > 0 ? (
          <div className="divide-y divide-[#292D32]/60">
            {activityData.slice(0, 8).map((act) => {
              const statusColor =
                act.status === 'success'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : act.status === 'warning'
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  : act.status === 'danger'
                  ? 'text-red-400 bg-red-500/10 border-red-500/30'
                  : 'text-sky-400 bg-sky-500/10 border-sky-500/30';

              return (
                <div key={act.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-white flex items-center gap-2">
                      <span>{act.title}</span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${statusColor}`}>
                        {act.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[#9CA3AF] text-[11px]">{act.description}</div>
                  </div>
                  <div className="text-[10px] font-mono text-[#9CA3AF] whitespace-nowrap shrink-0">
                    {act.created_at ? new Date(act.created_at).toLocaleString() : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[#9CA3AF]">
            No activity events recorded yet. Run a scan or consult the AI assistant to populate the audit log.
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
