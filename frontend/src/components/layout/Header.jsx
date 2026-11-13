import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Bell,
  ShieldAlert,
  Zap,
  CheckCircle2,
  ChevronDown,
  User,
  Settings,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const routeTitles = {
  '/dashboard': { title: 'Executive Cyber Dashboard', subtitle: 'Real-time digital footprint exposure & threat telemetry' },
  '/attack-surface': { title: 'Attack Surface Overview', subtitle: 'Multi-vector exposure map across credentials, apps, and web' },
  '/breach-scanner': { title: 'Data Breach Scanner', subtitle: 'Live verification against known global compromised datasets' },
  '/password-security': { title: 'Password Exposure Checker', subtitle: 'K-anonymity encrypted hash verification & entropy analysis' },
  '/permission-auditor': { title: 'Application Permission Auditor', subtitle: 'Scope risk classification and invasive hardware access review' },
  '/digital-footprint': { title: 'Digital Footprint Analyzer', subtitle: 'Public visibility, social account profiling, and username correlation' },
  '/ai-assistant': { title: 'AI Security Assistant', subtitle: 'Contextual threat remediation powered by cybersecurity LLM' },
  '/security-alerts': { title: 'Security Alerts & Incident Center', subtitle: 'Prioritized security events and action requirements' },
  '/reports': { title: 'Audit Reports & Compliance', subtitle: 'Generate, review, and export PDF executive security dossiers' },
  '/history': { title: 'Historical Audit Log', subtitle: 'Chronological timeline of all security evaluations' },
  '/settings': { title: 'Account & Security Settings', subtitle: 'Manage identity, authentication preferences, and notification rules' },
  '/profile': { title: 'User Identity Profile', subtitle: 'Verified identity and credentials overview' },
};

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentRouteMeta = routeTitles[location.pathname] || {
    title: 'TRACE GUARD Platform',
    subtitle: 'Cybersecurity & Personal Data Footprint Auditor',
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-[#0A0D14]/90 backdrop-blur-md border-b border-slate-800/80 fixed top-0 right-0 left-64 z-20 px-6 flex items-center justify-between">
      {/* Route Title & Breadcrumb */}
      <div>
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          {currentRouteMeta.title}
        </h1>
        <p className="text-xs text-slate-400 font-medium">
          {currentRouteMeta.subtitle}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Search Bar */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search exposure, CVEs, scans... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 bg-slate-900/90 text-xs text-slate-200 placeholder-slate-500 pl-9 pr-4 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Quick Audit Action Button */}
        <button
          onClick={() => navigate('/breach-scanner')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 border border-indigo-400/30 transition-all"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>New Scan</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 relative transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1.5 right-1.5 ring-2 ring-[#0A0D14]"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-[#151D30] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Security Alerts
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  3 Critical
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                <div className="px-4 py-3 hover:bg-slate-800/40 transition-colors cursor-pointer">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Unverified App Scope
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Camera & Background Location requested by File Manager.
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">10 mins ago</div>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 hover:bg-slate-800/40 transition-colors cursor-pointer">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Password Audit Completed
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Zero matches in 850M+ pwned password catalog.
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">1 hour ago</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-2 border-t border-slate-800 text-center">
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/security-alerts');
                  }}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  View All Alerts & Actions
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold ring-1 ring-white/20">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-white">
                {user?.full_name || 'Alex Vance'}
              </div>
              <div className="text-[10px] text-emerald-400 font-medium">Verified Account</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-[#151D30] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-slate-800">
                <div className="text-xs font-semibold text-white truncate">{user?.full_name}</div>
                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/profile');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>My Profile</span>
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/settings');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Settings</span>
                </button>
              </div>
              <div className="pt-1 border-t border-slate-800">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

