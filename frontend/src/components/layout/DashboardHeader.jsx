import React from 'react';
import { Menu, ShieldAlert } from 'lucide-react';
import { NotificationDropdown } from '../common/NotificationDropdown';
import { ProfileDropdown } from '../common/ProfileDropdown';

export const DashboardHeader = ({
  title = 'Dashboard',
  subtitle = 'Monitor your personal digital security.',
  onMobileMenuToggle,
}) => {
  return (
    <header className="h-18 px-6 lg:px-8 border-b border-[#292D32] bg-[#101214]/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
      {/* Left: Mobile Toggle & Page Headings */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg bg-[#151719] text-[#9CA3AF] hover:text-white border border-[#292D32]"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div>
          <h1 className="text-lg lg:text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span>{title}</span>
          </h1>
          <p className="text-xs text-[#9CA3AF] font-medium leading-none mt-1">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls: Notifications & User Profile Dropdown */}
      <div className="flex items-center gap-3">
        <NotificationDropdown />
        <div className="h-6 w-px bg-[#292D32] mx-1 hidden sm:block"></div>
        <ProfileDropdown />
      </div>
    </header>
  );
};

