import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Database,
  Fingerprint,
  Lock,
  AlertTriangle,
  ShieldCheck,
  Zap,
  ExternalLink,
  FileText,
  Bell,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FileSearch,
  Globe,
  Bot,
  BarChart3,
  History,
  BellRing,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { scanService } from '../services/scanService';
import { securityService } from '../services/securityService';
import { monitoringService } from '../services/monitoringService';
import { reportService } from '../services/reportService';
import { analyticsService } from '../services/analyticsService';
import { StatCard } from '../components/dashboard/StatCard';
import { RiskGauge } from '../components/dashboard/RiskGauge';
import { ExposureCard } from '../components/dashboard/ExposureCard';
import { BreachTable } from '../components/dashboard/BreachTable';
import { PermissionCard } from '../components/dashboard/PermissionCard';
import { PasswordSecurityCard } from '../components/dashboard/PasswordSecurityCard';
import { ActivityTimeline } from '../components/dashboard/ActivityTimeline';
import { RecommendationCard } from '../components/dashboard/RecommendationCard';
import { SecurityAlertCard } from '../components/dashboard/SecurityAlertCard';
import { RiskDistributionChart } from '../components/charts/RiskDistributionChart';
import { SecurityActivityChart } from '../components/charts/SecurityActivityChart';
import { SensitiveMediaScannerSection } from '../components/dashboard/SensitiveMediaScannerSection';
import { ExternalMediaLeakCard } from '../components/dashboard/ExternalMediaLeakCard';

export const DashboardPage = () => {
  const { user } = useAuth();
  const context = useOutletContext() || {};
  const { showToast } = context;

  const [latestScan, setLatestScan] = useState(null);
  const [hasScanned, setHasScanned] = useState(undefined); // undefined while loading
  const [scanCounts, setScanCounts] = useState({ live: 0, demo: 0 });
  const [reportsSummary, setReportsSummary] = useState({ total: 0, latest: null });
  const [riskTelemetry, setRiskTelemetry] = useState(null);
  const [monitoringOverview, setMonitoringOverview] = useState(null);
  const [exposureData, setExposureData] = useState(null);
  const [activitiesData, setActivitiesData] = useState([]);
  const [latestPasswordCheck, setLatestPasswordCheck] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Strictly request live production scans (isDemo = false) for overview telemetry
      const [historyData, riskData, monitorData, reportsData, expData, actData, pwdActData] =
        await Promise.all([
          scanService.getScanHistory(1, 1, false).catch(() => null),
          securityService.getRiskScore().catch(() => null),
          monitoringService.getOverview().catch(() => null),
          reportService.listReports().catch(() => null),
          analyticsService.getExposureAnalytics().catch(() => null),
          securityService.getActivities(1, 50).catch(() => null),
          securityService.getActivities(1, 1, 'PASSWORD_BREACH_CHECK').catch(() => null),
        ]);

      if (historyData?.items && historyData.items.length > 0) {
        setLatestScan(historyData.items[0]);
        setHasScanned(true);
      } else {
        setLatestScan(null);
        setHasScanned(false);
      }

      setScanCounts({
        live: historyData?.live_total ?? historyData?.total ?? 0,
        demo: historyData?.demo_total ?? monitorData?.demo_scans_count ?? 0,
      });

      setReportsSummary({
        total: reportsData?.total ?? reportsData?.items?.length ?? 0,
        latest: reportsData?.items?.[0] ?? null,
      });

      setRiskTelemetry(riskData);
      setMonitoringOverview(monitorData);
      setExposureData(expData);
      setActivitiesData(actData?.items || []);
      setLatestPasswordCheck(pwdActData?.items?.[0] || null);
    } catch (err) {
      console.error('Failed to load dashboard telemetry:', err);
      setHasScanned(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRecalculate = async () => {
    try {
      const freshScore = await securityService.getRiskScore();
      setRiskTelemetry(freshScore);
      if (showToast) {
        showToast('Risk telemetry synchronized against active indices.');
      }
    } catch (err) {
      if (showToast) showToast('Failed to recalculate risk telemetry.');
    }
  };

  const hasSufficientData = riskTelemetry?.has_sufficient_data ?? false;
  const computedRiskScore = hasSufficientData ? riskTelemetry.score : null;
  const coveragePercentage = riskTelemetry?.coverage_percentage ?? 0;
  const isDemoTelemetry = Boolean(latestScan?.is_demo);
  const grade = !hasSufficientData
    ? '--'
    : computedRiskScore <= 19
    ? 'A+'
    : computedRiskScore <= 39
    ? 'B'
    : computedRiskScore <= 69
    ? 'C'
    : 'F';

  return (
    <div className="space-y-6">
      {/* QUICK INTELLIGENCE ACTION BAR */}
      <section className="bg-gradient-to-r from-[#101214] via-[#151719] to-[#101214] border border-[#292D32] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">TraceGuard Intelligence Suite</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Phase 5 Active
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Verified breach history, manual HIBP audit reminders, k-anonymity credentials, and real-data PDF dossiers.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/scan-history"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#078BFF]/15 hover:bg-[#078BFF]/25 text-[#00CFFF] border border-[#078BFF]/35 text-xs font-semibold transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            <span>Scan History</span>
          </Link>

          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Reports</span>
          </Link>

          <Link
            to="/breach-monitoring"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-200 border border-[#292D32] text-xs font-semibold transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-indigo-400" />
            <span>Monitoring</span>
          </Link>

          <Link
            to="/recommendations"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-200 border border-[#292D32] text-xs font-semibold transition-colors"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-400" />
            <span>Recommendations</span>
          </Link>

          <Link
            to="/media-scanner"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-colors"
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>Media Scanner</span>
          </Link>

          <a
            href="https://haveibeenpwned.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold transition-colors"
          >
            <span>Check HIBP</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* 1. FOUR OVERVIEW STATISTIC CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Breaches Found"
          value={hasScanned ? String(latestScan.breaches_count) : '0'}
          subtitle={
            hasScanned
              ? `${latestScan.is_demo ? 'Simulated' : 'Confirmed'} breaches for ${latestScan.email}`
              : 'Known data breaches associated with your account'
          }
          icon={Database}
          badgeText={
            hasScanned
              ? latestScan.breaches_count === 0
                ? 'Verified Clean'
                : `${latestScan.breaches_count} Detected`
              : 'Audit Pending'
          }
          badgeType={
            hasScanned
              ? latestScan.breaches_count === 0
                ? 'success'
                : 'danger'
              : 'warning'
          }
          isDemo={isDemoTelemetry}
          trendDirection="neutral"
          trendText={hasScanned ? (latestScan.is_demo ? 'Demo Scan' : 'Live Scan') : 'Unchecked'}
        />

        <StatCard
          title="Exposed Personal Data"
          value={hasScanned ? String(latestScan.exposed_categories_count) : '0'}
          subtitle={
            latestScan?.is_demo
              ? 'Compromised data categories across simulated demo records'
              : 'Compromised data categories across verified breaches'
          }
          icon={Fingerprint}
          badgeText={
            hasScanned
              ? `${latestScan.exposed_categories_count} Classes`
              : 'No Data'
          }
          badgeType={
            hasScanned
              ? latestScan.exposed_categories_count === 0
                ? 'success'
                : 'warning'
              : 'info'
          }
          isDemo={isDemoTelemetry}
          trendDirection="neutral"
          trendText={hasScanned ? (latestScan.is_demo ? 'Demo Telemetry' : 'Live Telemetry') : 'Unchecked'}
        />

        <StatCard
          title="Password Security"
          value={
            !latestPasswordCheck
              ? 'Not assessed'
              : latestPasswordCheck.metadata_json?.breached
              ? `${Number(latestPasswordCheck.metadata_json?.count || 0)} Leaks`
              : '0 Leaks'
          }
          subtitle={
            !latestPasswordCheck
              ? 'Run a zero-knowledge k-anonymity check to evaluate password exposure'
              : `Last k-anonymity audit: ${new Date(latestPasswordCheck.created_at).toLocaleDateString()} (${latestPasswordCheck.metadata_json?.entropy_bits ?? 0} bits)`
          }
          icon={Lock}
          badgeText={
            !latestPasswordCheck
              ? 'Pending'
              : latestPasswordCheck.metadata_json?.breached
              ? 'Compromised'
              : 'Verified Safe'
          }
          badgeType={
            !latestPasswordCheck
              ? 'neutral'
              : latestPasswordCheck.metadata_json?.breached
              ? 'danger'
              : 'success'
          }
          isDemo={false}
          trendDirection="neutral"
          trendText={latestPasswordCheck ? 'K-Anonymity' : 'Unchecked'}
        />

        <StatCard
          title="Monitoring Cadence"
          value={
            loading && !monitoringOverview
              ? '...'
              : monitoringOverview?.auto_monitoring?.is_enabled
              ? `Auto (${monitoringOverview.auto_monitoring.frequency})`
              : monitoringOverview?.monitoring_status || 'No Audits Yet'
          }
          subtitle={
            monitoringOverview?.auto_monitoring?.is_enabled && monitoringOverview?.auto_monitoring?.next_run_at
              ? `Next scheduled API check: ${new Date(monitoringOverview.auto_monitoring.next_run_at).toLocaleDateString()} (${
                  monitoringOverview.auto_monitoring.hibp_configured ? 'HIBP ready' : 'HIBP key required'
                })`
              : monitoringOverview?.monitoring_enabled && monitoringOverview?.next_reminder_date
              ? `Next manual reminder: ${new Date(monitoringOverview.next_reminder_date).toLocaleDateString()} (${monitoringOverview.last_completed_check_source})`
              : monitoringOverview?.last_completed_check_date
              ? `Reminders disabled • Last check: ${new Date(monitoringOverview.last_completed_check_date).toLocaleDateString()}`
              : 'Monitoring paused • No live check performed yet'
          }
          icon={AlertTriangle}
          badgeText={
            monitoringOverview?.auto_monitoring?.is_enabled
              ? 'AUTO SCHEDULED'
              : monitoringOverview?.monitoring_status === 'Check Overdue'
              ? 'CHECK OVERDUE'
              : monitoringOverview?.monitoring_enabled
              ? 'REMINDER ON'
              : 'DISABLED'
          }
          badgeType={
            monitoringOverview?.auto_monitoring?.is_enabled
              ? 'success'
              : monitoringOverview?.monitoring_status === 'Check Overdue'
              ? 'warning'
              : monitoringOverview?.monitoring_status === 'No Audits Yet'
              ? 'neutral'
              : monitoringOverview?.monitoring_enabled
              ? 'info'
              : 'neutral'
          }
          isDemo={false}
          trendDirection="neutral"
          trendText={
            monitoringOverview?.auto_monitoring?.is_enabled
              ? monitoringOverview.auto_monitoring.frequency
              : monitoringOverview?.reminder_frequency || 'Unset'
          }
        />
      </section>

      {/* 2. SECURITY RISK ASSESSMENT (Circular SVG Gauge) */}
      <section>
        <RiskGauge
          score={computedRiskScore}
          grade={grade}
          hasSufficientData={hasSufficientData}
          coveragePercentage={coveragePercentage}
          statusMessage={riskTelemetry?.status_message}
          factors={riskTelemetry?.factors}
          lastScan={
            latestScan?.completed_at
              ? new Date(latestScan.completed_at).toLocaleString()
              : 'No exposure scan performed yet'
          }
          onRecalculate={handleRecalculate}
        />
      </section>

      {/* 3. CHARTS: SECURITY ACTIVITY & RISK DISTRIBUTION */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SecurityActivityChart activities={activitiesData} />
        <RiskDistributionChart
          factors={riskTelemetry?.factors || []}
          hasSufficientData={hasSufficientData}
        />
      </section>

      {/* 4. PERSONAL DATA EXPOSURE SECTION (Masked PII) */}
      <section>
        <ExposureCard
          user={user}
          latestScan={latestScan}
          hasScanned={hasScanned}
          exposureData={exposureData}
          monitoringOverview={monitoringOverview}
        />
      </section>

      {/* 5. BREACH MONITORING REGISTER (Connected to live scan telemetry) */}
      <section>
        <BreachTable
          realFindings={latestScan?.findings || []}
          hasScanned={hasScanned}
          scannedEmail={latestScan?.email || user?.email}
          isDemoScan={latestScan?.is_demo}
        />
      </section>

      {/* 6. APP PERMISSION MONITORING & PASSWORD SECURITY */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <PermissionCard />
        <PasswordSecurityCard user={user} latestPasswordCheck={latestPasswordCheck} />
      </section>

      {/* 6B. SENSITIVE MEDIA SCANNER (PHASE A ON-DEVICE AI) */}
      <SensitiveMediaScannerSection />

      {/* 6C. EXTERNAL MEDIA LEAK CHECK FEATURE CARD */}
      <ExternalMediaLeakCard />

      {/* 6D. PHASE 4 AI ASSISTANT & ADVANCED ANALYTICS */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* AI Security Assistant Feature Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#14171A] to-[#12263F]/40 border border-[#292D32] hover:border-[#078BFF]/50 transition-all shadow-xl flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-[#078BFF]/20 border border-[#078BFF]/40 flex items-center justify-center text-[#078BFF] shadow-[0_0_15px_rgba(7,139,255,0.25)]">
                <Bot className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#078BFF]/15 text-[#00CFFF] border border-[#078BFF]/30">
                AI Intelligence
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-[#00CFFF] transition-colors">
                AI Security Assistant
              </h3>
              <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                Interact with your conversational cybersecurity advisor. Ask questions about your verified breaches, point deductions, high-risk browser permissions, and step-by-step remediation.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-2 border-t border-[#292D32]/60 flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#9CA3AF]">Zero Credential Leakage</span>
            <Link
              to="/ai-assistant"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#078BFF] hover:bg-[#0576DB] text-white text-xs font-semibold shadow-md transition-all"
            >
              <span>Consult Assistant</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Security Analytics Feature Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#14171A] to-[#162A20]/40 border border-[#292D32] hover:border-[#22C55E]/50 transition-all shadow-xl flex flex-col justify-between group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-[#22C55E]/20 border border-[#22C55E]/40 flex items-center justify-center text-[#22C55E] shadow-[0_0_15px_rgba(34,197,94,0.25)]">
                <BarChart3 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30">
                Telemetry Analytics
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-[#22C55E] transition-colors">
                Security Analytics Dashboard
              </h3>
              <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                Explore comprehensive risk score trends over time, breach severity distribution, browser permission scopes, and mitigation progress across all 5 security pillars.
              </p>
            </div>
          </div>
          <div className="pt-4 mt-2 border-t border-[#292D32]/60 flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#9CA3AF]">Authentic DB Metrics</span>
            <Link
              to="/analytics"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22C55E] hover:bg-[#1EA952] text-white text-xs font-semibold shadow-md transition-all"
            >
              <span>Explore Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 6E. PHASE 5 INTEGRATED OPERATIONS: SCAN HISTORY, REPORTS & MONITORING */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-[#14171A] border border-[#292D32] hover:border-[#078BFF]/40 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Scan History</span>
              <History className="w-4 h-4 text-[#00CFFF]" />
            </div>
            <div className="text-2xl font-black text-white">
              {scanCounts.live} Live Scan{scanCounts.live === 1 ? '' : 's'}
            </div>
            <p className="text-xs text-slate-400">
              {scanCounts.demo > 0
                ? `${scanCounts.demo} demo simulation(s) quarantined separately.`
                : 'Inspect full scan findings, verification counts, and date filters.'}
            </p>
          </div>
          <Link
            to="/scan-history"
            className="inline-flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#101214] hover:bg-[#1B1E22] border border-[#292D32] text-xs font-semibold text-[#00CFFF]"
          >
            <span>Open Scan History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="p-5 rounded-2xl bg-[#14171A] border border-[#292D32] hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Downloadable Reports</span>
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {reportsSummary.total} Dossier{reportsSummary.total === 1 ? '' : 's'}
            </div>
            <p className="text-xs text-slate-400">
              {reportsSummary.latest
                ? `Latest generated ${new Date(reportsSummary.latest.created_at).toLocaleDateString()}`
                : 'Export verified 5-pillar PDF security dossiers anytime.'}
            </p>
          </div>
          <Link
            to="/reports"
            className="inline-flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#101214] hover:bg-[#1B1E22] border border-[#292D32] text-xs font-semibold text-indigo-300"
          >
            <span>Manage PDF Reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="p-5 rounded-2xl bg-[#14171A] border border-[#292D32] hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Security Monitoring</span>
              <Bell className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {monitoringOverview?.auto_monitoring?.is_enabled
                ? `Auto (${monitoringOverview.auto_monitoring.frequency})`
                : monitoringOverview?.monitoring_enabled
                ? 'Reminders Active'
                : 'Monitoring Paused'}
            </div>
            <p className="text-xs text-slate-400">
              {monitoringOverview?.auto_monitoring?.is_enabled && monitoringOverview?.auto_monitoring?.next_run_at
                ? `Next scheduled run: ${new Date(
                    monitoringOverview.auto_monitoring.next_run_at
                  ).toLocaleDateString()}`
                : monitoringOverview?.last_completed_check_date
                ? `Last check (${monitoringOverview.last_completed_check_source}): ${new Date(
                    monitoringOverview.last_completed_check_date
                  ).toLocaleDateString()}`
                : 'No completed HIBP or live scan checks recorded yet.'}
            </p>
          </div>
          <Link
            to="/breach-monitoring"
            className="inline-flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#101214] hover:bg-[#1B1E22] border border-[#292D32] text-xs font-semibold text-emerald-400"
          >
            <span>Configure Monitoring</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* 7. BOTTOM DASHBOARD SECTIONS */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <ActivityTimeline />
        <RecommendationCard onToast={showToast} />
        <SecurityAlertCard onToast={showToast} monitoringOverview={monitoringOverview} />
      </section>
    </div>
  );
};

export default DashboardPage;
