import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { DashboardHeader } from './DashboardHeader';
import { CheckCircle2, X } from 'lucide-react';

const ROUTE_HEADERS = [
  { prefix: '/scan-history', title: 'Scan History', subtitle: 'Audit explorer, verification counts, and isolated demo scans.' },
  { prefix: '/history', title: 'Scan History', subtitle: 'Audit explorer, verification counts, and isolated demo scans.' },
  { prefix: '/activity', title: 'Security Activity Log', subtitle: 'Chronological zero-knowledge event telemetry.' },
  { prefix: '/analytics', title: 'Security Analytics', subtitle: 'Real-data risk trends, pillar coverage, and exposure breakdowns.' },
  { prefix: '/security-analytics', title: 'Security Analytics', subtitle: 'Real-data risk trends, pillar coverage, and exposure breakdowns.' },
  { prefix: '/ai-assistant', title: 'AI Security Assistant', subtitle: 'Grounded guidance powered by your verified security posture.' },
  { prefix: '/recommendations', title: 'Security Recommendations', subtitle: 'Prioritized remediations synced to active findings.' },
  { prefix: '/security-alerts', title: 'Security Recommendations', subtitle: 'Prioritized remediations synced to active findings.' },
  { prefix: '/breach-monitoring', title: 'Security Monitoring', subtitle: 'Manual audit reminders, HIBP logs, and live scan history.' },
  { prefix: '/monitoring', title: 'Security Monitoring', subtitle: 'Manual audit reminders, HIBP logs, and live scan history.' },
  { prefix: '/reports', title: 'Security Dossiers', subtitle: 'Generate and download cryptographic PDF audit reports.' },
  { prefix: '/app-permissions', title: 'Permission Auditor', subtitle: 'Browser API permission checks and manual app scope reviews.' },
  { prefix: '/permission-auditor', title: 'Permission Auditor', subtitle: 'Browser API permission checks and manual app scope reviews.' },
  { prefix: '/media-scanner', title: 'Media Scanner', subtitle: 'On-device AI sensitivity detection, EXIF analysis, and PII sanitization.' },
  { prefix: '/dashboard/media-leak-check', title: 'Media Leak Check', subtitle: 'External visual footprint and public search assistance.' },
  { prefix: '/data-exposure', title: 'Personal Data Exposure', subtitle: 'On-demand HIBP API scanning and isolated demo audits.' },
  { prefix: '/password-security', title: 'Password Security', subtitle: 'Zero-knowledge k-anonymity password breach verification.' },
  { prefix: '/risk-score', title: 'Privacy Risk Score', subtitle: 'Transparent 5-pillar attack surface breakdown.' },
  { prefix: '/settings', title: 'Settings', subtitle: 'Account security and application preferences.' },
  { prefix: '/support', title: 'Support', subtitle: 'Documentation and assistance for TRACE GUARD.' },
  { prefix: '/profile', title: 'User Profile', subtitle: 'Manage your authenticated TRACE GUARD identity.' },
];

export const DashboardLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const location = useLocation();

  const headerMeta = ROUTE_HEADERS.find((r) => location.pathname.startsWith(r.prefix)) || {
    title: 'Security Overview',
    subtitle: 'Monitor your verified personal digital footprint.',
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white flex cyber-grid-pattern">
      {/* Sidebar */}
      <AppSidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <DashboardHeader
          onMobileMenuToggle={() => setMobileOpen(!mobileOpen)}
          title={headerMeta.title}
          subtitle={headerMeta.subtitle}
        />

        <main className="flex-1 p-5 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet context={{ showToast, searchQuery }} />
        </main>
      </div>

      {/* Cyber Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#151719] border border-[#078BFF]/60 px-4 py-3 rounded-xl shadow-[0_0_20px_rgba(7,139,255,0.3)] flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#00CFFF] shrink-0" />
          <span className="text-xs font-semibold text-white">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 text-[#9CA3AF] hover:text-white ml-2"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
