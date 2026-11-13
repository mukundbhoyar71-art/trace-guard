import React from 'react';
import { Link } from 'react-router-dom';
import {
  Globe,
  Search,
  Video,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';

export const ExternalMediaLeakCard = () => {
  return (
    <div className="bg-gradient-to-r from-[#101214] via-[#151719] to-[#101214] border border-[#292D32] rounded-2xl p-6 relative overflow-hidden group hover:border-[#078BFF]/40 transition-all duration-300">
      {/* Background cyber accent glow */}
      <div className="absolute -right-16 -top-16 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-600/15 transition-all"></div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        {/* Left Information Section */}
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              Web Exposure Intelligence
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Zero Automatic Upload</span>
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>External Media Leak Check</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Check whether your personal photos or videos may be circulating online using trusted external services. Get guidance on protecting and reporting exposed personal media.
            </p>
          </div>

          {/* Feature Highlights Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-[#0E1012] border border-[#292D32]/60 flex items-center gap-2 text-[11px] text-slate-300">
              <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">Google Lens & TinEye</span>
            </div>
            <div className="p-2 rounded-lg bg-[#0E1012] border border-[#292D32]/60 flex items-center gap-2 text-[11px] text-slate-300">
              <Video className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">Local Video Frames</span>
            </div>
            <div className="p-2 rounded-lg bg-[#0E1012] border border-[#292D32]/60 flex items-center gap-2 text-[11px] text-slate-300">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">StopNCII & Take It Down</span>
            </div>
            <div className="p-2 rounded-lg bg-[#0E1012] border border-[#292D32]/60 flex items-center gap-2 text-[11px] text-slate-300">
              <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Takedown Guidance</span>
            </div>
          </div>
        </div>

        {/* Right CTA Button Section */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <Link
            to="/dashboard/media-leak-check"
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_-3px_rgba(79,70,229,0.4)] group-hover:shadow-[0_0_25px_-3px_rgba(79,70,229,0.6)]"
          >
            <span>Explore Media Protection</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ExternalMediaLeakCard;

