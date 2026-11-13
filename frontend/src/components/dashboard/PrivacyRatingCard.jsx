import React from 'react';
import { Award, ShieldAlert, Check, TrendingUp } from 'lucide-react';

export const PrivacyRatingCard = () => {
  return (
    <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Digital Privacy Rating
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Grade A-
          </span>
        </div>

        <div className="flex items-center gap-4 my-3">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-slate-900 border border-indigo-500/30 flex flex-col items-center justify-center text-center shadow-lg shadow-indigo-500/10">
            <span className="text-3xl font-black text-white tracking-tight">84</span>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
              / 100
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-bold text-white">Elevated Protection</div>
            <p className="text-xs text-slate-400 leading-snug">
              Top 15% privacy posture among evaluated individual footprints.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold pt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+6 pts improvement this month</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Credential Leak Vulnerability</span>
          <span className="text-emerald-400 font-semibold">Low</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Social OSINT Visibility</span>
          <span className="text-amber-400 font-semibold">Moderate</span>
        </div>
      </div>
    </div>
  );
};

