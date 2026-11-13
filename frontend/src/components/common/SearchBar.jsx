import React from 'react';
import { Search, X } from 'lucide-react';

export const SearchBar = ({
  value,
  onChange,
  placeholder = 'Search breaches, telemetry, CVEs...',
  className = '',
  hotkey = 'Ctrl + K',
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#151719] text-xs text-white placeholder-[#9CA3AF]/60 pl-8.5 pr-14 py-2 rounded-lg border border-[#292D32] focus:outline-none focus:border-[#078BFF] focus:ring-1 focus:ring-[#078BFF]/40 transition-all"
      />
      {value ? (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 p-0.5 rounded text-[#9CA3AF] hover:text-white"
        >
          <X className="w-3 h-3" />
        </button>
      ) : hotkey ? (
        <span className="absolute right-2.5 text-[9px] font-mono text-[#9CA3AF] bg-[#101214] px-1.5 py-0.5 rounded border border-[#292D32] pointer-events-none">
          {hotkey}
        </span>
      ) : null}
    </div>
  );
};

