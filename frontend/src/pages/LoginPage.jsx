import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TraceGuardLogo } from '../components/common/TraceGuardLogo';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, enterDemoMode } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  // Check if an error was passed from Google OAuth redirect or location state
  useEffect(() => {
    const queryError = searchParams.get('error');
    if (queryError) {
      setError(queryError);
    } else if (location.state?.message) {
      // e.g. "Password reset successfully. Please sign in."
      setError('');
    }
  }, [searchParams, location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUnverifiedEmail('');

    try {
      const result = await login(email, password, rememberMe);
      if (result.success) {
        const destination = location.state?.from?.pathname || '/dashboard';
        navigate(destination, { replace: true });
      } else {
        setError(result.error);
        if (result.isUnverified) {
          setUnverifiedEmail(email);
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    window.location.href = `${backendUrl}/auth/google`;
  };

  const handleDemoAccess = () => {
    enterDemoMode();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white flex flex-col justify-center items-center px-4 py-12 cyber-grid-pattern">
      {/* Brand Header */}
      <Link to="/" className="mb-8 group">
        <TraceGuardLogo variant="full" size="md" showTagline={true} />
      </Link>

      {/* Form Card */}
      <div className="w-full max-w-md cyber-card p-8 rounded-2xl border border-[#292D32] shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-white tracking-tight">Access Your Security Vault</h2>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Sign in to inspect your digital footprint and threat telemetry.
          </p>
        </div>

        {location.state?.message && !error && (
          <div className="mb-4 p-3 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-xs">
            {location.state.message}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            {unverifiedEmail && (
              <div className="pt-1 mt-1 border-t border-[#EF4444]/20 flex justify-between items-center text-[11px]">
                <span>Email not verified yet?</span>
                <Link
                  to={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                  className="font-bold underline hover:text-white"
                >
                  Verify Now
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full py-2.5 px-4 rounded-xl bg-[#101214] hover:bg-[#1B1E22] border border-[#292D32] text-[#9CA3AF] hover:text-white text-xs font-semibold flex items-center justify-center gap-3 transition-colors mb-5"
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

        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-[#292D32]"></div>
          <span className="text-[10px] uppercase font-mono font-bold text-[#9CA3AF]/70 tracking-wider">
            Or sign in with email
          </span>
          <div className="h-px flex-1 bg-[#292D32]"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#9CA3AF] mb-1.5">
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
                className="w-full bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-9 pr-3 py-2.5 rounded-xl border border-[#292D32] focus:outline-none focus:border-[#078BFF] transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#9CA3AF]">Password</label>
              <Link
                to="/forgot-password"
                className="text-[11px] text-[#078BFF] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
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
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-[#9CA3AF] hover:text-white">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded bg-[#101214] border-[#292D32] text-[#078BFF] focus:ring-[#078BFF]"
              />
              <span>Remember this device (30 days)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/25 border border-[#078BFF]/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Demo Mode Button for Instant Evaluation */}
        <div className="mt-4 pt-3 border-t border-[#292D32]/60">
          <button
            type="button"
            onClick={handleDemoAccess}
            className="w-full py-2 px-3 rounded-xl bg-[#1B1E22]/60 hover:bg-[#1B1E22] border border-[#292D32] hover:border-[#00CFFF]/40 text-[#00CFFF] text-xs font-semibold flex items-center justify-center gap-2 transition-all group"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00CFFF] group-hover:scale-110 transition-transform" />
            <span>Explore Dashboard in Demo Mode</span>
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-[#292D32] text-center text-xs text-[#9CA3AF]">
          Don't have an account?{' '}
          <Link to="/register" className="font-bold text-[#078BFF] hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};
