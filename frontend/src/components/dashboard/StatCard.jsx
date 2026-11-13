import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badgeText,
  badgeType = 'neutral', // 'success', 'warning', 'danger', 'info', 'neutral'
  isDemo = false,
  trendDirection,
  trendText,
}) => {
  const badgeColors = {
    success: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
    warning: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
    danger: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
    info: 'bg-[#078BFF]/15 text-[#00CFFF] border-[#078BFF]/30',
    purple: 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30',
    neutral: 'bg-[#1B1E22] text-[#9CA3AF] border-[#292D32]',
  };

  const iconColors = {
    success: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/20',
    warning: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20',
    danger: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20',
    info: 'text-[#078BFF] bg-[#078BFF]/10 border-[#078BFF]/20',
    purple: 'text-[#8B5CF6] bg-[#8B5CF6]/10 border-[#8B5CF6]/20',
    neutral: 'text-[#9CA3AF] bg-[#1B1E22] border-[#292D32]',
  };

  return (
    <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between group">
      <div>
        {/* Top: Icon + Badge + Demo tag */}
        <div className="flex items-center justify-between mb-4">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-105 ${iconColors[badgeType]}`}
          >
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex items-center gap-1.5">
            {isDemo && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#101214] text-[#9CA3AF] border border-[#292D32]">
                DEMO
              </span>
            )}
            {badgeText && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeColors[badgeType]}`}
              >
                {badgeText}
              </span>
            )}
          </div>
        </div>

        {/* Value + Trend */}
        <div className="flex items-baseline gap-2 mb-1.5">
          <div className="text-3xl font-black text-white tracking-tight">
            {value}
          </div>
          {trendText && (
            <div
              className={`flex items-center text-xs font-semibold ${
                trendDirection === 'down'
                  ? 'text-[#22C55E]'
                  : trendDirection === 'up'
                  ? 'text-[#EF4444]'
                  : 'text-[#9CA3AF]'
              }`}
            >
              {trendDirection === 'down' ? (
                <ArrowDownRight className="w-3.5 h-3.5" />
              ) : trendDirection === 'up' ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              <span>{trendText}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
          {title}
        </h3>
      </div>

      {/* Subtitle */}
      <p className="text-[11px] text-[#9CA3AF] leading-relaxed mt-2 pt-2 border-t border-[#292D32]/60">
        {subtitle}
      </p>
    </div>
  );
};

