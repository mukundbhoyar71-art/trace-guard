import React, { useState } from 'react';
import { Bell, AlertCircle, ShieldAlert, CheckCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const initialAlerts = [
  {
    id: 1,
    severity: 'critical',
    title: 'Excessive App Permissions Detected',
    message: 'Utility Calculator app requests SEND_SMS and READ_EXTERNAL_STORAGE.',
    time: '45m ago',
  },
  {
    id: 2,
    severity: 'warning',
    title: 'Public Email Exposure in Repository',
    message: 'Your personal email is indexed by search crawlers on GitHub profile page.',
    time: '3h ago',
  },
  {
    id: 3,
    severity: 'info',
    title: 'New Breach Intelligence Dataset Loaded',
    message: 'Global breach catalog updated with 4.2M newly validated credentials.',
    time: '1d ago',
  },
];

export const LatestAlertsCard = () => {
  const [alerts, setAlerts] = useState(initialAlerts);
  const navigate = useNavigate();

  const dismissAlert = (id) => {
    setAlerts(alerts.filter((a) => a.id !== id));
  };

  const severityConfig = {
    critical: {
      badge: 'bg-red-500/15 text-red-400 border-red-500/30',
      icon: ShieldAlert,
      iconColor: 'text-red-400',
    },
    warning: {
      badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      icon: AlertCircle,
      iconColor: 'text-amber-400',
    },
    info: {
      badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      icon: Bell,
      iconColor: 'text-indigo-400',
    },
  };

  return (
    <div className="cyber-card p-5 rounded-2xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Latest Security Alerts
            </h3>
          </div>
          <button
            onClick={() => navigate('/security-alerts')}
            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300"
          >
            Alert Center
          </button>
        </div>

        <div className="space-y-2.5">
          {alerts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              All alerts resolved. System healthy.
            </div>
          ) : (
            alerts.map((alert) => {
              const conf = severityConfig[alert.severity] || severityConfig.info;
              const Icon = conf.icon;
              return (
                <div
                  key={alert.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-3 relative group"
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${conf.iconColor}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{alert.title}</span>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full border ${conf.badge}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug mt-1">
                        {alert.message}
                      </p>
                      <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                        {alert.time}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => dismissAlert(alert.id)}
                    title="Dismiss alert"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>Active Unresolved Alerts:</span>
        <span className="text-red-400 font-bold">{alerts.length} Incident(s)</span>
      </div>
    </div>
  );
};

