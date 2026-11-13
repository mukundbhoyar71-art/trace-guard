import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Settings,
  ShieldCheck,
  KeyRound,
  LogOut,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Mail,
  Bell,
  Lock,
  Cpu,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { monitoringService } from '../services/monitoringService';

export const SettingsPage = () => {
  const { user, setUser, checkAuth } = useAuth();
  const navigate = useNavigate();

  const [sessionsData, setSessionsData] = useState({ active_sessions_count: 0, sessions: [] });
  const [monitoringCfg, setMonitoringCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [sendingReset, setSendingReset] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);

  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoFrequency, setAutoFrequency] = useState('monthly');

  const showNotice = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSettingsTelemetry = useCallback(async () => {
    setLoading(true);
    try {
      const [sessRes, monRes] = await Promise.all([
        authService.getSessions().catch(() => ({ active_sessions_count: 0, sessions: [] })),
        monitoringService.getOverview().catch(() => null),
      ]);
      setSessionsData(sessRes || { active_sessions_count: 0, sessions: [] });
      if (monRes?.auto_monitoring) {
        setMonitoringCfg(monRes.auto_monitoring);
        setAutoEnabled(Boolean(monRes.auto_monitoring.is_enabled));
        setAutoFrequency(monRes.auto_monitoring.frequency || 'monthly');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettingsTelemetry();
  }, [loadSettingsTelemetry]);

  const handleRequestPasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const res = await authService.requestPasswordReset(user.email);
      showNotice(res?.message || 'Password recovery email dispatched if SMTP/Resend is configured.');
    } catch (err) {
      showNotice(err.message || 'Failed to initiate password reset.', 'error');
    } finally {
      setSendingReset(false);
    }
  };

  const handleLogoutAllSessions = async () => {
    setRevokingAll(true);
    try {
      await authService.logoutAll();
      setUser(null);
      navigate('/login');
    } catch (err) {
      showNotice(err.message || 'Failed to revoke all active sessions.', 'error');
      setRevokingAll(false);
    }
  };

  const handleSaveMonitoringPreferences = async (e) => {
    e.preventDefault();
    setSavingAuto(true);
    try {
      const updated = await monitoringService.updateConfig({
        is_enabled: autoEnabled,
        frequency: autoFrequency,
        target_email: user?.email,
      });
      setMonitoringCfg(updated);
      showNotice(
        autoEnabled
          ? `Automated monitoring schedule updated (${autoFrequency}).`
          : 'Automated monitoring schedule disabled.'
      );
    } catch (err) {
      showNotice(err.message || 'Failed to save monitoring configuration.', 'error');
    } finally {
      setSavingAuto(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium flex items-center gap-2.5 max-w-md ${
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#292D32]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Settings className="w-6 h-6 text-[#078BFF]" />
              <span>Account Settings & Security Controls</span>
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#078BFF]/20 text-[#00CFFF] border border-[#078BFF]/30">
              Live Session Scope
            </span>
          </div>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Manage authenticated account security, active HTTP-only sessions, credential recovery, and monitoring preferences.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            checkAuth();
            loadSettingsTelemetry();
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-300 hover:text-white border border-[#292D32] text-xs font-semibold transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#078BFF]' : ''}`} />
          <span>Refresh Settings</span>
        </button>
      </div>

      {/* Section 1: Authenticated Account Identity */}
      <section className="bg-[#101214] border border-[#292D32] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-[#00CFFF]" />
            <h2 className="text-base font-bold text-white">Identity & Credential Architecture</h2>
          </div>
          <Link to="/profile" className="text-xs font-semibold text-[#00CFFF] hover:underline">
            View Full Profile
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#151719] border border-[#292D32] space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Account Holder</span>
            <div className="text-sm font-bold text-white">{user?.full_name || 'Authenticated User'}</div>
            <div className="font-mono text-slate-300 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-[#078BFF]" />
              <span>{user?.email || '—'}</span>
            </div>
            <div className="pt-1">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  user?.is_email_verified
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {user?.is_email_verified ? 'Verified Account Identity' : 'Verification Pending'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#151719] border border-[#292D32] flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Authentication & Password Recovery
              </span>
              <div className="text-sm font-bold text-white mt-1">
                {user?.google_id ? 'Google OAuth 2.0 (OpenID)' : 'Argon2id Email & Password'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Updating or resetting your password automatically revokes all existing active sessions.
              </p>
            </div>
            {!user?.google_id && (
              <button
                type="button"
                onClick={handleRequestPasswordReset}
                disabled={sendingReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#101214] hover:bg-[#1B1E22] border border-[#292D32] hover:border-[#078BFF]/40 text-xs font-bold text-white transition-colors disabled:opacity-50"
              >
                {sendingReset ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5 text-[#078BFF]" />}
                <span>Send Password Reset Link</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Active Sessions & Security Isolation */}
      <section className="bg-[#101214] border border-[#292D32] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#292D32] pb-3">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">Active Server-Side Sessions</h2>
              <p className="text-[11px] text-slate-400">
                HTTP-Only SameSite cookies tracked server-side ({sessionsData.active_sessions_count} active).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogoutAllSessions}
            disabled={revokingAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-bold transition-colors disabled:opacity-50"
          >
            {revokingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            <span>Revoke All Active Sessions</span>
          </button>
        </div>

        {sessionsData.sessions && sessionsData.sessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase bg-[#151719] text-slate-400 border-b border-[#292D32]">
                <tr>
                  <th className="px-4 py-2.5">Session ID</th>
                  <th className="px-4 py-2.5">Created At</th>
                  <th className="px-4 py-2.5">Last Activity</th>
                  <th className="px-4 py-2.5">Expires At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292D32]/60 text-slate-300 font-mono">
                {sessionsData.sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-[#151719]/50">
                    <td className="px-4 py-2.5 text-white font-bold">#{s.id}</td>
                    <td className="px-4 py-2.5">
                      {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.last_used_at ? new Date(s.last_used_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.expires_at ? new Date(s.expires_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#151719] border border-[#292D32] text-xs text-slate-400">
            No active session metadata returned for this context.
          </div>
        )}
      </section>

      {/* Section 3: Automated Monitoring Preference Sync */}
      <section className="bg-[#101214] border border-[#292D32] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-white">Automated Monitoring Schedule Preference</h2>
              <p className="text-[11px] text-slate-400">
                Synchronized directly with persistent MonitoringConfig in trace_guard.db.
              </p>
            </div>
          </div>
          <Link
            to="/breach-monitoring"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#00CFFF] hover:underline"
          >
            <span>Open Monitoring Console</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <form onSubmit={handleSaveMonitoringPreferences} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="flex items-center justify-between p-3 rounded-xl bg-[#151719] border border-[#292D32] cursor-pointer">
              <div>
                <span className="text-xs font-bold text-white block">Scheduled API Monitoring</span>
                <span className="text-[10px] text-slate-400">
                  {monitoringCfg?.hibp_configured ? 'HIBP API Ready' : 'HIBP Key Required for Execution'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(e) => setAutoEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#078BFF] cursor-pointer"
              />
            </label>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Scan Frequency
            </label>
            <select
              value={autoFrequency}
              onChange={(e) => setAutoFrequency(e.target.value)}
              className="w-full bg-[#151719] border border-[#292D32] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#078BFF]"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={savingAuto}
              className="w-full py-2.5 px-4 rounded-xl bg-[#078BFF] hover:bg-[#0576DB] text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingAuto ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>Save Preference</span>
            </button>
          </div>
        </form>
      </section>

      {/* Section 4: Zero-Knowledge & Provenance Architecture */}
      <section className="bg-[#101214] border border-[#292D32] rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#078BFF]" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Zero-Knowledge & Data Isolation Guarantees
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-[#151719] border border-[#292D32]">
            <div className="font-bold text-white mb-1">Password K-Anonymity</div>
            Only local SHA-1 5-char prefixes are queried against Pwned Passwords. Plaintext passwords are wiped immediately and never transmitted or logged.
          </div>
          <div className="p-3.5 rounded-xl bg-[#151719] border border-[#292D32]">
            <div className="font-bold text-white mb-1">Production vs. Demo Isolation</div>
            Simulated demo scans are quarantined from Production Risk Scoring, Analytics trends, and Automated Monitoring.
          </div>
          <div className="p-3.5 rounded-xl bg-[#151719] border border-[#292D32]">
            <div className="font-bold text-white mb-1">IDOR Access Enforcement</div>
            Every scan dossier, PDF report, permission review, and execution record enforces strict authenticated owner checks.
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
