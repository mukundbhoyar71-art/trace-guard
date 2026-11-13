import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Database,
  Bell,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
  History,
  FileCheck,
  ShieldAlert,
  Calendar,
  Trash2,
  Power,
  Eye,
  Play,
  Cpu,
  Save,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { monitoringService } from '../services/monitoringService';

export const BreachMonitoringPage = () => {
  const { user } = useAuth();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Automated Monitoring Config State
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoFrequency, setAutoFrequency] = useState('monthly');
  const [autoEmail, setAutoEmail] = useState(user?.email || '');
  const [savingAutoConfig, setSavingAutoConfig] = useState(false);
  const [runningAutoCheck, setRunningAutoCheck] = useState(false);

  // Manual Reminder Form State (Strictly Separate from Automated API Checks)
  const [reminderEmail, setReminderEmail] = useState(user?.email || '');
  const [reminderFrequency, setReminderFrequency] = useState('monthly');
  const [reminderNotes, setReminderNotes] = useState('');
  const [submittingReminder, setSubmittingReminder] = useState(false);

  // External Check Form State
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [checkEmail, setCheckEmail] = useState(user?.email || '');
  const [breachesCount, setBreachesCount] = useState(0);
  const [breachNames, setBreachNames] = useState('');
  const [checkNotes, setCheckNotes] = useState('');
  const [submittingCheck, setSubmittingCheck] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setReminderEmail((prev) => prev || user.email);
      setCheckEmail((prev) => prev || user.email);
      setAutoEmail((prev) => prev || user.email);
    }
  }, [user]);

  const showNotification = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const overviewData = await monitoringService.getOverview();
        setOverview(overviewData);

        if (overviewData?.active_reminder) {
          setReminderEmail(overviewData.active_reminder.target_email || user?.email || '');
          setReminderFrequency(overviewData.active_reminder.frequency || 'monthly');
        }
        if (overviewData?.auto_monitoring) {
          setAutoEnabled(Boolean(overviewData.auto_monitoring.is_enabled));
          setAutoFrequency(overviewData.auto_monitoring.frequency || 'monthly');
          setAutoEmail(overviewData.auto_monitoring.target_email || user?.email || '');
        }
      } catch (err) {
        console.error('Failed to load monitoring overview:', err);
        setError(err.message || 'Failed to load breach monitoring telemetry.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save Automated Monitoring Config
  const handleSaveAutoConfig = async (e) => {
    e.preventDefault();
    setSavingAutoConfig(true);
    try {
      await monitoringService.updateConfig({
        is_enabled: autoEnabled,
        frequency: autoFrequency,
        target_email: autoEmail.trim() || user?.email,
      });
      showNotification(
        autoEnabled
          ? `Automated scheduled monitoring saved (${autoFrequency}).`
          : 'Automated scheduled monitoring paused.'
      );
      await loadData(true);
    } catch (err) {
      showNotification(err.message || 'Failed to save automated monitoring schedule.', 'error');
    } finally {
      setSavingAutoConfig(false);
    }
  };

  // Run Immediate Automated Monitoring Check
  const handleRunMonitoringNow = async () => {
    setRunningAutoCheck(true);
    try {
      const execResult = await monitoringService.runMonitoringNow();
      if (execResult?.status === 'failed') {
        showNotification(
          `Monitoring check recorded failure: ${execResult.error_message || 'Provider unavailable'}`,
          'error'
        );
      } else {
        showNotification(
          `Automated check completed (${execResult?.findings_count ?? 0} verified breach findings).`
        );
      }
      await loadData(true);
    } catch (err) {
      showNotification(err.message || 'Failed to trigger automated monitoring execution.', 'error');
    } finally {
      setRunningAutoCheck(false);
    }
  };

  // Handle setting or updating manual reminder
  const handleSaveReminder = async (e) => {
    e.preventDefault();
    if (!reminderEmail) return;

    setSubmittingReminder(true);
    try {
      await monitoringService.createReminder({
        target_email: reminderEmail.trim(),
        frequency: reminderFrequency,
        notes: reminderNotes.trim() || null,
      });
      showNotification(`Manual monitoring reminder enabled (${reminderFrequency}).`);
      setReminderNotes('');
      await loadData(true);
    } catch (err) {
      showNotification(err.message || 'Failed to save reminder.', 'error');
    } finally {
      setSubmittingReminder(false);
    }
  };

  // Handle enabling/disabling reminder
  const handleToggleReminderActive = async (reminder) => {
    try {
      const nextState = !reminder.is_active;
      await monitoringService.updateReminder(reminder.id, { is_active: nextState });
      showNotification(nextState ? 'Manual reminder enabled.' : 'Manual reminder disabled.');
      await loadData(true);
    } catch (err) {
      showNotification(err.message || 'Failed to update reminder status.', 'error');
    }
  };

  // Handle deleting reminder
  const handleDeleteReminder = async (reminderId) => {
    try {
      await monitoringService.deleteReminder(reminderId);
      showNotification('Manual monitoring reminder removed.');
      await loadData(true);
    } catch (err) {
      showNotification(err.message || 'Failed to delete reminder.', 'error');
    }
  };

  // Handle recording manual external check
  const handleRecordCheck = async (e) => {
    e.preventDefault();
    setSubmittingCheck(true);

    const names = breachNames
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

    try {
      await monitoringService.recordExternalCheck({
        email: checkEmail.trim(),
        breaches_found_count: parseInt(breachesCount, 10) || 0,
        breach_names: names,
        user_notes: checkNotes.trim() || null,
      });
      showNotification('User-confirmed HIBP check logged.');
      setShowCheckModal(false);
      setBreachesCount(0);
      setBreachNames('');
      setCheckNotes('');
      await loadData(true);
    } catch (err) {
      showNotification(err.message || 'Failed to record check.', 'error');
    } finally {
      setSubmittingCheck(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Up to Date':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Up to Date
          </span>
        );
      case 'Scheduled Reminder Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            <Clock className="w-3.5 h-3.5" /> Reminder Pending
          </span>
        );
      case 'Check Overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" /> Check Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-300 border border-slate-500/30">
            <Info className="w-3.5 h-3.5" /> No Audits Yet
          </span>
        );
    }
  };

  const getExecutionStatusBadge = (execStatus) => {
    switch ((execStatus || '').toLowerCase()) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> {execStatus || 'Skipped'}
          </span>
        );
    }
  };

  const isReminderEnabled = Boolean(overview?.monitoring_enabled);
  const autoCfg = overview?.auto_monitoring;
  const recentExecutions = overview?.recent_executions || [];
  const liveScans = overview?.recent_live_scans || [];
  const recentChecks = overview?.recent_checks || [];
  const reminderHistory = overview?.reminder_history || [];

  return (
    <div className="space-y-6 pb-10">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium flex items-center gap-2.5 transition-all duration-300 max-w-md ${
            toast.type === 'error'
              ? 'bg-rose-950/95 text-rose-200 border-rose-800'
              : 'bg-emerald-950/95 text-emerald-200 border-emerald-800'
          }`}
        >
          {toast.type === 'error' ? (
            <XCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#292D32]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Security Monitoring & Scheduled Scans</h1>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Persistent Scheduler & Manual Cadence
            </span>
          </div>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Configure automated scheduled HIBP API monitoring, manage separate manual audit reminders, and inspect execution outcomes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-300 hover:text-white border border-[#292D32] transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCheckModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Record HIBP Audit</span>
          </button>
        </div>
      </div>

      {/* Truthful Architecture Disclosure */}
      <div className="bg-[#101214] border border-[#292D32] rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300">
        <ShieldCheck className="w-5 h-5 text-[#00CFFF] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white block mb-0.5">
            Transparent Monitoring Model (Automated API Checks vs. Manual Reminders):
          </span>
          {overview?.monitoring_mode_note ||
            'TRACE GUARD separates automated HIBP API schedules from manual user audit reminders. Automated runs never fabricate success when HIBP_API_KEY is unconfigured.'}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 flex items-center justify-between gap-4 text-xs text-rose-200">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData(false)}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold border border-rose-500/40"
          >
            Retry
          </button>
        </div>
      )}

      {/* Four Summary Telemetry Cards */}
      {loading && !overview ? (
        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-10 flex items-center justify-center gap-2.5 text-xs text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
          <span>Synchronizing monitoring state...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Automated Scheduled Check Status */}
          <div className="bg-[#101214] border border-[#292D32] rounded-xl p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Automated API Schedule
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  autoCfg?.is_enabled
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {autoCfg?.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <div className="text-lg font-bold text-white capitalize mb-1">
                {autoCfg?.is_enabled ? `${autoCfg.frequency} Auto-Check` : 'Manual Only'}
              </div>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${
                  autoCfg?.hibp_configured
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
              >
                {autoCfg?.hibp_configured ? 'HIBP API Configured' : 'HIBP Key Missing'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-[#292D32]/60">
              Next Run:{' '}
              <b className="text-slate-200">
                {autoCfg?.is_enabled && autoCfg?.next_run_at
                  ? new Date(autoCfg.next_run_at).toLocaleDateString()
                  : 'Not Scheduled'}
              </b>
            </div>
          </div>

          {/* Card 2: Manual Audit Cadence */}
          <div className="bg-[#101214] border border-[#292D32] rounded-xl p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Manual Audit Reminders
              </span>
              <Bell className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-white mb-1.5">
                {overview?.monitoring_status || 'No Audits Yet'}
              </div>
              {overview && getStatusBadge(overview.monitoring_status)}
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-[#292D32]/60">
              Reminder:{' '}
              <b className="text-slate-200 capitalize">
                {overview?.reminder_frequency || 'Disabled'}
              </b>
            </div>
          </div>

          {/* Card 3: Last Completed Check */}
          <div className="bg-[#101214] border border-[#292D32] rounded-xl p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Last Completed Check
              </span>
              <Clock className="w-4 h-4 text-[#00CFFF]" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">
                {overview?.last_completed_check_date
                  ? new Date(overview.last_completed_check_date).toLocaleDateString()
                  : 'Never Performed'}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {overview?.last_completed_check_date
                  ? new Date(overview.last_completed_check_date).toLocaleTimeString()
                  : 'Zero live scans or external HIBP checks logged.'}
              </p>
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-[#292D32]/60">
              Source: <b className="text-slate-200">{overview?.last_completed_check_source || 'Never Performed'}</b>
            </div>
          </div>

          {/* Card 4: Verified Telemetry Counts */}
          <div className="bg-[#101214] border border-[#292D32] rounded-xl p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Verified Telemetry Counts
              </span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Live Scans</span>
                <span className="text-2xl font-black text-white">{overview?.live_scans_count ?? 0}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">HIBP Logs</span>
                <span className="text-2xl font-black text-white">{overview?.total_external_checks ?? 0}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-2 border-t border-[#292D32]/60">
              {overview?.demo_scans_count > 0 ? (
                <span className="text-purple-300">
                  {overview.demo_scans_count} simulated demo scan(s) excluded
                </span>
              ) : (
                <span>Demo scans excluded from metrics</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BLOCK 1 & 2: AUTOMATED SCHEDULED MONITORING CONFIG & EXECUTION HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Block 1: Automated Scheduled Monitoring Configuration */}
        <div className="lg:col-span-5 bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#292D32]">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-[#00CFFF]" />
              <div>
                <h2 className="text-base font-semibold text-white">Automated Scheduled Monitoring</h2>
                <p className="text-[11px] text-slate-400">
                  Backend scheduler checks your account email automatically (requires HIBP_API_KEY).
                </p>
              </div>
            </div>
          </div>

          {!autoCfg?.hibp_configured && (
            <div className="p-3 rounded-lg bg-amber-950/35 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <b className="text-white block">HIBP API Key Not Configured</b>
                Automated executions will record an explicit <code>failed</code> status until{' '}
                <code>HIBP_API_KEY</code> is set on the backend server.
              </div>
            </div>
          )}

          <form onSubmit={handleSaveAutoConfig} className="space-y-4">
            <label className="flex items-center justify-between p-3 rounded-lg bg-[#151719] border border-[#292D32] cursor-pointer">
              <div>
                <span className="text-xs font-bold text-white block">Enable Automated Background Checks</span>
                <span className="text-[11px] text-slate-400">
                  Runs idempotently once per due schedule window.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(e) => setAutoEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#078BFF] cursor-pointer"
              />
            </label>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Schedule Frequency
              </label>
              <select
                value={autoFrequency}
                onChange={(e) => setAutoFrequency(e.target.value)}
                className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#078BFF]"
              >
                <option value="daily">Daily (24-Hour Window)</option>
                <option value="weekly">Weekly (7-Day Window)</option>
                <option value="monthly">Monthly (30-Day Window)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Target Identity Email (Owner-Locked)
              </label>
              <input
                type="email"
                value={autoEmail}
                readOnly
                className="w-full bg-[#151719]/60 border border-[#292D32] rounded-lg px-3 py-2 text-sm text-slate-300 font-mono cursor-not-allowed"
              />
            </div>

            {autoCfg?.last_error && (
              <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-300 font-mono">
                Last Error: {autoCfg.last_error}
              </div>
            )}

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="submit"
                disabled={savingAutoConfig}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#078BFF] hover:bg-[#0576DB] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {savingAutoConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Schedule</span>
              </button>

              <button
                type="button"
                onClick={handleRunMonitoringNow}
                disabled={runningAutoCheck}
                className="py-2.5 px-4 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-[#00CFFF] border border-[#078BFF]/40 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {runningAutoCheck ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Run Check Now</span>
              </button>
            </div>
          </form>
        </div>

        {/* Block 2: Automated Monitoring Execution History */}
        <div className="lg:col-span-7 bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#292D32]">
            <div className="flex items-center gap-2.5">
              <History className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-base font-semibold text-white">Automated Monitoring Execution History</h2>
                <p className="text-[11px] text-slate-400">
                  Verifiable execution logs distinguishing completed HIBP runs from explicit failures.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {recentExecutions.length} Execution{recentExecutions.length === 1 ? '' : 's'}
            </span>
          </div>

          {recentExecutions.length > 0 ? (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase bg-[#151719] text-slate-400 border-b border-[#292D32]">
                  <tr>
                    <th className="px-3 py-2.5">ID</th>
                    <th className="px-3 py-2.5">Trigger</th>
                    <th className="px-3 py-2.5">Started At</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Findings</th>
                    <th className="px-3 py-2.5">Details / Scan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#292D32]/50 text-slate-300">
                  {recentExecutions.map((exe) => (
                    <tr key={exe.id} className="hover:bg-[#151719]/60">
                      <td className="px-3 py-2.5 font-mono text-white">#{exe.id}</td>
                      <td className="px-3 py-2.5 capitalize font-semibold">{exe.trigger_type}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap">
                        {new Date(exe.started_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">{getExecutionStatusBadge(exe.status)}</td>
                      <td className="px-3 py-2.5 font-mono">
                        {exe.status === 'completed'
                          ? `${exe.verified_findings_count} verified`
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px]">
                        {exe.scan_id ? (
                          <Link
                            to={`/scan-history/email_exposure/${exe.scan_id}`}
                            className="text-[#00CFFF] hover:underline font-mono"
                          >
                            Inspect EXP-{exe.scan_id}
                          </Link>
                        ) : exe.error_message ? (
                          <span className="text-rose-300 line-clamp-2" title={exe.error_message}>
                            {exe.error_message}
                          </span>
                        ) : (
                          <span className="text-slate-400">Logged</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-slate-400 border border-dashed border-[#292D32] rounded-xl bg-[#151719]/40">
              No automated monitoring executions have run yet. Save a schedule or click <b>Run Check Now</b>.
            </div>
          )}
        </div>
      </div>

      {/* Official HIBP External Check CTA Banner */}
      <div className="bg-gradient-to-br from-[#101214] via-[#12151B] to-[#151922] border border-[#292D32] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
              <Database className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-white">Official Have I Been Pwned Manual Audit Workflow</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
            Inspect your email on Have I Been Pwned directly without passing email parameters in URLs, then click{' '}
            <b className="text-white">Record HIBP Audit</b> to log your user-confirmed finding count honestly into your security score.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <a
            href="https://haveibeenpwned.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold transition-colors"
          >
            <span>Check Email on HIBP</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setShowCheckModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-white border border-[#292D32] text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Log Confirmed Result</span>
          </button>
        </div>
      </div>

      {/* BLOCK 3 & 4: MANUAL REMINDERS vs EXTERNAL CHECK HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Block 3: Manual Audit Reminder Notifications */}
        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#292D32]">
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="text-base font-semibold text-white">Manual Audit Reminders</h2>
                <p className="text-[11px] text-slate-400">
                  Separate from Automated Scans — prompts you to perform manual verification.
                </p>
              </div>
            </div>
            {overview?.active_reminder && (
              <button
                type="button"
                onClick={() => handleToggleReminderActive(overview.active_reminder)}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
              >
                <Power className="w-3 h-3" />
                <span>Disable Active</span>
              </button>
            )}
          </div>

          {overview?.active_reminder && overview.active_reminder.is_active ? (
            <div className="bg-[#151719] border border-indigo-500/30 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-indigo-400 tracking-wider">
                  Active Manual Reminder
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Enabled
                </span>
              </div>
              <div className="text-sm text-slate-200">
                Target: <span className="font-semibold text-white">{overview.active_reminder.target_email}</span>
              </div>
              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-4">
                <span>
                  Frequency: <b className="text-slate-200 capitalize">{overview.active_reminder.frequency}</b>
                </span>
                <span>
                  Next due: <b className="text-slate-200">{new Date(overview.active_reminder.next_reminder_at).toLocaleDateString()}</b>
                </span>
              </div>
              {overview.active_reminder.notes && (
                <p className="text-xs text-slate-400 italic">"{overview.active_reminder.notes}"</p>
              )}
            </div>
          ) : (
            <div className="bg-[#151719] border border-[#292D32] rounded-lg p-3.5 text-xs text-slate-400">
              Manual audit reminders are currently <b className="text-white">disabled</b>. Configure a reminder cadence below.
            </div>
          )}

          <form onSubmit={handleSaveReminder} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Email</label>
              <input
                type="email"
                value={reminderEmail}
                onChange={(e) => setReminderEmail(e.target.value)}
                required
                className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Reminder Frequency</label>
              <select
                value={reminderFrequency}
                onChange={(e) => setReminderFrequency(e.target.value)}
                className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="weekly">Weekly (Intensive Cadence)</option>
                <option value="biweekly">Bi-weekly (14-Day Cadence)</option>
                <option value="monthly">Monthly (Recommended Baseline)</option>
                <option value="quarterly">Quarterly (90-Day Audit)</option>
                <option value="one_time">One-time (30 Days)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Audit Notes (Optional)</label>
              <input
                type="text"
                value={reminderNotes}
                onChange={(e) => setReminderNotes(e.target.value)}
                placeholder="e.g. Check secondary emails and work aliases"
                className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={submittingReminder}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submittingReminder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              <span>{isReminderEnabled ? 'Update Active Reminder' : 'Enable Reminder Schedule'}</span>
            </button>
          </form>

          {/* Reminder History */}
          {reminderHistory.length > 0 && (
            <div className="pt-4 border-t border-[#292D32] space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Manual Reminder History ({reminderHistory.length})
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {reminderHistory.map((rem) => (
                  <div
                    key={rem.id}
                    className="flex items-center justify-between gap-2 bg-[#151719] border border-[#292D32] rounded-lg px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white capitalize">{rem.frequency}</span>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                            rem.is_active
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {rem.is_active ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {rem.target_email} • Due {new Date(rem.next_reminder_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleReminderActive(rem)}
                        title={rem.is_active ? 'Disable Reminder' : 'Re-enable Reminder'}
                        className="px-2 py-1 rounded bg-[#101214] hover:bg-[#1B1E22] text-slate-300 hover:text-white border border-[#292D32] text-[10px] font-semibold"
                      >
                        {rem.is_active ? 'Pause' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReminder(rem.id)}
                        title="Delete Reminder"
                        className="p-1.5 rounded bg-[#101214] hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-[#292D32]"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Block 4: External Verification History (User-Confirmed HIBP Checks) */}
        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#292D32]">
            <div className="flex items-center gap-2.5">
              <FileCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-base font-semibold text-white">External HIBP Confirmation History</h2>
                <p className="text-[11px] text-slate-400">User-attested checks logged manually after visiting HIBP.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCheckModal(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              + Log Check
            </button>
          </div>

          {recentChecks.length > 0 ? (
            <div className="space-y-3 max-h-[470px] overflow-y-auto pr-1">
              {recentChecks.map((chk) => (
                <div
                  key={chk.id}
                  className="bg-[#151719] border border-[#292D32] rounded-lg p-3.5 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white font-mono">{chk.email}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        chk.breaches_found_count > 0
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {chk.breaches_found_count === 0
                        ? 'Zero Breaches Reported'
                        : `${chk.breaches_found_count} Breach(es) Reported`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                    <span>Checked: {new Date(chk.check_date).toLocaleString()}</span>
                    <span className="text-indigo-300 font-medium px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                      User-Attested Manual Check
                    </span>
                  </div>
                  {chk.breach_names && chk.breach_names.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {chk.breach_names.map((bName, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-[#101214] text-slate-300 px-2 py-0.5 rounded border border-[#292D32]"
                        >
                          {bName}
                        </span>
                      ))}
                    </div>
                  )}
                  {chk.user_notes && (
                    <p className="text-xs text-slate-400 italic pt-1">"{chk.user_notes}"</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500 text-xs space-y-2 border border-dashed border-[#292D32] rounded-xl bg-[#151719]/40">
              <FileCheck className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-slate-300 font-semibold">No manual external checks recorded yet.</p>
              <p className="max-w-xs mx-auto text-slate-400">
                Perform a check on Have I Been Pwned and record your verified outcome here to track external history.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Live Breach Monitoring History (Strictly Live Scans Only — Zero Demo Leakage) */}
      <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#292D32]">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-[#078BFF]" />
            <div>
              <h2 className="text-base font-semibold text-white">Live API Breach Scan History</h2>
              <p className="text-[11px] text-slate-400">
                Displays genuine Have I Been Pwned API scans only (manual and scheduled). Simulated demo scans are excluded.
              </p>
            </div>
          </div>

          <Link
            to="/scan-history"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00CFFF] hover:underline"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Open Unified Scan History</span>
          </Link>
        </div>

        {liveScans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase bg-[#151719] text-slate-400 border-b border-[#292D32]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Target Email</th>
                  <th className="px-4 py-3">Scan Type</th>
                  <th className="px-4 py-3">Breaches</th>
                  <th className="px-4 py-3">Verified / Unverified</th>
                  <th className="px-4 py-3">Risk Score</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292D32]/50 text-slate-300">
                {liveScans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-[#151719]/60 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                      {new Date(scan.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-white font-mono text-xs">{scan.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        {scan.scan_type || 'Live HIBP API Scan'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{scan.breaches_count}</td>
                    <td className="px-4 py-3 text-xs font-mono">
                      <span className="text-emerald-400">{scan.verified_findings_count} Verified</span>
                      {' / '}
                      <span className="text-slate-400">{scan.unverified_findings_count} Unverified</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-bold ${
                          scan.risk_score >= 60
                            ? 'text-rose-400'
                            : scan.risk_score >= 30
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {scan.risk_score}/100 ({scan.risk_level})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-slate-300">{scan.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400 space-y-2 border border-dashed border-[#292D32] rounded-xl bg-[#151719]/40">
            <p className="font-semibold text-white">No live API exposure scans performed yet.</p>
            {overview?.demo_scans_count > 0 && (
              <p className="text-purple-300">
                Note: You have {overview.demo_scans_count} simulated demo scan(s), which are isolated in{' '}
                <Link to="/scan-history" className="underline font-semibold">
                  Scan History
                </Link>{' '}
                and excluded from live monitoring.
              </p>
            )}
            <div className="pt-1">
              <Link
                to="/data-exposure"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#078BFF] hover:bg-[#0576DB] text-white font-semibold"
              >
                <span>Open Exposure Scanner</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Record HIBP Check */}
      {showCheckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#101214] border border-[#292D32] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#292D32]">
              <h3 className="text-lg font-bold text-white">Record HIBP Audit Finding</h3>
              <button
                type="button"
                onClick={() => setShowCheckModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Enter the findings you personally observed on Have I Been Pwned. This updates your monitoring log and Privacy Risk Score accurately.
            </p>

            <form onSubmit={handleRecordCheck} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Email</label>
                <input
                  type="email"
                  value={checkEmail}
                  onChange={(e) => setCheckEmail(e.target.value)}
                  required
                  className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Breaches Found Count</label>
                <input
                  type="number"
                  min="0"
                  value={breachesCount}
                  onChange={(e) => setBreachesCount(e.target.value)}
                  required
                  className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Breach Names (comma-separated, optional)
                </label>
                <input
                  type="text"
                  value={breachNames}
                  onChange={(e) => setBreachNames(e.target.value)}
                  placeholder="e.g. Adobe, Canva, LinkedIn"
                  className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">User Notes (Optional)</label>
                <textarea
                  rows="2"
                  value={checkNotes}
                  onChange={(e) => setCheckNotes(e.target.value)}
                  placeholder="e.g. Rotated passwords on primary accounts after check."
                  className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#292D32]">
                <button
                  type="button"
                  onClick={() => setShowCheckModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCheck}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingCheck && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Save Finding</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BreachMonitoringPage;
