import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Fingerprint,
  Database,
  Lock,
  Gauge,
  FileText,
  Settings,
  HelpCircle,
  User,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  FileSearch,
  Globe,
  Bot,
  BarChart3,
  History,
  BellRing,
} from 'lucide-react';
import { TraceGuardLogo } from '../common/TraceGuardLogo';
import { SearchBar } from '../common/SearchBar';

const mainNavigation = [
  { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Exposure Scanner', path: '/data-exposure', icon: Fingerprint },
  { name: 'Scan History', path: '/scan-history', icon: History, badge: 'New' },
  { name: 'Security Analytics', path: '/analytics', icon: BarChart3, badge: 'Live' },
  { name: 'AI Assistant', path: '/ai-assistant', icon: Bot, badge: 'AI' },
  { name: 'Recommendations', path: '/recommendations', icon: BellRing },
  { name: 'Monitoring', path: '/breach-monitoring', icon: Database },
  { name: 'Reports', path: '/reports', icon: FileText },
  { name: 'Permission Auditor', path: '/app-permissions', icon: ShieldAlert },
  { name: 'Media Scanner', path: '/media-scanner', icon: FileSearch },
  { name: 'Media Leak Check', path: '/dashboard/media-leak-check', icon: Globe },
  { name: 'Password Security', path: '/password-security', icon: Lock },
  { name: 'Privacy Risk Score', path: '/risk-score', icon: Gauge },
];

const bottomNavigation = [
  { name: 'Account Settings', path: '/settings', icon: Settings },
  { name: 'Support', path: '/support', icon: HelpCircle },
  { name: 'Profile', path: '/profile', icon: User },
];

export const AppSidebar = ({
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen,
  searchQuery,
  setSearchQuery,
}) => {
  return (
    <>
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-[#101214] border-r border-[#292D32] flex flex-col transition-all duration-300 ease-in-out select-none ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Section: Logo & Toggle */}
        <div className="h-18 px-4 flex items-center justify-between border-b border-[#292D32] bg-[#101214]">
          {isCollapsed ? (
            <div className="mx-auto py-2">
              <TraceGuardLogo variant="icon" size="sm" />
            </div>
          ) : (
            <div className="py-2 overflow-hidden">
              <TraceGuardLogo variant="full" size="sm" showTagline={true} />
            </div>
          )}

          {/* Desktop Collapse Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#151719] border border-transparent hover:border-[#292D32] transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Search Bar (when expanded) */}
        {!isCollapsed && (
          <div className="px-3 pt-3.5 pb-2">
            <SearchBar
              value={searchQuery || ''}
              onChange={setSearchQuery || (() => {})}
              placeholder="Quick search..."
              hotkey=""
            />
          </div>
        )}

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {!isCollapsed && (
            <div className="px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider text-[#9CA3AF]/60">
              Security Navigation
            </div>
          )}

          {mainNavigation
            .filter((item) =>
              !searchQuery?.trim()
                ? true
                : item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
            )
            .map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen && setMobileOpen(false)}
                title={isCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  `flex items-center ${
                    isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-2.5'
                  } rounded-xl text-xs font-semibold transition-all duration-200 group ${
                    isActive
                      ? 'bg-[#1B1E22] text-[#078BFF] border border-[#078BFF]/40 shadow-[0_0_15px_-3px_rgba(7,139,255,0.25)]'
                      : 'text-[#9CA3AF] hover:text-white hover:bg-[#151719] border border-transparent'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  {!isCollapsed && <span>{item.name}</span>}
                </div>

                {!isCollapsed && item.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#078BFF]/15 text-[#00CFFF] border border-[#078BFF]/30">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Bottom Navigation */}
        <div className="p-3 border-t border-[#292D32] bg-[#0E1012] space-y-1">
          {bottomNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen && setMobileOpen(false)}
                title={isCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  `flex items-center ${
                    isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
                  } rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#1B1E22] text-white border border-[#292D32]'
                      : 'text-[#9CA3AF] hover:text-white hover:bg-[#151719]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0 text-[#9CA3AF]" />
                {!isCollapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}

          {/* System Telemetry Status Indicator */}
          {!isCollapsed && (
            <div className="pt-2 px-2 flex items-center justify-between text-[10px] font-mono text-[#9CA3AF]/70">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse"></span>
                <span>SYSTEM ONLINE</span>
              </span>
              <span className="text-[#078BFF]">v1.0.0</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

