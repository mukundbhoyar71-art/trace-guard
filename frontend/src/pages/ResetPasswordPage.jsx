import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, ShieldAlert, KeyRound } from 'lucide-react';
import { TraceGuardLogo } from '../components/common/TraceGuardLogo';
import { useAuth } from '../contexts/AuthContext';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Password validation checks
  const passwordHasMinLen = password.length >= 8;
  const passwordHasUpper = /[A-Z]/.test(password);
  const passwordHasLower = /[a-z]/.test(password);
  const passwordHasDigit = /[0-9]/.test(password);
  const passwordHasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordStrong =
    passwordHasMinLen &&
    passwordHasUpper &&
    passwordHasLower &&
    passwordHasDigit &&
    passwordHasSpecial;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('A recovery token is required to reset your password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!isPasswordStrong) {
      setError(
        'Password must be at least 8 characters and contain uppercase, lowercase, numbers, and special characters.'
      );
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword({
        token,
        newPassword: password,
        confirmPassword,
      });

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'Password reset failed. Token may be expired or already used.');
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
          <h2 className="text-xl font-black text-white tracking-tight">Set New Secure Password</h2>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Choose a unique password hashed with Argon2id for maximum credential resistance.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-xs text-[#9CA3AF] leading-relaxed">
              Your password has been securely updated. All existing sessions have been terminated.
            </div>
            <Link
              to="/login"
              state={{ message: 'Password reset successful. Please sign in with your new credentials.' }}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold transition-all shadow-lg shadow-[#078BFF]/25"
            >
              <span>Sign In with New Password</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!tokenFromUrl && (
              <div>
                <label className="block text-xs font-semibold text-[#9CA3AF] mb-1.5">
                  Recovery Token
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste recovery token"
                    className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-9 pr-3 py-2.5 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] font-mono transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#9CA3AF] mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-9 pr-10 py-2.5 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-[#9CA3AF] hover:text-white absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password checklist */}
              {password.length > 0 && (
                <div className="grid grid-cols-2 gap-1 mt-2 p-2 rounded-lg bg-[#101214] border border-[#292D32] text-[10px]">
                  <div className={`flex items-center gap-1.5 ${passwordHasMinLen ? 'text-[#22C55E]' : 'text-[#9CA3AF]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${passwordHasMinLen ? 'bg-[#22C55E]' : 'bg-[#9CA3AF]'}`} />
                    <span>8+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordHasUpper ? 'text-[#22C55E]' : 'text-[#9CA3AF]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${passwordHasUpper ? 'bg-[#22C55E]' : 'bg-[#9CA3AF]'}`} />
                    <span>Uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordHasLower ? 'text-[#22C55E]' : 'text-[#9CA3AF]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${passwordHasLower ? 'bg-[#22C55E]' : 'bg-[#9CA3AF]'}`} />
                    <span>Lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordHasDigit && passwordHasSpecial ? 'text-[#22C55E]' : 'text-[#9CA3AF]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${passwordHasDigit && passwordHasSpecial ? 'bg-[#22C55E]' : 'bg-[#9CA3AF]'}`} />
                    <span>Number & symbol</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9CA3AF] mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-9 pr-3 py-2.5 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/25 border border-[#078BFF]/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Securing Vault...' : 'Update Password'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-[#292D32] text-center text-xs text-[#9CA3AF]">
          Cancel and return to{' '}
          <Link to="/login" className="font-bold text-[#078BFF] hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
