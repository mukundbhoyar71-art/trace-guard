import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, KeyRound, CheckCircle2, ArrowRight, HelpCircle } from 'lucide-react';
import { securityService } from '../../services/securityService';

export const PasswordSecurityCard = ({ user, latestPasswordCheck: initialCheck }) => {
  const [latestCheck, setLatestCheck] = useState(initialCheck || null);
  const [loading, setLoading] = useState(initialCheck === undefined);

  useEffect(() => {
    if (initialCheck !== undefined) {
      setLatestCheck(initialCheck);
      setLoading(false);
      return;
    }
    let active = true;
    securityService
      .getActivities(1, 5, 'PASSWORD_BREACH_CHECK')
      .then((res) => {
        if (!active) return;
        const first = res?.items?.[0] || null;
        setLatestCheck(first);
      })
      .catch(() => {
        if (active) setLatestCheck(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialCheck]);

  const meta = latestCheck?.metadata_json || latestCheck?.metadata || {};
  const hasCheck = Boolean(latestCheck);
  const isBreached = Boolean(meta.breached);
  const breachCount = Number(meta.count || 0);
  const entropyBits = Number(meta.entropy_bits || 0);
  const entropyLabel = meta.entropy_label || 'Not assessed';

  const accountCredMethod = user?.google_id
    ? 'Google OAuth 2.0'
    : 'Argon2id (Server Vault)';

  return (
    <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#078BFF]"></span>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Password Security & Exposure Verification
            </h2>
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#101214] text-[#9CA3AF] border border-[#292D32]">
            {hasCheck ? 'K-ANONYMITY VERIFIED' : 'NOT ASSESSED'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Status Box */}
          <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32]">
            <div className="text-[10px] uppercase font-mono font-bold text-[#9CA3AF]">
              Latest K-Anonymity Audit
            </div>
            {loading ? (
              <div className="text-xs text-[#9CA3AF] mt-2">Loading telemetry...</div>
            ) : !hasCheck ? (
              <>
                <div className="text-sm font-bold text-[#9CA3AF] flex items-center gap-1.5 mt-1">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span>Not assessed</span>
                </div>
                <div className="text-[10px] text-[#9CA3AF] mt-1">
                  Run a zero-knowledge password check to verify exposure against HIBP Pwned Passwords.
                </div>
              </>
            ) : isBreached ? (
              <>
                <div className="text-sm font-bold text-[#EF4444] flex items-center gap-1.5 mt-1">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{breachCount.toLocaleString()} Leaks Found</span>
                </div>
                <div className="text-[10px] text-[#9CA3AF] mt-1">
                  Checked {new Date(latestCheck.created_at).toLocaleDateString()} via 5-char SHA-1 prefix.
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-[#22C55E] flex items-center gap-1.5 mt-1">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Zero Breaches Found</span>
                </div>
                <div className="text-[10px] text-[#9CA3AF] mt-1">
                  Checked {new Date(latestCheck.created_at).toLocaleDateString()} against HIBP range corpus.
                </div>
              </>
            )}
          </div>

          {/* Strength Box */}
          <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32]">
            <div className="text-[10px] uppercase font-mono font-bold text-[#9CA3AF]">
              Estimated Entropy
            </div>
            <div
              className={`text-sm font-bold flex items-center gap-1.5 mt-1 ${
                hasCheck ? 'text-[#00CFFF]' : 'text-[#9CA3AF]'
              }`}
            >
              <span>
                {hasCheck ? `${entropyBits} Bits (${entropyLabel})` : 'Not assessed'}
              </span>
            </div>
            <div className="w-full bg-[#151719] h-1.5 rounded-full mt-2 overflow-hidden border border-[#292D32]">
              <div
                className="bg-gradient-to-r from-[#078BFF] to-[#00CFFF] h-full rounded-full transition-all duration-300"
                style={{ width: hasCheck ? `${Math.min(100, (entropyBits / 100) * 100)}%` : '0%' }}
              ></div>
            </div>
          </div>

          {/* Account Credential Architecture */}
          <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32]">
            <div className="text-[10px] uppercase font-mono font-bold text-[#9CA3AF]">
              Account Auth Storage
            </div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-1">
              <span>{accountCredMethod}</span>
            </div>
            <div className="text-[10px] text-[#9CA3AF] mt-1">
              Zero plaintext credentials retained by TRACE GUARD.
            </div>
          </div>
        </div>

        {/* Security Recommendations List */}
        <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] space-y-2">
          <div className="text-xs font-bold text-white flex items-center gap-2">
            <KeyRound className="w-3.5 h-3.5 text-[#078BFF]" />
            <span>Hardening Best Practices</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#9CA3AF]">
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-[#22C55E] shrink-0 mt-0.5" />
              <span>Use a dedicated password manager with unique passphrases per site.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-[#22C55E] shrink-0 mt-0.5" />
              <span>Enable FIDO2 / WebAuthn passkeys or TOTP 2FA on critical accounts.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#292D32] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#9CA3AF]">
        <span className="text-[10px] font-mono">
          Strict policy: Plaintext passwords never leave your browser.
        </span>
        <Link
          to="/password-security"
          className="text-xs font-bold text-[#078BFF] hover:text-[#00CFFF] flex items-center gap-1 transition-colors"
        >
          <span>Check Password with K-Anonymity</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};
