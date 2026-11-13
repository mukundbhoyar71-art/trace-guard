import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export const MetricCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badgeText,
  badgeType = 'neutral', // 'success', 'warning', 'danger', 'info', 'neutral'
  trendDirection, // 'up', 'down', 'neutral'
  trendValue,
  sparklineData,
}) => {
  const badgeStyles = {
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/15 text-red-400 border-red-500/30',
    info: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    neutral: 'bg-slate-800 text-slate-300 border-slate-700',
  };

  const iconGlowStyles = {
    success: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 ring-red-500/20',
    info: 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/20',
    neutral: 'bg-slate-800/80 text-slate-400 ring-slate-700/50',
  };

  return (
    <div className="cyber-card p-5 rounded-2xl relative overflow-hidden group">
      {/* Top row: Icon and Badge */}
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ring-1 transition-transform group-hover:scale-105 ${iconGlowStyles[badgeType]}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {badgeText && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeStyles[badgeType]}`}
          >
            {badgeText}
          </span>
        )}
      </div>

      {/* Metric Value */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
          {value}
        </span>
        {trendValue && (
          <div
            className={`flex items-center text-xs font-semibold ${
              trendDirection === 'down'
                ? 'text-emerald-400'
                : trendDirection === 'up'
                ? 'text-red-400'
                : 'text-slate-400'
            }`}
          >
            {trendDirection === 'down' ? (
              <ArrowDownRight className="w-3.5 h-3.5" />
            ) : trendDirection === 'up' ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            <span>{trendValue}</span>
          </div>
        )}
      </div>

      {/* Title & Subtitle */}
      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
        {title}
      </div>
      <div className="text-[11px] text-slate-400 leading-relaxed">{subtitle}</div>

      {/* Decorative gradient flare on hover */}
      <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/15 transition-all"></div>
    </div>
  );
};

