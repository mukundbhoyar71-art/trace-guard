import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Mic, MapPin, Bell, ShieldCheck, AlertTriangle, ArrowRight, RefreshCw, Laptop } from 'lucide-react';
import { browserPermissionService, PERMISSION_STATUS } from '../../services/browserPermissionService';

export const PermissionCard = () => {
  const [permissions, setPermissions] = useState({});
  const [browserInfo, setBrowserInfo] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const bInfo = browserPermissionService.getBrowserDetails();
        setBrowserInfo(bInfo);
        const data = await browserPermissionService.queryAllPermissions();
        setPermissions(data);
      } catch (err) {
        console.error('Failed to load browser permissions for dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case PERMISSION_STATUS.GRANTED:
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
            GRANTED
          </span>
        );
      case PERMISSION_STATUS.DENIED:
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            DENIED
          </span>
        );
      case PERMISSION_STATUS.PROMPT:
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            PROMPT
          </span>
        );
      case PERMISSION_STATUS.UNSUPPORTED:
      default:
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-500/30">
            UNSUPPORTED
          </span>
        );
    }
  };

  const permItems = [
    { key: 'camera', name: 'Camera Access', icon: Camera },
    { key: 'microphone', name: 'Microphone Hardware', icon: Mic },
    { key: 'location', name: 'Precise Geolocation', icon: MapPin },
    { key: 'notifications', name: 'System Notifications', icon: Bell },
  ];

  const grantedCount = Object.values(permissions).filter((p) => p.status === PERMISSION_STATUS.GRANTED).length;

  return (
    <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#078BFF]"></span>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Browser Security Scopes
            </h2>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Real API
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Auditing browser permissions...</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="p-3 rounded-xl bg-[#151719] border border-[#292D32]">
                <span className="text-[10px] uppercase text-slate-500 block">Granted Scopes</span>
                <span className={`text-lg font-bold ${grantedCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {grantedCount} Active
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#151719] border border-[#292D32]">
                <span className="text-[10px] uppercase text-slate-500 block">Environment</span>
                <span className="text-xs font-bold text-white truncate block">
                  {browserInfo.browser || 'Browser'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {permItems.map((item) => {
                const Icon = item.icon;
                const status = permissions[item.key]?.status || PERMISSION_STATUS.UNSUPPORTED;

                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#151719] border border-[#292D32]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#101214] border border-[#292D32] flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <span className="text-xs font-semibold text-white">{item.name}</span>
                    </div>

                    <div>{getStatusBadge(status)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#292D32] flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">Real Browser Scopes</span>
        <Link
          to="/app-permissions"
          className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
        >
          <span>Open Full Auditor</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default PermissionCard;
