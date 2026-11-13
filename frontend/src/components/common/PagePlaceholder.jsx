import React from 'react';
import { Shield, Sparkles, ArrowRight, Construction } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PagePlaceholder = ({
  title,
  subtitle,
  icon: Icon = Shield,
  phaseNumber = 'Phase 2 & 3',
  description,
  actionButtonText = 'Return to Dashboard',
  actionRoute = '/dashboard',
}) => {
  const navigate = useNavigate();

  return (
    <div className="cyber-card p-8 lg:p-12 rounded-2xl text-center max-w-3xl mx-auto my-8 border border-[#292D32]">
      <div className="w-16 h-16 rounded-2xl bg-[#078BFF]/10 border border-[#078BFF]/30 text-[#078BFF] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#078BFF]/10">
        <Icon className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#078BFF]/10 border border-[#078BFF]/30 text-[#00CFFF] text-xs font-bold mb-4">
        <Sparkles className="w-3.5 h-3.5 text-[#00CFFF]" />
        <span>TRACE GUARD Security Module</span>
      </div>

      <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight mb-2">
        {title}
      </h2>
      <p className="text-xs sm:text-sm text-[#9CA3AF] max-w-xl mx-auto leading-relaxed mb-6">
        {subtitle || description}
      </p>

      <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] text-left max-w-md mx-auto mb-8 space-y-2">
        <div className="text-xs font-bold text-white flex items-center gap-2">
          <Construction className="w-4 h-4 text-[#F59E0B]" />
          <span>Architecture Status: Active in Dashboard</span>
        </div>
        <p className="text-[11px] text-[#9CA3AF] leading-normal">
          This security domain is currently synthesized in the main executive dashboard overview. Full standalone deep-dive controls will expand in subsequent phases.
        </p>
      </div>

      <button
        onClick={() => navigate(actionRoute)}
        className="px-6 py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold transition-all shadow-lg shadow-[#078BFF]/30 inline-flex items-center gap-2"
      >
        <span>{actionButtonText}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
