import React from 'react';
import { HelpCircle, Mail, BookOpen, MessageSquare } from 'lucide-react';

export const SupportPage = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="cyber-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#078BFF]/10 border border-[#078BFF]/30 flex items-center justify-center text-[#078BFF]">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">TRACE GUARD Support & Security Documentation</h1>
            <p className="text-xs text-[#9CA3AF]">
              Privacy protocols, cryptographic verification guides, and security assistance.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] hover:border-[#078BFF]/40 transition-colors">
            <BookOpen className="w-5 h-5 text-[#00CFFF] mb-2" />
            <h3 className="text-xs font-bold text-white mb-1">K-Anonymity Guide</h3>
            <p className="text-[11px] text-[#9CA3AF] leading-snug">
              Learn how your passwords are cryptographic hashes and never transmitted in plaintext.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] hover:border-[#078BFF]/40 transition-colors">
            <Mail className="w-5 h-5 text-[#8B5CF6] mb-2" />
            <h3 className="text-xs font-bold text-white mb-1">Direct Security Desk</h3>
            <p className="text-[11px] text-[#9CA3AF] leading-snug">
              Contact our incident response engineers at <span className="text-white font-mono">security@traceguard.io</span>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] hover:border-[#078BFF]/40 transition-colors">
            <MessageSquare className="w-5 h-5 text-[#22C55E] mb-2" />
            <h3 className="text-xs font-bold text-white mb-1">Community & CVEs</h3>
            <p className="text-[11px] text-[#9CA3AF] leading-snug">
              Inspect verified disclosures, threat intelligence updates, and security advisory reports.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

