import React, { useState } from 'react';
import { User, Settings, LogOut, ChevronDown, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const ProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Fallback demo user if not logged in
  const currentUser = user || {
    full_name: 'Alex Vance',
    email: 'alex.vance@traceguard.io',
  };

  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
    navigate('/login');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 rounded-xl bg-[#151719] hover:bg-[#1B1E22] border border-[#292D32] hover:border-[#078BFF]/40 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#078BFF] via-[#00CFFF] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold ring-1 ring-white/10 shrink-0">
          {currentUser.full_name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="hidden sm:block text-left pr-1">
          <div className="text-xs font-bold text-white leading-tight">
            {currentUser.full_name}
          </div>
          <div className="text-[10px] text-[#22C55E] flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3 h-3" />
            <span>Audited Profile</span>
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-56 bg-[#151719] border border-[#292D32] rounded-xl shadow-2xl z-50 overflow-hidden py-1.5 animate-in fade-in duration-150">
            <div className="px-4 py-2.5 border-b border-[#292D32] bg-[#101214]">
              <div className="text-xs font-bold text-white truncate">
                {currentUser.full_name}
              </div>
              <div className="text-[11px] font-mono text-[#9CA3AF] truncate mt-0.5">
                {currentUser.email}
              </div>
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/profile');
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-[#9CA3AF] hover:text-white hover:bg-[#1B1E22] flex items-center gap-2.5 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-[#078BFF]" />
                <span>My Profile</span>
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/settings');
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-[#9CA3AF] hover:text-white hover:bg-[#1B1E22] flex items-center gap-2.5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>Security Settings</span>
              </button>
            </div>

            <div className="pt-1 border-t border-[#292D32]">
              <button
                onClick={handleLogout}
                className="w-full text-left px-3.5 py-2 text-xs text-[#EF4444] hover:bg-[#EF4444]/10 flex items-center gap-2.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

