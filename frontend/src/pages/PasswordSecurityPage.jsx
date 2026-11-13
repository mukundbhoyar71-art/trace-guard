import React, { useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ExternalLink,
  Shield,
  Trash2,
  Check,
} from 'lucide-react';
import { passwordService } from '../services/passwordService';
import { securityService } from '../services/securityService';

export const PasswordSecurityPage = () => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [entropy, setEntropy] = useState({ bits: 0, label: 'Empty', color: '#9CA3AF', length: 0 });

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    setEntropy(passwordService.calculateEntropy(val));
    setError('');
  };

  const handleCheckPassword = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter a password to evaluate.');
      return;
    }

    setChecking(true);
    setError('');
    setResult(null);

    try {
      // Execute local k-anonymity SHA-1 prefix check
      const checkResult = await passwordService.checkPasswordBreach(password);

      // Persist zero-knowledge audit outcome (breached status, count, entropy only — zero password/prefix)
      const entropySnapshot = { ...entropy };
      await securityService
        .recordPasswordCheckAudit({
          breached: Boolean(checkResult?.breached),
          count: Number(checkResult?.count || 0),
          entropy_bits: Number(entropySnapshot.bits || 0),
          entropy_label: String(entropySnapshot.label || 'Unknown'),
        })
        .catch(() => null);

      // Save result
      setResult({
        ...checkResult,
        entropySnapshot,
      });

      // SECURITY RULE: Clear the plain password immediately from input state upon completion
      setPassword('');
      setEntropy({ bits: 0, label: 'Empty', color: '#9CA3AF', length: 0 });
    } catch (err) {
      setError(err.message || 'Failed to verify password against Pwned Passwords API.');
    } finally {
      setChecking(false);
    }
  };

  const handleClear = () => {
    setPassword('');
    setEntropy({ bits: 0, label: 'Empty', color: '#9CA3AF', length: 0 });
    setResult(null);
    setError('');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#292D32]/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-[#078BFF]" />
              <span>Password Security & Exposure Verification</span>
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#078BFF]/20 text-[#00CFFF] border border-[#078BFF]/30">
              K-Anonymity Verified
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Audit whether a password appears in Have I Been Pwned's 850M+ compromised password dataset with zero plaintext transmission.
          </p>
        </div>

        {/* Live Provider Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#151719] border border-[#292D32] text-xs">
          <div className="w-2 h-2 rounded-full bg-[#22C55E] shadow-sm shadow-[#22C55E]" />
          <span className="text-[#9CA3AF]">Endpoint:</span>
          <span className="text-white font-semibold font-mono">api.pwnedpasswords.com</span>
          <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/15 px-1.5 py-0.2 rounded border border-[#22C55E]/30">
            Free Service
          </span>
        </div>
      </div>

      {/* 2. ZERO-KNOWLEDGE PRIVACY NOTICE */}
      <section className="p-4 rounded-2xl bg-[#078BFF]/10 border border-[#078BFF]/30 text-xs text-[#00CFFF] flex items-start gap-3 shadow-lg shadow-[#078BFF]/5">
        <Shield className="w-5 h-5 shrink-0 text-[#00CFFF] mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-white text-sm">
            Zero-Knowledge Cryptographic Privacy Guarantee
          </div>
          <p className="text-white/80 leading-relaxed text-[11px]">
            Your plaintext password <strong>NEVER leaves this browser</strong>. The SHA-1 hash is computed locally via the browser's native Web Crypto API. Only the first 5 characters of the hash prefix are transmitted to the public range API. The matching candidate suffixes are checked entirely in local memory, and your input is immediately wiped once evaluated.
          </p>
        </div>
      </section>

      {/* 3. PASSWORD EVALUATION CARD */}
      <section className="cyber-card p-6 rounded-2xl border border-[#292D32] bg-[#151719] shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#00CFFF] flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Client-Side Password Verification</span>
          </span>
          <span className="text-[10px] text-[#9CA3AF] font-mono">
            Auto-Wipe Active (Zero Retention)
          </span>
        </div>

        <form onSubmit={handleCheckPassword} className="space-y-4">
          <div className="relative">
            <KeyRound className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={handlePasswordChange}
              placeholder="Enter a password to test exposure (will be cleared immediately after check)..."
              className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-10 pr-20 py-3.5 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] font-mono transition-all"
              autoComplete="off"
              spellCheck="false"
              disabled={checking}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white transition-colors"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Entropy & Strength Meter (while typing) */}
          {password && (
            <div className="p-3 rounded-xl bg-[#101214] border border-[#292D32] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#9CA3AF]">
                  Estimated Entropy: <strong style={{ color: entropy.color }}>{entropy.bits} Bits ({entropy.label})</strong>
                </span>
                <span className="text-[#9CA3AF] font-mono">{entropy.length} characters</span>
              </div>
              <div className="w-full bg-[#151719] h-1.5 rounded-full overflow-hidden border border-[#292D32]">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (entropy.bits / 100) * 100)}%`,
                    backgroundColor: entropy.color,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={checking || !password}
              className="px-6 py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/25 border border-[#078BFF]/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking K-Anonymity Range...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Check Password with K-Anonymity</span>
                </>
              )}
            </button>

            {password && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3.5 py-2.5 rounded-xl bg-[#1B1E22] hover:bg-[#252930] text-xs text-[#9CA3AF] hover:text-white border border-[#292D32] transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* 4. VERIFICATION RESULT */}
      {result && (
        <section
          className={`p-6 rounded-2xl border shadow-2xl space-y-4 animate-in fade-in transition-all ${
            result.breached
              ? 'bg-[#EF4444]/10 border-[#EF4444]/40 shadow-[#EF4444]/10'
              : 'bg-[#22C55E]/10 border-[#22C55E]/40 shadow-[#22C55E]/10'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                  result.breached
                    ? 'bg-[#EF4444]/20 border-[#EF4444]/50 text-[#EF4444]'
                    : 'bg-[#22C55E]/20 border-[#22C55E]/50 text-[#22C55E]'
                }`}
              >
                {result.breached ? (
                  <ShieldAlert className="w-7 h-7" />
                ) : (
                  <ShieldCheck className="w-7 h-7" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  {result.breached
                    ? `Compromised: Found in ${result.count.toLocaleString()} Data Breaches`
                    : 'Zero Known Breaches Found'}
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Checked against {result.suffixMatchesChecked} candidate hash suffixes via prefix{' '}
                  <span className="font-mono text-white px-1.5 py-0.2 rounded bg-[#101214] border border-[#292D32]">
                    {result.prefix}
                  </span>
                </p>
              </div>
            </div>

            <span
              className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
                result.breached
                  ? 'bg-[#EF4444]/20 border-[#EF4444]/40 text-[#EF4444]'
                  : 'bg-[#22C55E]/20 border-[#22C55E]/40 text-[#22C55E]'
              }`}
            >
              {result.breached ? 'Compromised' : 'Safe From Known Dumps'}
            </span>
          </div>

          {/* Detailed Message & Disclaimer */}
          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] text-xs text-[#9CA3AF] leading-relaxed space-y-2">
            {result.breached ? (
              <>
                <p className="text-[#EF4444] font-semibold">
                  Warning: This password has been exposed in public breach compilations and is known to threat actors.
                </p>
                <p>
                  Cybercriminals use automated credential stuffing tools and rainbow tables to try this password against millions of web accounts. If you use this password anywhere, <strong>change it immediately</strong> and enable two-factor authentication.
                </p>
              </>
            ) : (
              <>
                <p className="text-[#22C55E] font-semibold">
                  This password was not observed in Have I Been Pwned's 850M+ compromised password corpus.
                </p>
                <p>
                  <strong className="text-white">Security Notice:</strong> A zero breach count indicates absence from public incident datasets. It does not guarantee that a password is safe against targeted dictionary attacks or offline brute-forcing if it is short, sequential, or easy to guess.
                </p>
              </>
            )}
          </div>
        </section>
      )}

      {/* 5. K-ANONYMITY EXPLAINER DIAGRAM */}
      <section className="cyber-card p-6 rounded-2xl border border-[#292D32] bg-[#151719] space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#00CFFF]" />
          <h2 className="text-sm font-black text-white">How K-Anonymity Protects Your Password</h2>
        </div>
        <p className="text-xs text-[#9CA3AF] leading-relaxed">
          The k-anonymity model ensures that the external service cannot determine what password you are checking, because your request looks identical to thousands of other potential passwords sharing the same 5-character hash prefix.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#078BFF] tracking-wider">
              Step 1: Local SHA-1
            </span>
            <div className="text-white font-bold text-[11px]">In-Memory Hashing</div>
            <p className="text-[10px] text-[#9CA3AF]">
              Web Crypto computes the 40-character hexadecimal SHA-1 digest entirely on your device.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#078BFF] tracking-wider">
              Step 2: 5-Char Prefix
            </span>
            <div className="text-white font-bold text-[11px]">Prefix Isolation</div>
            <p className="text-[10px] text-[#9CA3AF]">
              Only the first 5 characters (e.g. <span className="font-mono text-white">21BD1</span>) are sent to the HIBP range API.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#078BFF] tracking-wider">
              Step 3: Range Response
            </span>
            <div className="text-white font-bold text-[11px]">Candidate Suffixes</div>
            <p className="text-[10px] text-[#9CA3AF]">
              The API returns ~500 anonymous hash suffixes matching that 5-char prefix.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#22C55E] tracking-wider">
              Step 4: Local Match
            </span>
            <div className="text-white font-bold text-[11px]">Browser Comparison</div>
            <p className="text-[10px] text-[#9CA3AF]">
              Your browser compares your remaining 35-char suffix in memory and wipes the password instantly.
            </p>
          </div>
        </div>
      </section>

      {/* 6. STRATEGIC PASSWORD RECOMMENDATIONS */}
      <section className="cyber-card p-6 rounded-2xl border border-[#292D32] bg-[#151719] space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#22C55E]" />
          <h2 className="text-sm font-black text-white">Password Security Best Practices</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Adopt a Password Manager</span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
              Use Bitwarden, 1Password, or KeePass to generate and store 16+ character pseudorandom passwords for each domain.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Never Reuse Credentials</span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
              If an attacker breaches one low-security forum, credential-stuffing bots immediately test that email/password across Google, banking, and social accounts.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Enable Two-Factor Authentication (2FA)</span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
              Prefer TOTP authenticator apps or hardware FIDO2 security keys over SMS verification to mitigate SIM-swapping attacks.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Adopt Passkeys Where Supported</span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
              Passkeys utilize public-key cryptography bound to your biometric device, rendering phishing and credential theft mathematically impossible.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
