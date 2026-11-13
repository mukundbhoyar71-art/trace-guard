import React from 'react';
import { Mail, ShieldCheck, Globe, Database, Phone, Key } from 'lucide-react';

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'Not assessed';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

export const ExposureCard = ({
  user,
  latestScan,
  hasScanned,
  exposureData,
  monitoringOverview,
}) => {
  const emailVerified = Boolean(user?.is_email_verified);
  const authProvider = user?.google_id ? 'Google OAuth 2.0' : 'Argon2id Credentials';

  const verifiedBreaches = exposureData?.total_breaches ?? latestScan?.breaches_count ?? null;
  const externalChecksCount = monitoringOverview?.total_external_checks ?? 0;
  const topClasses = exposureData?.top_exposed_categories || [];

  const exposureItems = [
    {
      id: 'email',
      name: 'Primary Email',
      value: maskEmail(user?.email),
      status: !hasScanned
        ? 'Not assessed'
        : verifiedBreaches > 0
        ? 'Exposed'
        : 'Protected',
      indexLabel: !hasScanned
        ? 'No Live Scan'
        : `${verifiedBreaches ?? 0} Verified Breach${verifiedBreaches === 1 ? '' : 'es'}`,
      icon: Mail,
      badge: !hasScanned
        ? 'bg-[#1B1E22] text-[#9CA3AF] border-[#292D32]'
        : verifiedBreaches > 0
        ? 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
        : 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
    },
    {
      id: 'identity',
      name: 'Account Identity',
      value: authProvider,
      status: emailVerified ? 'Verified' : 'Unverified',
      indexLabel: emailVerified ? 'Email Verified' : 'Action Needed',
      icon: Key,
      badge: emailVerified
        ? 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30'
        : 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
    },
    {
      id: 'hibp_manual',
      name: 'External HIBP Checks',
      value:
        externalChecksCount > 0
          ? `${externalChecksCount} User-Confirmed Log${externalChecksCount === 1 ? '' : 's'}`
          : 'No HIBP Logs',
      status: externalChecksCount > 0 ? 'Logged' : 'Not assessed',
      indexLabel:
        monitoringOverview?.last_completed_check_date
          ? new Date(monitoringOverview.last_completed_check_date).toLocaleDateString()
          : 'Unchecked',
      icon: ShieldCheck,
      badge:
        externalChecksCount > 0
          ? 'bg-[#078BFF]/15 text-[#00CFFF] border-[#078BFF]/30'
          : 'bg-[#1B1E22] text-[#9CA3AF] border-[#292D32]',
    },
    {
      id: 'data_classes',
      name: 'Exposed Data Classes',
      value:
        topClasses.length > 0
          ? topClasses
              .slice(0, 2)
              .map((c) => c.category)
              .join(', ')
          : hasScanned
          ? 'None in Verified Breaches'
          : 'Awaiting Exposure Scan',
      status: !hasScanned
        ? 'Not assessed'
        : topClasses.length > 0
        ? `${topClasses.length} Exposed`
        : 'Clean',
      indexLabel: !hasScanned
        ? 'Not assessed'
        : `${exposureData?.unresolved_count ?? 0} Unresolved`,
      icon: Database,
      badge: !hasScanned
        ? 'bg-[#1B1E22] text-[#9CA3AF] border-[#292D32]'
        : topClasses.length > 0
        ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
        : 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
    },
    {
      id: 'pii_scope',
      name: 'Phone & Social Profiles',
      value: 'Not Collected / Not Monitored',
      status: 'Not assessed',
      indexLabel: 'Privacy Minimalist Scope',
      icon: Phone,
      badge: 'bg-[#1B1E22] text-[#9CA3AF] border-[#292D32]',
    },
  ];

  return (
    <div className="cyber-card p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]"></span>
            <span>Personal Data Exposure Surface</span>
          </h2>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
            Live database telemetry for your authenticated identity with automatic PII masking.
          </p>
        </div>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#101214] text-[#9CA3AF] border border-[#292D32]">
          AUTHENTICATED SCOPE
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {exposureItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] hover:border-[#078BFF]/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2 gap-1">
                  <div className="w-7 h-7 rounded-lg bg-[#151719] border border-[#292D32] flex items-center justify-center text-[#078BFF] shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full border truncate ${item.badge}`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="text-xs font-bold text-white">{item.name}</div>
                <div className="text-[11px] font-mono text-[#9CA3AF] mt-1 truncate" title={item.value}>
                  {item.value}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#292D32]/60 flex items-center justify-between text-[10px] gap-2">
                <span className="text-[#9CA3AF] shrink-0">Status:</span>
                <span className="font-semibold text-white truncate">{item.indexLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
