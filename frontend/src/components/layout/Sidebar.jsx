import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldAlert,
  DatabaseZap,
  KeyRound,
  ShieldCheck,
  Globe,
  Bot,
  Bell,
  FileText,
  History,
  Settings,
  HelpCircle,
  LogOut,
  Shield,
  Activity,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navigationItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Attack Surface', path: '/attack-surface', icon: ShieldAlert },
  { name: 'Personal Data Exposure', path: '/breach-scanner', icon: DatabaseZap, badge: 'Live' },
  { name: 'Password Security', path: '/password-security', icon: KeyRound },
  { name: 'Permission Auditor', path: '/permission-auditor', icon: ShieldCheck },
  { name: 'Digital Footprint', path: '/digital-footprint', icon: Globe },
  { name: 'AI Assistant', path: '/ai-assistant', icon: Bot, badge: 'AI' },
  { name: 'Security Alerts', path: '/security-alerts', icon: Bell, count: 3 },
  { name: 'Reports', path: '/reports', icon: FileText },
  { name: 'Scan History', path: '/history', icon: History },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-[#0A0D14] border-r border-slate-800/80 flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800/80 bg-[#0A0D14]/80 backdrop-blur-md">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
          <Shield className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-base tracking-wider text-white">TRACE</span>
            <span className="font-extrabold text-base tracking-wider text-indigo-400">GUARD</span>
          </div>
          <span className="text-[10px] tracking-widest text-slate-400 font-semibold uppercase">
            Data Footprint Auditor
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Core Modules
        </div>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {item.badge}
                </span>
              )}
              {item.count && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  {item.count}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* System Status Banner */}
      <div className="px-4 py-3 mx-3 my-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute top-0 left-0 animate-ping opacity-75"></span>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200">Shield Active</div>
            <div className="text-[10px] text-slate-400">Continuous Audit</div>
          </div>
        </div>
        <Activity className="w-4 h-4 text-emerald-400" />
      </div>

      {/* User Session Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-[#080B12]">
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/40 transition-colors">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold ring-1 ring-white/10 shrink-0">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">
                {user?.full_name || 'Authenticated User'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {user?.email || 'user@traceguard.io'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

