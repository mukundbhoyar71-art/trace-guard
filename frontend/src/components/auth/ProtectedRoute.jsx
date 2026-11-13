import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { TraceGuardLogo } from '../common/TraceGuardLogo';
import { ShieldAlert } from 'lucide-react';

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0D0F] flex flex-col items-center justify-center p-4 cyber-grid-pattern">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[#078BFF]/10 border border-[#078BFF]/40 flex items-center justify-center shadow-[0_0_30px_rgba(7,139,255,0.3)] animate-pulse mb-6">
            <TraceGuardLogo variant="icon" size="md" />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-[#00CFFF] uppercase">
            <span className="w-2 h-2 rounded-full bg-[#00CFFF] animate-ping" />
            <span>Authenticating Security Context...</span>
          </div>
          <div className="w-48 h-1 bg-[#151719] rounded-full overflow-hidden mt-4 border border-[#292D32]">
            <div className="h-full bg-gradient-to-r from-[#078BFF] to-[#00CFFF] animate-pulse w-2/3 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user.is_email_verified) {
    return (
      <Navigate
        to={`/verify-email?email=${encodeURIComponent(user.email || '')}`}
        replace
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;

