import React, { useEffect } from 'react';
import { ExternalLink, ShieldAlert, X, AlertTriangle, ArrowRight, Lock } from 'lucide-react';

// Trusted external URL whitelist
const TRUSTED_DOMAINS = [
  'lens.google.com',
  'tineye.com',
  'stopncii.org',
  'takeitdown.ncmec.org',
  'cybercrime.gov.in',
  'www.ic3.gov',
  'ic3.gov',
  'www.actionfraud.police.uk',
  'actionfraud.police.uk',
];

const isTrustedUrl = (urlString) => {
  try {
    const parsed = new URL(urlString);
    return TRUSTED_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
};

export const ExternalRedirectModal = ({ isOpen, onClose, targetService }) => {
  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !targetService) return null;

  const { name, operator, url, category } = targetService;
  const isUrlAllowed = isTrustedUrl(url);

  const handleConfirmRedirect = () => {
    if (!isUrlAllowed) {
      alert('Security warning: Redirect to non-whitelisted domain blocked.');
      onClose();
      return;
    }
    // Open in new tab with standard security attributes
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="redirect-dialog-title"
    >
      <div
        className="relative w-full max-w-lg p-6 rounded-2xl bg-[#101214] border border-[#292D32] shadow-[0_0_35px_-5px_rgba(7,139,255,0.2)] text-left space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Icon */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1B1E22] transition-colors"
          aria-label="Cancel redirect"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Badge & Icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 block">
              Third-Party Service Notice
            </span>
            <h3 id="redirect-dialog-title" className="text-lg font-bold text-white tracking-tight">
              You're leaving TRACE GUARD
            </h3>
          </div>
        </div>

        {/* Informative Body Content */}
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed bg-[#151719] p-4 rounded-xl border border-[#292D32]">
          <p>
            You are about to visit <strong className="text-white">{name}</strong>, an external service operated by{' '}
            <strong className="text-white">{operator || 'a third-party organization'}</strong>.
          </p>

          <p className="text-slate-400">
            TRACE GUARD will <strong className="text-indigo-300">not automatically transfer</strong> your photos or videos. Any file you choose to upload on that external website will be handled under that provider's privacy policies and terms of service.
          </p>

          <div className="pt-2 border-t border-[#292D32] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Verified External Provider</span>
            </span>
            {category && <span className="text-slate-500">{category}</span>}
          </div>

          <div className="p-2 rounded bg-[#0E1012] border border-[#292D32]/60 font-mono text-[11px] text-indigo-300 truncate">
            {url}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#151719] hover:bg-[#1B1E22] text-slate-300 border border-[#292D32] text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmRedirect}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
          >
            <span>Continue to external website</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExternalRedirectModal;

