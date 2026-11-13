import React from 'react';
import { Bot, Sparkles, ArrowRight, ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const recommendations = [
  {
    id: 1,
    priority: 'High',
    title: 'Revoke Invasive Background Location',
    description: 'Cloud Drive app does not require background location telemetry to operate cloud storage.',
    actionRoute: '/permission-auditor',
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  {
    id: 2,
    priority: 'Medium',
    title: 'Sanitize Public Repository Commit Email',
    description: 'Your primary email is visible in public GitHub commits. Switch to GitHub private noreply email.',
    actionRoute: '/digital-footprint',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  {
    id: 3,
    priority: 'Low',
    title: 'Enable Hardware Security Key / Passkey',
    description: 'Upgrade high-value accounts from SMS 2FA to FIDO2 / WebAuthn passkeys for phishing resistance.',
    actionRoute: '/ai-assistant',
    badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  },
];

export const AiRecommendationsCard = () => {
  const navigate = useNavigate();

  return (
    <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>AI Security Advisor</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </h3>
          </div>
          <button
            onClick={() => navigate('/ai-assistant')}
            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <span>Ask Advisor</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-2.5">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-white">{rec.title}</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${rec.badge}`}>
                  {rec.priority}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mb-2">
                {rec.description}
              </p>
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => navigate(rec.actionRoute)}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300"
                >
                  Apply Remediation &rarr;
                </button>
                <button
                  onClick={() => navigate('/ai-assistant')}
                  className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <Bot className="w-3 h-3 text-indigo-400" />
                  <span>Explain Risk</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
        <span className="text-[11px] text-slate-400">
          Generated using contextual threat modeling. No sensitive secrets transmitted.
        </span>
      </div>
    </div>
  );
};

