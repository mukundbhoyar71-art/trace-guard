import React, { useState, useEffect, useCallback } from 'react';
import {
  DatabaseZap,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  Lock,
  Phone,
  Mail,
  Info,
  Calendar,
  Layers,
  Activity,
  History as HistoryIcon,
  HelpCircle,
  FileText,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { scanService } from '../services/scanService';

export const BreachScannerPage = () => {
  const { user } = useAuth();

  // Scanner state
  const [targetEmail, setTargetEmail] = useState('');
  const [providerStatus, setProviderStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Active scan state
  const [isScanning, setIsScanning] = useState(false);
  const [isDemoScanning, setIsDemoScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [currentScan, setCurrentScan] = useState(null);
  const [scanError, setScanError] = useState('');

  // History state
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalScans, setTotalScans] = useState(0);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'live' | 'demo'

  // Table filtering & expansion
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [expandedBreachId, setExpandedBreachId] = useState(null);

  // Methodology modal
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);

  // Set default target email when user profile loads
  useEffect(() => {
    if (user?.email) {
      setTargetEmail(user.email);
    }
  }, [user]);

  // Fetch provider status
  const loadProviderStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const statusData = await scanService.getScannerStatus();
      setProviderStatus(statusData);
    } catch (err) {
      setProviderStatus({
        configured: false,
        status: 'error',
        message: err.message || 'Unable to check scanner status',
      });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // Fetch scan history with demo filter support
  const loadHistory = useCallback(async (page = 1, filter = historyFilter) => {
    setHistoryLoading(true);
    try {
      const isDemoParam = filter === 'live' ? false : filter === 'demo' ? true : null;
      const data = await scanService.getScanHistory(page, 5, isDemoParam);
      setHistoryItems(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotalScans(data.total || 0);
      setHistoryPage(data.page || 1);

      // If no current scan is selected yet and history exists, load the latest
      if (!currentScan && data.items && data.items.length > 0) {
        setCurrentScan(data.items[0]);
      }
    } catch (err) {
      console.error('Failed to load scan history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [currentScan, historyFilter]);

  useEffect(() => {
    loadProviderStatus();
    loadHistory(1, historyFilter);
  }, [loadProviderStatus, loadHistory, historyFilter]);

  // Handle Scan Initiation (Live or Demo)
  const handleStartScan = async (isDemo = false) => {
    if (!targetEmail) return;

    setScanError('');
    setIsScanning(true);
    setIsDemoScanning(isDemo);
    setScanStep(1);

    // Realistic multi-step progress visualization
    const stepTimer1 = setTimeout(() => setScanStep(2), 600);
    const stepTimer2 = setTimeout(() => setScanStep(3), 1400);

    try {
      const scanResult = await scanService.startScan(targetEmail.trim().toLowerCase(), isDemo);
      setScanStep(4);
      setTimeout(() => {
        setCurrentScan(scanResult);
        setIsScanning(false);
        setIsDemoScanning(false);
        loadHistory(1, historyFilter);
      }, 500);
    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsScanning(false);
      setIsDemoScanning(false);
      setScanError(err.message || 'Scan failed to complete. Please check provider status.');
    }
  };

  // Load a historical scan report
  const handleLoadHistoricalScan = (scan) => {
    setCurrentScan(scan);
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  // Check ownership
  const isAuthorizedEmail =
    user?.email && targetEmail.trim().toLowerCase() === user.email.trim().toLowerCase();

  // Helper for risk badge styling
  const getRiskBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return {
          bg: 'bg-[#EF4444]/15',
          border: 'border-[#EF4444]/40',
          text: 'text-[#EF4444]',
          label: 'Critical Risk',
        };
      case 'high':
        return {
          bg: 'bg-[#F97316]/15',
          border: 'border-[#F97316]/40',
          text: 'text-[#F97316]',
          label: 'High Risk',
        };
      case 'moderate':
        return {
          bg: 'bg-[#F59E0B]/15',
          border: 'border-[#F59E0B]/40',
          text: 'text-[#F59E0B]',
          label: 'Moderate Risk',
        };
      default:
        return {
          bg: 'bg-[#22C55E]/15',
          border: 'border-[#22C55E]/40',
          text: 'text-[#22C55E]',
          label: 'Low Risk',
        };
    }
  };

  // Helper for breach severity badge
  const getSeverityBadge = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'critical':
        return 'bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#EF4444]';
      case 'high':
        return 'bg-[#F97316]/20 border border-[#F97316]/40 text-[#F97316]';
      case 'medium':
        return 'bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B]';
      default:
        return 'bg-[#22C55E]/20 border border-[#22C55E]/40 text-[#22C55E]';
    }
  };

  // Filtered breaches
  const findings = currentScan?.findings || [];
  const filteredFindings = findings.filter((f) => {
    const matchesSearch =
      f.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.breach_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.domain && f.domain.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (f.data_classes &&
        f.data_classes.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesSeverity =
      severityFilter === 'All' || f.severity?.toLowerCase() === severityFilter.toLowerCase();

    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#292D32]/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <DatabaseZap className="w-6 h-6 text-[#078BFF]" />
              <span>Personal Data Exposure</span>
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#078BFF]/20 text-[#00CFFF] border border-[#078BFF]/30">
              Phase 3 Live
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Investigate whether your identity credentials appear in verified global data breaches.
          </p>
        </div>

        {/* Provider Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#151719] border border-[#292D32] text-xs">
          <div
            className={`w-2 h-2 rounded-full ${
              providerStatus?.configured ? 'bg-[#22C55E] shadow-sm shadow-[#22C55E]' : 'bg-[#F59E0B]'
            }`}
          />
          <span className="text-[#9CA3AF] font-medium">Provider:</span>
          <span className="text-white font-semibold">Have I Been Pwned v3</span>
          {statusLoading ? (
            <RefreshCw className="w-3 h-3 text-[#9CA3AF] animate-spin" />
          ) : providerStatus?.configured ? (
            <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/15 px-1.5 py-0.2 rounded border border-[#22C55E]/30">
              Active
            </span>
          ) : (
            <span className="text-[10px] font-bold text-[#F59E0B] bg-[#F59E0B]/15 px-1.5 py-0.2 rounded border border-[#F59E0B]/30">
              Config Required
            </span>
          )}
        </div>
      </div>

      {/* PROVIDER UNCONFIGURED BANNER (If API key not set) */}
      {!statusLoading && providerStatus && !providerStatus.configured && (
        <div className="p-4 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-xs text-[#F59E0B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-[#F59E0B]/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-[#F59E0B] mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm">Have I Been Pwned API Key Required</div>
              <p className="text-[#F59E0B]/90 mt-0.5 leading-relaxed">
                Live breach intelligence requires an authorized HIBP API key. Set{' '}
                <code className="px-1.5 py-0.5 rounded bg-[#101214] font-mono text-white border border-[#292D32]">
                  HIBP_API_KEY
                </code>{' '}
                in <span className="font-semibold text-white">backend/.env</span> to query production breach records.
              </p>
            </div>
          </div>
          <a
            href="https://haveibeenpwned.com/API/Key"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-black font-bold text-xs shrink-0 flex items-center gap-1.5 transition-all shadow-md"
          >
            <span>Obtain API Key</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* 2. SCAN CONTROL CARD */}
      <section className="cyber-card p-6 rounded-2xl border border-[#292D32] bg-[#151719] shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00CFFF]">
                Target Identity Specification
              </span>
              {isAuthorizedEmail ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/30 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Authorized Primary Account</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Cross-account verification required</span>
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="Enter email address (e.g. you@domain.com)"
                  className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-10 pr-3 py-3 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] font-mono transition-all"
                  disabled={isScanning}
                />
              </div>

              {user?.email && targetEmail !== user.email && (
                <button
                  type="button"
                  onClick={() => setTargetEmail(user.email)}
                  className="px-3 py-2 rounded-xl bg-[#1B1E22] hover:bg-[#252930] text-[11px] text-[#9CA3AF] hover:text-white border border-[#292D32] transition-all whitespace-nowrap self-center"
                >
                  Use {user.email}
                </button>
              )}
            </div>

            {/* Action Buttons: Live Scan & Demo Scan */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {/* Live HIBP Scan Button */}
              <div className="flex-1 flex flex-col">
                <button
                  type="button"
                  onClick={() => handleStartScan(false)}
                  disabled={
                    isScanning ||
                    !targetEmail ||
                    !isAuthorizedEmail ||
                    (providerStatus && !providerStatus.configured)
                  }
                  className="w-full px-5 py-3 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/25 border border-[#078BFF]/40 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    providerStatus && !providerStatus.configured
                      ? "Live email breach scanning requires an HIBP API subscription."
                      : "Execute live query against Have I Been Pwned"
                  }
                >
                  {isScanning && !isDemoScanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Auditing Live HIBP...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Start Live HIBP Scan</span>
                    </>
                  )}
                </button>
                {providerStatus && !providerStatus.configured ? (
                  <span className="text-[10px] text-[#F59E0B] mt-1 pl-1 font-medium">
                    Live email breach scanning requires an HIBP API subscription.
                  </span>
                ) : (
                  <span className="text-[10px] text-[#9CA3AF] mt-1 pl-1">
                    Verified breach intelligence via Have I Been Pwned v3
                  </span>
                )}
              </div>

              {/* Demo Scan Button */}
              <div className="flex-1 flex flex-col">
                <button
                  type="button"
                  onClick={() => handleStartScan(true)}
                  disabled={isScanning || !targetEmail || !isAuthorizedEmail}
                  className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/25 border border-purple-400/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Run simulated audit with fictional sample breach records"
                >
                  {isScanning && isDemoScanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Simulating Breach Corpora...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-purple-200" />
                      <span>Run Demo Scan</span>
                    </>
                  )}
                </button>
                <span className="text-[10px] text-purple-300 mt-1 pl-1 font-medium">
                  Fictional Telemetry • Offline Safe (Always Available)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#9CA3AF] pt-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#00CFFF]" />
                Last Audit:{' '}
                <strong className="text-white">
                  {currentScan?.completed_at
                    ? new Date(currentScan.completed_at).toLocaleString()
                    : 'No scan performed yet'}
                </strong>
              </span>
              <span>•</span>
              <span>Rate limit: 1 query per ~2s (enforced server-side)</span>
            </div>
          </div>
        </div>

        {scanError && (
          <div className="mt-4 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}
      </section>

      {/* 2.5 OFFICIAL HAVE I BEEN PWNED EXTERNAL AUDIT CARD */}
      <section className="cyber-card p-6 rounded-2xl border border-[#292D32] bg-[#151719] shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            {/* Branding and Tag */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="px-2.5 py-1 rounded-xl bg-[#101214] border border-[#078BFF]/40 flex items-center gap-1.5 font-mono font-black text-xs">
                <span className="text-[#078BFF]">';--</span>
                <span className="text-white">have i been pwned?</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#078BFF]/15 text-[#00CFFF] border border-[#078BFF]/30 uppercase tracking-wider">
                Official Web Service
              </span>
            </div>

            <div>
              <h2 className="text-base font-black text-white tracking-tight">
                Official Have I Been Pwned Email Breach Checker
              </h2>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Check whether your email address has appeared in known data breaches.
              </p>
            </div>

            {/* User Notice and Privacy Notice */}
            <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] text-xs text-[#9CA3AF] leading-relaxed space-y-2">
              <p className="text-white/90">
                Email breach checking is performed on the official Have I Been Pwned website. TRACE GUARD does not automatically receive or verify external scan results.
              </p>
              <div className="flex items-start gap-2 pt-1 border-t border-[#292D32]/60 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Privacy Notice:</strong> To safeguard your identity, your email address is never automatically transferred or exposed via URL parameters. You can enter your email directly on the official HIBP website.
                </span>
              </div>
            </div>
          </div>

          {/* Action Button & Disclaimer */}
          <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2">
            <a
              href="https://haveibeenpwned.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/25 border border-[#078BFF]/40 transition-all flex items-center justify-center gap-2 group whitespace-nowrap"
            >
              <span>Check Email on HIBP</span>
              <ExternalLink className="w-4 h-4 text-white/90 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
            <span className="text-[10px] text-[#9CA3AF] text-center sm:text-right font-mono">
              Opens haveibeenpwned.com in a new tab
            </span>
          </div>
        </div>
      </section>

      {/* 3. ANIMATED SCANNING STATE (When active) */}
      {isScanning && (
        <section
          className={`p-8 rounded-2xl border shadow-2xl text-center space-y-6 cyber-grid-pattern relative overflow-hidden ${
            isDemoScanning
              ? 'bg-purple-950/20 border-purple-500/50 shadow-purple-900/20'
              : 'bg-[#151719] border-[#078BFF]/40 shadow-2xl'
          }`}
        >
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            {/* Pulsing radar rings */}
            <div
              className={`absolute inset-0 rounded-full border animate-ping opacity-75 ${
                isDemoScanning ? 'border-purple-500/40' : 'border-[#078BFF]/30'
              }`}
            />
            <div
              className={`absolute -inset-2 rounded-full border animate-pulse ${
                isDemoScanning ? 'border-indigo-400/30' : 'border-[#00CFFF]/20'
              }`}
            />
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg z-10 ${
                isDemoScanning
                  ? 'bg-purple-600/20 border border-purple-500/50 text-purple-300 shadow-purple-600/30'
                  : 'bg-[#078BFF]/15 border border-[#078BFF]/50 text-[#00CFFF] shadow-[#078BFF]/25'
              }`}
            >
              <Shield
                className={`w-8 h-8 animate-pulse ${
                  isDemoScanning ? 'text-purple-300' : 'text-[#00CFFF]'
                }`}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-lg font-black text-white tracking-tight">
                {isDemoScanning
                  ? 'Executing Simulated Personal Data Exposure Audit'
                  : 'Executing Personal Data Exposure Audit'}
              </h3>
              {isDemoScanning && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/25 text-purple-300 border border-purple-500/40 uppercase">
                  DEMO MODE
                </span>
              )}
            </div>
            <p className="text-xs text-[#9CA3AF] mt-1 font-mono">
              Target: <span className={isDemoScanning ? 'text-purple-300' : 'text-[#00CFFF]'}>{targetEmail}</span>
            </p>
          </div>

          {/* Stepper Status Indicator */}
          <div className="max-w-md mx-auto grid grid-cols-4 gap-2 text-[10px] font-semibold text-left">
            <div
              className={`p-2 rounded-lg border ${
                scanStep >= 1
                  ? isDemoScanning
                    ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                    : 'border-[#078BFF] bg-[#078BFF]/10 text-[#00CFFF]'
                  : 'border-[#292D32] text-[#9CA3AF]'
              }`}
            >
              1. Authorization
            </div>
            <div
              className={`p-2 rounded-lg border ${
                scanStep >= 2
                  ? isDemoScanning
                    ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                    : 'border-[#078BFF] bg-[#078BFF]/10 text-[#00CFFF]'
                  : 'border-[#292D32] text-[#9CA3AF]'
              }`}
            >
              {isDemoScanning ? '2. Demo Corpora' : '2. Query HIBP'}
            </div>
            <div
              className={`p-2 rounded-lg border ${
                scanStep >= 3
                  ? isDemoScanning
                    ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                    : 'border-[#078BFF] bg-[#078BFF]/10 text-[#00CFFF]'
                  : 'border-[#292D32] text-[#9CA3AF]'
              }`}
            >
              3. Data Classes
            </div>
            <div
              className={`p-2 rounded-lg border ${
                scanStep >= 4
                  ? isDemoScanning
                    ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                    : 'border-[#078BFF] bg-[#078BFF]/10 text-[#00CFFF]'
                  : 'border-[#292D32] text-[#9CA3AF]'
              }`}
            >
              4. Risk Score
            </div>
          </div>
        </section>
      )}

      {/* 4. RESULTS DISPLAY (When a completed scan exists) */}
      {!isScanning && currentScan && (
        <>
          {/* PERSISTENT DEMO VS LIVE DATA BANNER */}
          {currentScan.is_demo ? (
            <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/50 text-xs text-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-purple-900/20">
              <div className="flex items-start gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/25 text-purple-300 border border-purple-500/40 font-mono font-black text-[11px] uppercase tracking-wider shrink-0 mt-0.5">
                  DEMO DATA
                </span>
                <div>
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span>Simulated Exposure Audit (Demonstration Mode)</span>
                  </div>
                  <p className="text-purple-200/80 mt-0.5 leading-relaxed">
                    This audit was generated from synthetic sample breach records for demonstration and security awareness. These records are fictional and do <strong>NOT</strong> reflect actual compromise of your real credentials.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-900/50 px-2.5 py-1 rounded-lg border border-purple-500/40 shrink-0">
                SIMULATED AUDIT
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#078BFF]/10 border border-[#078BFF]/30 text-xs text-[#00CFFF] flex items-center justify-between gap-3 shadow-lg shadow-[#078BFF]/5">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#00CFFF] shrink-0" />
                <div>
                  <span className="font-semibold text-white">Live Have I Been Pwned Audit</span>
                  <span className="text-[#9CA3AF] text-[11px] ml-2">Verified breach intelligence data.</span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-[#00CFFF] bg-[#078BFF]/20 px-2 py-0.5 rounded border border-[#078BFF]/30">
                LIVE AUDIT
              </span>
            </div>
          )}

          {/* SUMMARY METRICS GRID */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Risk Score */}
            {(() => {
              const badge = getRiskBadge(currentScan.risk_level);
              return (
                <div className="cyber-card p-5 rounded-2xl bg-[#151719] border border-[#292D32] relative overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">
                        Exposure Risk Score
                      </span>
                      {currentScan.is_demo && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          DEMO
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMethodologyModal(true)}
                      className="text-[#9CA3AF] hover:text-[#00CFFF] transition-colors"
                      title="View Risk Scoring Methodology"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-black text-white tracking-tight">
                      {currentScan.risk_score}
                    </span>
                    <span className="text-xs text-[#9CA3AF] font-mono">/ 100</span>
                    <span
                      className={`ml-auto text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.border} ${badge.text}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="mt-3 text-[11px] text-[#9CA3AF]">
                    {currentScan.is_demo
                      ? 'Simulated exposure risk calculated from synthetic sample breaches.'
                      : 'Indicative exposure calculation based on verified breach corpora.'}
                  </div>
                </div>
              );
            })()}

            {/* Card 2: Confirmed Breaches */}
            <div className="cyber-card p-5 rounded-2xl bg-[#151719] border border-[#292D32] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">
                    Confirmed Breaches
                  </span>
                  {currentScan.is_demo && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      DEMO
                    </span>
                  )}
                </div>
                <DatabaseZap className="w-4 h-4 text-[#078BFF]" />
              </div>
              <div className="text-4xl font-black text-white tracking-tight">
                {currentScan.breaches_count}
              </div>
              <div className="mt-3 text-[11px] text-[#9CA3AF]">
                {currentScan.breaches_count === 0
                  ? 'No incident records match this address.'
                  : `${currentScan.breaches_count} ${currentScan.is_demo ? 'simulated' : 'verified'} breach incident${currentScan.breaches_count > 1 ? 's' : ''} reported.`}
              </div>
            </div>

            {/* Card 3: Exposed Data Categories */}
            <div className="cyber-card p-5 rounded-2xl bg-[#151719] border border-[#292D32] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">
                    Exposed Categories
                  </span>
                  {currentScan.is_demo && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      DEMO
                    </span>
                  )}
                </div>
                <Layers className="w-4 h-4 text-[#8B5CF6]" />
              </div>
              <div className="text-4xl font-black text-white tracking-tight">
                {currentScan.exposed_categories_count}
              </div>
              <div className="mt-3 text-[11px] text-[#9CA3AF] truncate">
                {currentScan.risk_breakdown?.critical_categories_exposed?.length
                  ? `Critical: ${currentScan.risk_breakdown.critical_categories_exposed.join(', ')}`
                  : 'Classes identified in compromised dumps.'}
              </div>
            </div>

            {/* Card 4: Most Recent Incident */}
            <div className="cyber-card p-5 rounded-2xl bg-[#151719] border border-[#292D32] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">
                    Latest Incident Date
                  </span>
                  {currentScan.is_demo && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      DEMO
                    </span>
                  )}
                </div>
                <Calendar className="w-4 h-4 text-[#00CFFF]" />
              </div>
              <div className="text-2xl font-black text-white tracking-tight">
                {currentScan.risk_breakdown?.most_recent_date || 'N/A'}
              </div>
              <div className="mt-3 text-[11px] text-[#9CA3AF]">
                {currentScan.findings?.[0]?.title
                  ? `Most recent: ${currentScan.findings[0].title}`
                  : 'Recency factor for credential staleness.'}
              </div>
            </div>
          </section>

          {/* VERIFIED ZERO-BREACH STATE */}
          {currentScan.breaches_count === 0 && (
            <div className="p-6 rounded-2xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-center space-y-3 shadow-lg shadow-[#22C55E]/5">
              <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  No Known Breaches Found in Connected Data Source
                </h3>
                <p className="text-xs text-[#9CA3AF] max-w-xl mx-auto mt-1 leading-relaxed">
                  Your email address (<span className="text-white font-mono">{currentScan.email}</span>) does not appear in publicly indexed data breaches monitored by Have I Been Pwned.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#101214] border border-[#292D32] max-w-xl mx-auto text-[11px] text-[#9CA3AF] leading-relaxed">
                <strong className="text-white">Security Notice:</strong> This clean result indicates absence from public compromised datasets. It does not constitute a guarantee that your account is completely immune to targeted phishing or unindexed attacks.
              </div>
            </div>
          )}

          {/* 5. CONFIRMED BREACHES TABLE */}
          {currentScan.breaches_count > 0 && (
            <section className="cyber-card rounded-2xl bg-[#151719] border border-[#292D32] p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <DatabaseZap className="w-4 h-4 text-[#078BFF]" />
                    <span>
                      {currentScan.is_demo
                        ? `Simulated Demo Incidents (${filteredFindings.length})`
                        : `Confirmed Compromised Services (${filteredFindings.length})`}
                    </span>
                    {currentScan.is_demo && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/25 text-purple-300 border border-purple-500/40 uppercase">
                        DEMO DATA
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                    {currentScan.is_demo
                      ? 'Synthetic demonstration records illustrating credential leak structures.'
                      : 'Third-party platforms and incident registries with confirmed user credential leaks.'}
                  </p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter breaches or data..."
                      className="bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-8 pr-3 py-1.5 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] font-mono"
                    />
                  </div>

                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="bg-[#101214] text-xs text-white px-3 py-1.5 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF]"
                  >
                    <option value="All">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#292D32] text-[#9CA3AF] font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Service / Incident</th>
                      <th className="py-3 px-4">Breach Date</th>
                      <th className="py-3 px-4">Exposed Data Categories</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#292D32]/60">
                    {filteredFindings.map((finding) => {
                      const isExpanded = expandedBreachId === finding.id;
                      return (
                        <React.Fragment key={finding.id}>
                          <tr
                            className="hover:bg-[#1B1E22]/50 transition-colors cursor-pointer"
                            onClick={() => setExpandedBreachId(isExpanded ? null : finding.id)}
                          >
                            <td className="py-3.5 px-4 font-semibold text-white">
                              <div className="flex items-center gap-2.5">
                                {finding.logo_url ? (
                                  <img
                                    src={finding.logo_url}
                                    alt={finding.title}
                                    className="w-6 h-6 rounded-md object-contain bg-[#101214] p-0.5 border border-[#292D32]"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div
                                    className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] border ${
                                      currentScan.is_demo || finding.is_fabricated
                                        ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                                        : 'bg-[#078BFF]/10 text-[#00CFFF] border-[#078BFF]/30'
                                    }`}
                                  >
                                    {finding.title?.charAt(0) || 'B'}
                                  </div>
                                )}
                                <div>
                                  <div className="text-white font-bold flex items-center gap-1.5">
                                    <span>{finding.title}</span>
                                    {(currentScan.is_demo || finding.is_fabricated) && (
                                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                        DEMO
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#9CA3AF] font-mono">
                                    {finding.domain || 'Source unlisted'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-[#9CA3AF] font-mono">
                              {finding.breach_date || 'Unknown'}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap gap-1 max-w-md">
                                {finding.data_classes?.map((c, idx) => {
                                  const isPassword = c.toLowerCase().includes('password');
                                  const isPhone = c.toLowerCase().includes('phone');
                                  return (
                                    <span
                                      key={idx}
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                                        isPassword
                                          ? 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                                          : isPhone
                                          ? 'bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30'
                                          : 'bg-[#101214] text-[#9CA3AF] border border-[#292D32]'
                                      }`}
                                    >
                                      {c}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getSeverityBadge(
                                  finding.severity
                                )}`}
                              >
                                {finding.severity}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                className="p-1 rounded-lg text-[#9CA3AF] hover:text-white transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Expandable Detail Section */}
                          {isExpanded && (
                            <tr className="bg-[#101214]/80">
                              <td colSpan={5} className="p-5 space-y-4">
                                <div className="space-y-2">
                                  <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Info className="w-3.5 h-3.5 text-[#00CFFF]" />
                                    <span>Incident Summary</span>
                                  </div>
                                  <div
                                    className="text-xs text-[#9CA3AF] leading-relaxed max-w-4xl prose-dark"
                                    dangerouslySetInnerHTML={{
                                      __html: finding.description || 'No description provided by incident registry.',
                                    }}
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                                  <div className="p-3 rounded-xl bg-[#151719] border border-[#292D32]">
                                    <span className="text-[#9CA3AF] text-[10px] uppercase font-bold tracking-wider">
                                      Compromised Accounts
                                    </span>
                                    <div className="text-white font-mono font-bold mt-1">
                                      {finding.pwn_count
                                        ? Number(finding.pwn_count).toLocaleString()
                                        : 'Unknown'}
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-xl bg-[#151719] border border-[#292D32]">
                                    <span className="text-[#9CA3AF] text-[10px] uppercase font-bold tracking-wider">
                                      Verification Status
                                    </span>
                                    <div className="text-white font-bold mt-1 flex items-center gap-1.5">
                                      {finding.is_verified ? (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                                          <span>Verified Incident</span>
                                        </>
                                      ) : (
                                        <span>Unverified</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-xl bg-[#151719] border border-[#292D32]">
                                    <span className="text-[#9CA3AF] text-[10px] uppercase font-bold tracking-wider">
                                      Sensitivity Marker
                                    </span>
                                    <div className="text-white font-bold mt-1">
                                      {finding.is_sensitive ? 'High Sensitivity' : 'Standard Corpus'}
                                    </div>
                                  </div>
                                </div>

                                {/* Targeted Action Recommendations */}
                                {finding.recommended_actions?.length > 0 && (
                                  <div className="p-3.5 rounded-xl bg-[#078BFF]/10 border border-[#078BFF]/30 space-y-2">
                                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                      <Lock className="w-3.5 h-3.5 text-[#00CFFF]" />
                                      <span>Recommended Actions for {finding.title}:</span>
                                    </div>
                                    <ul className="text-xs text-[#9CA3AF] space-y-1 list-disc list-inside">
                                      {finding.recommended_actions.map((rec, rIdx) => (
                                        <li key={rIdx}>{rec}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 6. AGGREGATED DEFENSIVE RECOMMENDATIONS */}
          {currentScan.security_recommendations?.length > 0 && (
            <section className="cyber-card p-6 rounded-2xl bg-[#151719] border border-[#292D32] space-y-4 shadow-xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#22C55E]" />
                <h2 className="text-base font-black text-white">
                  Strategic Security Recommendations
                </h2>
              </div>
              <p className="text-xs text-[#9CA3AF]">
                Actionable countermeasures generated from confirmed breach findings to mitigate identity exposure.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {currentScan.security_recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#101214] border border-[#292D32] text-xs text-[#9CA3AF] leading-relaxed flex items-start gap-3"
                  >
                    <div className="w-5 h-5 rounded-lg bg-[#078BFF]/15 text-[#00CFFF] border border-[#078BFF]/30 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                      {idx + 1}
                    </div>
                    <span className="text-white/90">{rec}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* 7. SCAN HISTORY SECTION */}
      <section className="cyber-card p-6 rounded-2xl bg-[#151719] border border-[#292D32] space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <HistoryIcon className="w-4 h-4 text-[#00CFFF]" />
              <span>Personal Scan History ({totalScans})</span>
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Persistent records of your account exposure assessments separated by audit type.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Tabs: All, Live, Demo */}
            <div className="flex items-center gap-1 p-1 bg-[#101214] border border-[#292D32] rounded-xl text-xs">
              <button
                type="button"
                onClick={() => {
                  setHistoryFilter('all');
                  loadHistory(1, 'all');
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  historyFilter === 'all'
                    ? 'bg-[#078BFF] text-white shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoryFilter('live');
                  loadHistory(1, 'live');
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  historyFilter === 'live'
                    ? 'bg-[#078BFF] text-white shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Live
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoryFilter('demo');
                  loadHistory(1, 'demo');
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  historyFilter === 'demo'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Demo
              </button>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => loadHistory(historyPage - 1, historyFilter)}
                  disabled={historyPage <= 1 || historyLoading}
                  className="px-3 py-1.5 rounded-xl bg-[#101214] hover:bg-[#1B1E22] text-white border border-[#292D32] disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-[#9CA3AF] font-mono text-[11px]">
                  {historyPage}/{totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => loadHistory(historyPage + 1, historyFilter)}
                  disabled={historyPage >= totalPages || historyLoading}
                  className="px-3 py-1.5 rounded-xl bg-[#101214] hover:bg-[#1B1E22] text-white border border-[#292D32] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {historyLoading ? (
          <div className="py-8 text-center text-xs text-[#9CA3AF] flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#078BFF]" />
            <span>Loading historical audits...</span>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#9CA3AF] border border-dashed border-[#292D32] rounded-xl">
            {historyFilter === 'all'
              ? 'No historical exposure scans on record. Run your first audit above.'
              : `No ${historyFilter} exposure scans found.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#292D32] text-[#9CA3AF] font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Audit Date</th>
                  <th className="py-3 px-4">Scanned Identity</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Breaches</th>
                  <th className="py-3 px-4">Risk Score</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292D32]/60">
                {historyItems.map((h) => {
                  const badge = getRiskBadge(h.risk_level);
                  const isCurrent = currentScan?.id === h.id;
                  return (
                    <tr
                      key={h.id}
                      className={`hover:bg-[#1B1E22]/50 transition-colors ${
                        isCurrent ? 'bg-[#078BFF]/5 border-l-2 border-[#078BFF]' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-white font-mono">
                        {new Date(h.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-[#9CA3AF] font-mono">
                        <div className="flex items-center gap-1.5">
                          <span>{h.email}</span>
                          {h.is_demo && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              DEMO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {h.is_demo ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            DEMO
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#078BFF]/20 text-[#00CFFF] border border-[#078BFF]/40">
                            LIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30">
                          {h.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white font-bold">{h.breaches_count}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.border} ${badge.text}`}
                        >
                          {h.risk_score} / 100
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleLoadHistoricalScan(h)}
                          className="px-2.5 py-1 rounded-lg bg-[#101214] hover:bg-[#1B1E22] text-[#00CFFF] text-[11px] font-bold border border-[#292D32] transition-colors"
                        >
                          {isCurrent ? 'Viewing' : 'Load Report'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 8. METHODOLOGY MODAL */}
      {showMethodologyModal && currentScan?.risk_breakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg cyber-card p-6 rounded-2xl bg-[#151719] border border-[#292D32] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#292D32]">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#00CFFF]" />
                <h3 className="text-sm font-black text-white">Risk Scoring Methodology</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMethodologyModal(false)}
                className="text-[#9CA3AF] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#9CA3AF] leading-relaxed">
              <p>
                The TRACE GUARD Exposure Risk Score computes an indicative 0–100 vulnerability index based on four multidimensional weights:
              </p>

              <div className="space-y-2 font-mono text-[11px]">
                <div className="p-2.5 rounded-xl bg-[#101214] border border-[#292D32] flex justify-between">
                  <span>1. Incident Volume (max 30 pts):</span>
                  <strong className="text-white">
                    {currentScan.risk_breakdown.breach_count_score} pts
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-[#101214] border border-[#292D32] flex justify-between">
                  <span>2. Data Sensitivity Tiers (max 45 pts):</span>
                  <strong className="text-white">
                    {currentScan.risk_breakdown.sensitivity_score} pts
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-[#101214] border border-[#292D32] flex justify-between">
                  <span>3. Incident Recency (max 15 pts):</span>
                  <strong className="text-white">
                    {currentScan.risk_breakdown.recency_score} pts
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-[#101214] border border-[#292D32] flex justify-between">
                  <span>4. Multi-Breach Repetition (max 10 pts):</span>
                  <strong className="text-white">
                    {currentScan.risk_breakdown.repetition_score} pts
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#078BFF]/10 border border-[#078BFF]/30 text-[11px] text-[#00CFFF] leading-relaxed">
                <strong className="text-white">Audit Disclaimer:</strong> {currentScan.risk_breakdown.disclaimer}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMethodologyModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold transition-all"
            >
              Close Methodology
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
