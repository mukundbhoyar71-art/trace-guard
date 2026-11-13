import React from 'react';
import { Globe, Github, Linkedin, Twitter, Instagram, Shield, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const accounts = [
  { platform: 'GitHub', username: '@alexvance-dev', visibility: 'Public Repository & Email', risk: 'Low', icon: Github, color: 'text-slate-200' },
  { platform: 'LinkedIn', username: 'in/alex-vance', visibility: 'Current Employment & Location', risk: 'Moderate', icon: Linkedin, color: 'text-blue-400' },
  { platform: 'X / Twitter', username: '@alex_vance', visibility: 'Public Bio & Tweets', risk: 'Moderate', icon: Twitter, color: 'text-sky-400' },
  { platform: 'Instagram', username: '@alex.vance.life', visibility: 'Private Profile Verified', risk: 'Low', icon: Instagram, color: 'text-pink-400' },
];

export const DigitalFootprintSummary = () => {
  const navigate = useNavigate();

  return (
    <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Digital Footprint Profiles
            </h3>
          </div>
          <button
            onClick={() => navigate('/digital-footprint')}
            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300"
          >
            Manage Profiles
          </button>
        </div>

        <div className="space-y-2.5">
          {accounts.map((acc) => {
            const Icon = acc.icon;
            return (
              <div
                key={acc.platform}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                    <Icon className={`w-4 h-4 ${acc.color}`} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{acc.platform}</div>
                    <div className="text-[10px] text-slate-400">{acc.username}</div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      acc.risk === 'Low'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {acc.risk} Risk
                  </span>
                  <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 justify-end">
                    <Eye className="w-3 h-3" />
                    <span>{acc.visibility}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>Username Reuse Risk:</span>
        <span className="text-emerald-400 font-bold">Isolated (Safe)</span>
      </div>
    </div>
  );
};

