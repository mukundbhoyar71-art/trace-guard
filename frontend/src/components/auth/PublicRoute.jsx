import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { TraceGuardLogo } from '../common/TraceGuardLogo';

export const PublicRoute = () => {
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
            <span>Verifying Session State...</span>
          </div>
        </div>
      </div>
    );
  }

  if (user && user.is_email_verified) {
    const destination = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
};

export default PublicRoute;

