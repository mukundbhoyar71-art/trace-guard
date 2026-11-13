import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { TraceGuardLogo } from '../components/common/TraceGuardLogo';
import { useAuth } from '../contexts/AuthContext';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');

    try {
      const result = await forgotPassword(email);
      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'Unable to process recovery request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white flex flex-col justify-center items-center px-4 py-12 cyber-grid-pattern">
      <Link to="/" className="mb-6 group">
        <TraceGuardLogo variant="full" size="md" showTagline={true} />
      </Link>

      <div className="w-full max-w-md cyber-card p-8 rounded-2xl border border-[#292D32] shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-white tracking-tight">Reset Your Password</h2>
          <p className="text-xs text-[#9CA3AF] mt-1">
            We will dispatch a secure single-use recovery token to your email.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-xs text-[#9CA3AF] leading-relaxed">
              If an account with <span className="font-mono text-white font-semibold">{email}</span> exists, recovery instructions have been dispatched.
            </div>
            <div className="p-3 rounded-xl bg-[#101214] border border-[#292D32] text-left text-xs">
              <span className="font-mono text-[10px] text-[#00CFFF] uppercase tracking-wider block mb-1">
                Development Notice
              </span>
              <p className="text-[11px] text-[#9CA3AF]">
                The password recovery link has been printed in your backend server terminal.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold transition-all shadow-lg shadow-[#078BFF]/25"
            >
              <span>Return to Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#9CA3AF] mb-1.5">
                Account Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-9 pr-3 py-2.5 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/25 border border-[#078BFF]/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Dispatching Token...' : 'Generate Recovery Link'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-[#292D32] text-center text-xs text-[#9CA3AF]">
          Remembered your password?{' '}
          <Link to="/login" className="font-bold text-[#078BFF] hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
