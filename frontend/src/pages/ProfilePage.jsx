import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, Mail, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { monitoringService } from '../services/monitoringService';

export const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [monitoringOverview, setMonitoringOverview] = useState(null);

  useEffect(() => {
    let active = true;
    monitoringService
      .getOverview()
      .then((res) => {
        if (active) setMonitoringOverview(res);
      })
      .catch(() => {
        if (active) setMonitoringOverview(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!user) {
    return (
      <div className="p-8 text-center text-xs text-[#9CA3AF]">
        Loading authenticated profile metadata...
      </div>
    );
  }

  const currentUser = user;
  const isGoogleAuth = Boolean(currentUser.google_id);
  const autoMon = monitoringOverview?.auto_monitoring;
  const monitoringStatusText = autoMon?.is_enabled
    ? `Automated (${autoMon.frequency})`
    : monitoringOverview?.monitoring_enabled
    ? `Manual Reminders (${monitoringOverview.reminder_frequency || 'active'})`
    : 'Not Scheduled';
  const isMonitoringActive = Boolean(autoMon?.is_enabled || monitoringOverview?.monitoring_enabled);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Identity Overview Card */}
      <div className="cyber-card p-6 lg:p-8 rounded-2xl border border-[#292D32]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#292D32]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#078BFF] via-[#00CFFF] to-[#8B5CF6] flex items-center justify-center text-white text-xl font-black shadow-lg shadow-[#078BFF]/20">
              {currentUser.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">{currentUser.full_name}</h2>
                {currentUser.is_email_verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-[#9CA3AF] mt-0.5">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="px-4 py-2 rounded-xl bg-[#151719] hover:bg-[#1B1E22] border border-[#292D32] text-xs font-semibold text-white transition-colors"
            >
              Security Settings
            </button>
            <button
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="px-4 py-2 rounded-xl bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/30 text-xs font-semibold text-[#EF4444] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Security Telemetry Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32]">
            <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mb-1">
              <Shield className="w-4 h-4 text-[#078BFF]" />
              <span>Credential Mechanism</span>
            </div>
            <div className="text-sm font-bold text-white font-mono">
              {isGoogleAuth ? 'Google OpenID Connect' : 'Argon2id (64MB / 2t)'}
            </div>
            <div className="text-[10px] text-[#22C55E] mt-1">
              {isGoogleAuth ? 'OAuth 2.0 verified identity' : 'Memory-hard credential hashing'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32]">
            <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mb-1">
              <KeyRound className="w-4 h-4 text-[#00CFFF]" />
              <span>Session Isolation</span>
            </div>
            <div className="text-sm font-bold text-white font-mono">HTTP-Only / SameSite=Lax</div>
            <div className="text-[10px] text-[#22C55E] mt-1">Protected against XSS scraping</div>
          </div>

          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32]">
            <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mb-1">
              <Mail className="w-4 h-4 text-[#8B5CF6]" />
              <span>Identity Verification</span>
            </div>
            <div className="text-sm font-bold text-white font-mono">
              {isGoogleAuth ? 'Google Email Verified' : 'SHA-256 Single-Use'}
            </div>
            <div className="text-[10px] text-[#22C55E] mt-1">
              {currentUser.is_email_verified ? 'Verified email status' : 'Verification pending'}
            </div>
          </div>
        </div>
      </div>

      {/* Account Info Details */}
      <div className="cyber-card p-6 rounded-2xl border border-[#292D32] space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
          Identity Profile Metadata
        </h3>

        <div className="divide-y divide-[#292D32] text-xs">
          <div className="py-3 flex justify-between items-center">
            <span className="text-[#9CA3AF]">Account ID</span>
            <span className="font-mono text-white">#TG-{currentUser.id}</span>
          </div>

          <div className="py-3 flex justify-between items-center">
            <span className="text-[#9CA3AF]">Primary Monitoring Identity</span>
            <span className="font-mono text-white">{currentUser.email}</span>
          </div>

          <div className="py-3 flex justify-between items-center">
            <span className="text-[#9CA3AF]">Authentication Method</span>
            <span className="font-mono text-[#00CFFF]">
              {isGoogleAuth ? 'Google OAuth 2.0 (OpenID)' : 'Argon2id Email & Password'}
            </span>
          </div>

          <div className="py-3 flex justify-between items-center">
            <span className="text-[#9CA3AF]">Monitoring Status</span>
            <span
              className={`font-semibold flex items-center gap-1.5 ${
                isMonitoringActive ? 'text-[#22C55E]' : 'text-[#9CA3AF]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isMonitoringActive ? 'bg-[#22C55E] animate-pulse' : 'bg-[#6B7280]'
                }`}
              ></span>
              {monitoringOverview ? monitoringStatusText : 'Loading monitoring state...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
