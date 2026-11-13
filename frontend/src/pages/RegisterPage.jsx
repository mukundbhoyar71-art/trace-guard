import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User, Eye, EyeOff, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TraceGuardLogo } from '../components/common/TraceGuardLogo';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password strength criteria
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

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!isPasswordStrong) {
      setError(
        'Password must be at least 8 characters long and contain uppercase, lowercase, a number, and a special character.'
      );
      return;
    }

    if (!acceptTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);

    try {
      const result = await register({
        fullName,
        email,
        password,
        confirmPassword,
        termsAccepted: acceptTerms,
      });

      if (result.success) {
        // Redirect to verify-email page with email pre-filled and delivery status
        navigate(`/verify-email?email=${encodeURIComponent(email)}&new=1`, {
          state: {
            emailDelivered: result.emailDelivered,
            deliveryNotice: result.deliveryNotice,
          },
        });
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    window.location.href = `${backendUrl}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white flex flex-col justify-center items-center px-4 py-12 cyber-grid-pattern">
      <Link to="/" className="mb-6 group">
        <TraceGuardLogo variant="full" size="md" showTagline={true} />
      </Link>

      <div className="w-full max-w-md cyber-card p-8 rounded-2xl border border-[#292D32] shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-white tracking-tight">Create Your Secure Account</h2>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Audit your digital exposure with cryptographic privacy protection.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full py-2.5 px-4 rounded-xl bg-[#101214] hover:bg-[#1B1E22] border border-[#292D32] text-[#9CA3AF] hover:text-white text-xs font-semibold flex items-center justify-center gap-3 transition-colors mb-4"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-[#292D32]"></div>
          <span className="text-[10px] uppercase font-mono font-bold text-[#9CA3AF]/70 tracking-wider">
            Or register with email
          </span>
          <div className="h-px flex-1 bg-[#292D32]"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Vance"
                className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-9 pr-3 py-2 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-9 pr-3 py-2 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-9 pr-10 py-2 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-[#9CA3AF] hover:text-white absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength checklist */}
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
            <label className="block text-xs font-semibold text-[#9CA3AF] mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-9 pr-3 py-2 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] transition-all"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1 rounded bg-[#101214] border-[#292D32] text-[#078BFF] focus:ring-[#078BFF]"
            />
            <label htmlFor="terms" className="text-[11px] text-[#9CA3AF] leading-snug cursor-pointer">
              I accept the <span className="text-[#078BFF]">Terms of Service</span> and{' '}
              <span className="text-[#078BFF]">Privacy Policy</span>.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/25 border border-[#078BFF]/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{loading ? 'Creating Vault...' : 'Complete Registration'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-[#292D32] text-center text-xs text-[#9CA3AF]">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-[#078BFF] hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
