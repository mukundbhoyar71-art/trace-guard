import React from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export const AttackSurfaceCard = ({ factors = [], coveragePercentage = 0 }) => {
  return (
    <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Attack Surface Coverage
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            {factors.length || 5} Vectors Tracked
          </span>
        </div>

        <div className="space-y-3.5">
          {factors.map((v) => (
            <div key={v.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">{v.name}</span>
                <span className="text-slate-400 font-mono text-[11px]">{v.score} / {v.weight} pts</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    v.score >= 15 ? 'bg-rose-500' : v.score > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (v.score / v.weight) * 100)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>Assessment Confidence:</span>
        <span className="font-semibold text-white">{coveragePercentage}% Evaluated</span>
      </div>
    </div>
  );
};

export default AttackSurfaceCard;
