import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, AlertTriangle, Info, ShieldCheck, X, ArrowRight } from 'lucide-react';
import { securityService } from '../../services/securityService';
import { analyticsService } from '../../services/analyticsService';

export const SecurityAlertCard = ({ onToast, monitoringOverview }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);

  useEffect(() => {
    let active = true;
    const loadRealIncidents = async () => {
      try {
        const [exposureRes, recsRes] = await Promise.all([
          analyticsService.getExposureAnalytics().catch(() => null),
          securityService.getRecommendations().catch(() => null),
        ]);

        if (!active) return;
        const derived = [];

        // 1. Unresolved verified breaches
        const breaches = exposureRes?.recent_breaches || [];
        breaches
          .filter((b) => !b.is_resolved)
          .slice(0, 3)
          .forEach((b) => {
            derived.push({
              id: `breach-${b.id}`,
              severity: (b.severity || 'high').toLowerCase(),
              title: `Verified Breach: ${b.title}`,
              details: `Exposed data classes: ${(b.data_classes || []).join(', ') || 'Recorded in HIBP database'}.`,
              timestamp: b.breach_date || 'Verified Incident',
              source: 'Live HIBP Breach Finding',
              route: '/scan-history',
            });
          });

        // 2. Failed automated monitoring executions
        const failedExecs = (monitoringOverview?.recent_executions || []).filter(
          (e) => e.status === 'failed'
        );
        if (failedExecs.length > 0) {
          const latestFail = failedExecs[0];
          derived.push({
            id: `exec-fail-${latestFail.id}`,
            severity: 'high',
            title: 'Automated Monitoring Execution Failed',
            details:
              latestFail.error_message ||
              'Scheduled monitoring check failed to execute.',
            timestamp: new Date(latestFail.started_at).toLocaleString(),
            source: 'Automated Monitoring Scheduler',
            route: '/breach-monitoring',
          });
        }

        // 3. Pending critical/high recommendations (excluding demo)
        const pendingRecs = (recsRes?.items || []).filter(
          (r) => !r.is_demo && r.status === 'pending' && ['critical', 'high'].includes((r.priority || '').toLowerCase())
        );
        pendingRecs.slice(0, Math.max(0, 4 - derived.length)).forEach((r) => {
          derived.push({
            id: `rec-${r.id}`,
            severity: (r.priority || 'high').toLowerCase(),
            title: r.title,
            details: r.reason || r.description,
            timestamp: new Date(r.created_at).toLocaleDateString(),
            source: 'Security Recommendation Engine',
            route: '/recommendations',
          });
        });

        setAlerts(derived);
      } catch {
        if (active) setAlerts([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadRealIncidents();
    return () => {
      active = false;
    };
  }, [monitoringOverview]);

  const dismissAlert = (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    if (onToast) onToast('Alert dismissed from view');
  };

  const getSeverity = (sev) => {
    switch (sev) {
      case 'critical':
        return {
          icon: ShieldAlert,
          color: 'text-[#EF4444]',
          badge: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
        };
      case 'high':
        return {
          icon: AlertTriangle,
          color: 'text-[#F59E0B]',
          badge: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
        };
      default:
        return {
          icon: Info,
          color: 'text-[#078BFF]',
          badge: 'bg-[#078BFF]/15 text-[#00CFFF] border-[#078BFF]/30',
        };
    }
  };

  return (
    <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                alerts.length > 0 ? 'bg-[#EF4444]' : 'bg-[#22C55E]'
              }`}
            ></span>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Active Security Alerts
            </h2>
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#101214] text-[#9CA3AF] border border-[#292D32]">
            LIVE TELEMETRY
          </span>
        </div>

        <div className="space-y-2.5">
          {loading ? (
            <div className="p-6 text-center text-xs text-[#9CA3AF]">
              Loading authenticated security alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#101214] border border-[#292D32] text-center space-y-2">
              <ShieldCheck className="w-7 h-7 text-[#22C55E] mx-auto" />
              <div className="text-xs font-bold text-white">No Active Incidents</div>
              <p className="text-[11px] text-[#9CA3AF]">
                Zero unresolved verified breaches, monitoring failures, or high-priority pending actions exist in your database records.
              </p>
            </div>
          ) : (
            alerts.map((alert) => {
              const conf = getSeverity(alert.severity);
              const Icon = conf.icon;
              return (
                <div
                  key={alert.id}
                  className="p-3.5 rounded-xl bg-[#101214] border border-[#292D32] hover:border-[#292D32]/80 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${conf.color}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white truncate max-w-[200px]">
                          {alert.title}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full border ${conf.badge}`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-snug line-clamp-2">
                        {alert.details}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-mono text-[#9CA3AF]/60">
                          {alert.timestamp}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedAlert(alert)}
                          className="text-[10px] font-semibold text-[#078BFF] hover:underline"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => dismissAlert(alert.id)}
                    className="p-1 text-[#9CA3AF] hover:text-white rounded"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#292D32] flex items-center justify-between text-xs text-[#9CA3AF]">
        <span className="text-[10px] font-mono">Authenticated DB incident feed</span>
        <span
          className={`font-semibold text-[11px] ${
            alerts.length > 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'
          }`}
        >
          {alerts.length} Active Alert{alerts.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Details Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151719] border border-[#292D32] p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase text-[#078BFF] font-bold">
                Security Incident Dossier
              </span>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="p-1 text-[#9CA3AF] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-base font-bold text-white mb-2">{selectedAlert.title}</h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed mb-4">
              {selectedAlert.details}
            </p>
            <div className="p-3 rounded-xl bg-[#101214] border border-[#292D32] text-xs text-[#9CA3AF] mb-4 space-y-1">
              <div>
                Severity Level: <span className="text-white font-bold uppercase">{selectedAlert.severity}</span>
              </div>
              <div>
                Recorded: <span className="font-mono text-white">{selectedAlert.timestamp}</span>
              </div>
              <div>
                Source: <span className="font-mono text-[#00CFFF]">{selectedAlert.source}</span>
              </div>
            </div>
            <Link
              to={selectedAlert.route || '/recommendations'}
              onClick={() => setSelectedAlert(null)}
              className="w-full py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold transition-all shadow-lg shadow-[#078BFF]/30 flex items-center justify-center gap-1.5"
            >
              <span>Open Remediation Module</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
