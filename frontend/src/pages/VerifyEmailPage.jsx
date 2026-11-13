import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { Mail, CheckCircle2, RefreshCw, ArrowRight, ShieldAlert, KeyRound, AlertTriangle } from 'lucide-react';
import { TraceGuardLogo } from '../components/common/TraceGuardLogo';
import { useAuth } from '../contexts/AuthContext';

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const tokenParam = searchParams.get('token');
  const emailParam = searchParams.get('email') || '';
  const isNew = searchParams.get('new') === '1';

  const navigate = useNavigate();
  const { verifyEmail, resendVerification } = useAuth();

  const [tokenInput, setTokenInput] = useState(tokenParam || '');
  const [emailInput, setEmailInput] = useState(emailParam);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [deliveryNotice, setDeliveryNotice] = useState(location.state?.deliveryNotice || '');

  // If token is in URL query, verify when user clicks or auto-verify
  useEffect(() => {
    if (tokenParam) {
      setTokenInput(tokenParam);
      handleVerify(tokenParam);
    }
  }, [tokenParam]);

  const handleVerify = async (tok) => {
    const targetToken = tok || tokenInput;
    if (!targetToken) {
      setError('Please provide a valid verification token.');
      return;
    }

    setVerifying(true);
    setError('');
    setResendMessage('');

    try {
      const result = await verifyEmail(targetToken);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'Verification token invalid or expired.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!emailInput) {
      setError('Please enter your email address to receive a new verification token.');
      return;
    }

    setResending(true);
    setError('');
    setResendMessage('');

    try {
      const result = await resendVerification(emailInput);
      if (result.success) {
        if (result.deliveryNotice) {
          setDeliveryNotice(result.deliveryNotice);
        }
        setResendMessage(
          result.emailDelivered === false
            ? 'A new verification link was created, but email dispatch had a delivery restriction (see notice below).'
            : (result.message || 'A fresh verification token has been generated and dispatched.')
        );
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'Failed to resend verification link.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white flex flex-col justify-center items-center px-4 py-12 cyber-grid-pattern">
      <Link to="/" className="mb-6 group">
        <TraceGuardLogo variant="full" size="md" showTagline={true} />
      </Link>

      <div className="w-full max-w-md cyber-card p-8 rounded-2xl border border-[#292D32] shadow-2xl text-center">
        {success ? (
          <div className="space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] flex items-center justify-center mx-auto shadow-lg shadow-[#22C55E]/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white tracking-tight mb-2">
                Identity Verified
              </h2>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Your email identity has been authenticated. You now have complete access to your personal cybersecurity vault.
              </p>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/25 border border-[#078BFF]/40 transition-all flex items-center justify-center gap-2"
            >
              <span>Enter Security Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-[#078BFF]/10 border border-[#078BFF]/30 text-[#078BFF] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#078BFF]/10">
              <Mail className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-black text-white tracking-tight mb-2">
              Verify Your Email Address
            </h2>
            <p className="text-xs text-[#9CA3AF] leading-relaxed mb-5">
              {isNew
                ? `We have dispatched a verification token for ${emailInput || 'your account'}. Please check your terminal console / email.`
                : 'Confirm your email address to unlock your attack surface monitoring.'}
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2 text-left">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {resendMessage && (
              <div className="mb-4 p-3 rounded-xl bg-[#078BFF]/15 border border-[#078BFF]/30 text-[#00CFFF] text-xs text-left">
                {resendMessage}
              </div>
            )}

            {deliveryNotice && (
              <div className="mb-4 p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-xs text-left">
                <div className="font-semibold mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Delivery Status</span>
                </div>
                <div className="text-[11px] leading-relaxed text-[#F59E0B]/90">
                  {deliveryNotice}
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] text-left text-xs mb-5">
              <div className="text-[11px] font-mono font-bold text-[#00CFFF] uppercase tracking-wider mb-1">
                Development Environment Notice
              </div>
              <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                Verification tokens are logged directly to the backend terminal window with full clickable links.
              </p>
            </div>

            {/* Manual Token Verification Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerify();
              }}
              className="space-y-3 mb-5"
            >
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste verification token or link parameter"
                  className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-9 pr-3 py-2.5 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] font-mono transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={verifying || !tokenInput}
                className="w-full py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/25 border border-[#078BFF]/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{verifying ? 'Validating Token...' : 'Confirm Verification'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Resend Section */}
            <div className="pt-4 border-t border-[#292D32] space-y-3">
              <div className="text-[11px] text-[#9CA3AF]">
                Didn't receive the email or link expired?
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@domain.com"
                  className="flex-1 bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 px-3 py-2 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF]"
                />
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="px-3 py-2 rounded-xl bg-[#1B1E22] hover:bg-[#252930] text-xs font-semibold text-white border border-[#292D32] flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin text-[#078BFF]' : ''}`} />
                  <span>{resending ? 'Sending' : 'Resend'}</span>
                </button>
              </div>
            </div>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-[#292D32] text-center text-xs text-[#9CA3AF]">
          Back to{' '}
          <Link to="/login" className="font-bold text-[#078BFF] hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
