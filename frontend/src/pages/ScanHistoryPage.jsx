import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  DatabaseZap,
  Search,
  RefreshCw,
  Filter,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sparkles,
  Layers,
  Activity,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { scanService } from '../services/scanService';
import { HistoryPage as ActivityLogView } from './HistoryPage';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'email_exposure', label: 'Email Exposure Scan' },
  { value: 'password_breach', label: 'Password Breach Check' },
  { value: 'external_verification', label: 'External Breach Verification' },
  { value: 'browser_permission', label: 'Browser Permission Audit' },
  { value: 'app_permission', label: 'App Permission Audit' },
  { value: 'sensitive_media', label: 'Sensitive Media Scan' },
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'low', label: 'Low' },
];

export const ScanHistoryPage = () => {
  // Active top-level tab: 'live' | 'demo' | 'activity'
  const [activeTab, setActiveTab] = useState('live');

  // Unified scan records state
  const [scans, setScans] = useState([]);
  const [total, setTotal] = useState(0);
  const [liveTotal, setLiveTotal] = useState(0);
  const [demoTotal, setDemoTotal] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Search & filter state
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadScans = useCallback(
    async (isRefresh = false, targetPage = page) => {
      if (activeTab === 'activity') return;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const scope = activeTab === 'demo' ? 'demo' : 'live';
        const data = await scanService.getUnifiedHistory(targetPage, pageSize, scope, {
          category: categoryFilter,
          severity: severityFilter,
          status: statusFilter,
          search: appliedSearch,
          dateFrom,
          dateTo,
        });

        setScans(data?.items || []);
        setTotal(data?.total || 0);
        setLiveTotal(data?.live_total ?? 0);
        setDemoTotal(data?.demo_total ?? 0);
        setCategoryCounts(data?.category_counts || {});
        setPage(data?.page || 1);
        setTotalPages(data?.total_pages || 1);
      } catch (err) {
        console.error('Failed to load unified scan history:', err);
        setError(err.message || 'Unable to load your unified scan history.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, page, pageSize, categoryFilter, severityFilter, appliedSearch, statusFilter, dateFrom, dateTo]
  );

  useEffect(() => {
    loadScans(false, page);
  }, [loadScans, page]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setPage(1);
    setError('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setCategoryFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(appliedSearch) ||
    categoryFilter !== 'all' ||
    severityFilter !== 'all' ||
    statusFilter !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const getSeverityBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/40';
      case 'high':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/40';
      case 'moderate':
      case 'medium':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/40';
      default:
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            {status || 'Running'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#292D32]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <History className="w-6 h-6 text-[#078BFF]" />
              <span>Unified Scan History & Audit Explorer</span>
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#078BFF]/20 text-[#00CFFF] border border-[#078BFF]/30">
              All Audit Categories
            </span>
          </div>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Inspect email exposure scans, password k-anonymity audits, external HIBP confirmations, permission reviews, and media scans.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab !== 'activity' && (
            <button
              type="button"
              onClick={() => loadScans(true, page)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-300 hover:text-white border border-[#292D32] transition-colors text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#078BFF]' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
          <Link
            to="/data-exposure"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#078BFF] hover:bg-[#0576DB] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/20 transition-colors"
          >
            <DatabaseZap className="w-3.5 h-3.5" />
            <span>New Exposure Scan</span>
          </Link>
        </div>
      </div>

      {/* Top View Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-[#101214] p-1.5 rounded-xl border border-[#292D32] w-fit">
        <button
          type="button"
          onClick={() => handleTabSwitch('live')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'live'
              ? 'bg-[#078BFF] text-white shadow-md shadow-[#078BFF]/25'
              : 'text-[#9CA3AF] hover:text-white hover:bg-[#151719]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Production Audits</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'live' ? 'bg-white/20 text-white' : 'bg-[#1B1E22] text-slate-300'
            }`}
          >
            {liveTotal}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('demo')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'demo'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
              : 'text-[#9CA3AF] hover:text-white hover:bg-[#151719]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Isolated Demo Scans</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'demo' ? 'bg-white/20 text-white' : 'bg-[#1B1E22] text-purple-300'
            }`}
          >
            {demoTotal}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('activity')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'activity'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-[#9CA3AF] hover:text-white hover:bg-[#151719]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Security Activity Log</span>
        </button>
      </div>

      {/* Activity Timeline Tab */}
      {activeTab === 'activity' ? (
        <ActivityLogView embedded />
      ) : (
        <>
          {/* Isolation Notice Banner */}
          {activeTab === 'demo' ? (
            <div className="bg-purple-950/35 border border-purple-500/40 rounded-xl p-4 flex items-start gap-3 text-xs text-purple-200">
              <AlertTriangle className="w-5 h-5 text-purple-300 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block mb-0.5">
                  Isolated Demo Simulations (Fictional Telemetry)
                </span>
                These records come from simulated demo scans and contain synthetic breach incidents. They are strictly isolated from Production Audits, Risk Scoring, and Monitoring.
              </div>
            </div>
          ) : (
            <div className="bg-[#101214] border border-[#292D32] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block mb-0.5">
                    Production Verification Scope ({liveTotal} Records Across Categories):
                  </span>
                  Simulated demo scans ({demoTotal}) are quarantined separately and excluded from all production risk calculations.
                </div>
              </div>
              {Object.keys(categoryCounts).length > 0 && (
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {Object.entries(categoryCounts).map(([cat, cnt]) => (
                    <span
                      key={cat}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151719] text-slate-300 border border-[#292D32]"
                    >
                      {cat.replace('_', ' ')}: <b className="text-white">{cnt}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search & Multi-Facet Filter Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="bg-[#101214] border border-[#292D32] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
          >
            {/* Search Box */}
            <div className="lg:col-span-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Search ID, Type, or Target
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="e.g. EXP-4, Chrome, gmail..."
                  className="w-full bg-[#151719] border border-[#292D32] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#078BFF]"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Scan Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#078BFF]"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Filter */}
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Severity
              </label>
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#078BFF]"
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="lg:col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#078BFF]"
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="running">Running</option>
              </select>
            </div>

            {/* Date From */}
            <div className="lg:col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#078BFF]"
              />
            </div>

            {/* Date To */}
            <div className="lg:col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[#078BFF]"
              />
            </div>

            {/* Action Buttons */}
            <div className="lg:col-span-2 flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-2 px-3 rounded-lg bg-[#078BFF] hover:bg-[#0576DB] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  title="Reset Filters"
                  className="py-2 px-2.5 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-300 hover:text-white border border-[#292D32] text-xs transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 flex items-center justify-between gap-4 text-xs text-rose-200">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => loadScans(false, page)}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold border border-rose-500/40"
              >
                Retry
              </button>
            </div>
          )}

          {/* Scans Table Card */}
          <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#292D32]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#078BFF]" />
                <h2 className="text-base font-semibold text-white">
                  {activeTab === 'demo' ? 'Simulated Demo Audit Records' : 'Verified Unified Audit Records'}
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {total} Matching Record{total === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <div className="py-14 flex flex-col items-center justify-center gap-3 text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-[#078BFF]" />
                <span>Loading unified scan history...</span>
              </div>
            ) : scans.length === 0 ? (
              <div className="py-12 text-center space-y-3 border border-dashed border-[#292D32] rounded-xl bg-[#151719]/40 px-4">
                <DatabaseZap className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    {hasActiveFilters
                      ? 'No scans match the active search, category, severity, or date filters.'
                      : activeTab === 'demo'
                      ? 'No isolated demo scans have been generated yet.'
                      : 'No production security scans recorded yet.'}
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {hasActiveFilters
                      ? 'Try broadening your search terms, category filter, severity, or date window.'
                      : 'Run an Email Exposure Scan, Password K-Anonymity Check, Permission Audit, or Media Scan to populate history.'}
                  </p>
                </div>
                <div className="pt-1 flex items-center justify-center gap-3">
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="px-4 py-2 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-white border border-[#292D32] text-xs font-semibold"
                    >
                      Clear Filters
                    </button>
                  ) : (
                    <Link
                      to="/data-exposure"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#078BFF] hover:bg-[#0576DB] text-white text-xs font-bold"
                    >
                      <span>Open Exposure Scanner</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wider bg-[#151719] text-slate-400 border-b border-[#292D32]">
                    <tr>
                      <th className="px-3.5 py-3">Scan ID</th>
                      <th className="px-3.5 py-3">Scan Name / Category</th>
                      <th className="px-3.5 py-3">Date & Time</th>
                      <th className="px-3.5 py-3">Status</th>
                      <th className="px-3.5 py-3">Findings</th>
                      <th className="px-3.5 py-3">Severity</th>
                      <th className="px-3.5 py-3">Source & Verification</th>
                      <th className="px-3.5 py-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#292D32]/60 text-slate-300">
                    {scans.map((scan) => (
                      <tr key={scan.id} className="hover:bg-[#151719]/70 transition-colors">
                        <td className="px-3.5 py-3.5 font-mono font-bold text-[#00CFFF] whitespace-nowrap">
                          {scan.id}
                        </td>
                        <td className="px-3.5 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-white">{scan.scan_name}</span>
                            <span className="text-[10px] text-slate-400">
                              {scan.category_label} • <span className="font-mono text-slate-300">{scan.target}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3.5 py-3.5 font-mono text-white whitespace-nowrap">
                          <div>{new Date(scan.executed_at).toLocaleDateString()}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(scan.executed_at).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-3.5 py-3.5">{getStatusBadge(scan.status)}</td>
                        <td className="px-3.5 py-3.5">
                          <div className="font-bold text-white">{scan.findings_count} Finding{scan.findings_count === 1 ? '' : 's'}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {scan.verified_findings_count} verified / {scan.unverified_findings_count} unverified
                          </div>
                        </td>
                        <td className="px-3.5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${getSeverityBadge(
                              scan.severity
                            )}`}
                          >
                            {scan.risk_score !== null && scan.risk_score !== undefined
                              ? `${scan.risk_score}/100 • ${scan.severity}`
                              : scan.severity}
                          </span>
                        </td>
                        <td className="px-3.5 py-3.5">
                          <div className="text-[11px] text-slate-200 font-medium">{scan.scan_source}</div>
                          <span
                            className={`inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                              scan.is_demo
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {scan.verification_status}
                          </span>
                        </td>
                        <td className="px-3.5 py-3.5 text-right">
                          <Link
                            to={scan.detail_route || `/scan-history/${scan.category}/${scan.record_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151719] hover:bg-[#1B1E22] text-[#00CFFF] border border-[#292D32] hover:border-[#078BFF]/40 text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-[#292D32] text-xs">
                <span className="text-slate-400 font-mono">
                  Page {page} of {totalPages} ({total} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#151719] text-slate-300 hover:text-white disabled:opacity-40 border border-[#292D32]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#151719] text-slate-300 hover:text-white disabled:opacity-40 border border-[#292D32]"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ScanHistoryPage;
