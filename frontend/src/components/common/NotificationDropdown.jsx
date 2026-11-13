import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ShieldAlert, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { monitoringService } from '../../services/monitoringService';
import { securityService } from '../../services/securityService';

export const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [readIds, setReadIds] = useState(new Set());

  const loadRealAlerts = useCallback(async () => {
    try {
      const [monData, recData] = await Promise.all([
        monitoringService.getOverview().catch(() => null),
        securityService.getRecommendations().catch(() => null),
      ]);

      const items = [];

      if (monData) {
        if (monData.monitoring_status === 'Check Overdue') {
          items.push({
            id: 'mon-overdue',
            title: 'Scheduled Breach Audit Overdue',
            message: `Your scheduled audit reminder (${monData.reminder_frequency || 'periodic'}) is due. Review on HIBP or run a live scan.`,
            time: monData.next_reminder_date
              ? `Due ${new Date(monData.next_reminder_date).toLocaleDateString()}`
              : 'Action Recommended',
            type: 'warning',
            to: '/breach-monitoring',
          });
        } else if (monData.monitoring_enabled && monData.next_reminder_date) {
          items.push({
            id: 'mon-active',
            title: 'Manual Audit Reminder Scheduled',
            message: `Next ${monData.reminder_frequency} check reminder for ${monData.active_reminder?.target_email || 'your email'}.`,
            time: `Next: ${new Date(monData.next_reminder_date).toLocaleDateString()}`,
            type: 'info',
            to: '/breach-monitoring',
          });
        } else if (monData.monitoring_status === 'No Audits Yet') {
          items.push({
            id: 'mon-none',
            title: 'No Verified Breach Audits Recorded',
            message: 'Run a live exposure scan or log a manual HIBP check to activate security scoring.',
            time: 'Pending Baseline',
            type: 'info',
            to: '/data-exposure',
          });
        }
      }

      const pendingRecs = (recData?.items || []).filter(
        (r) => !r.is_demo && r.status === 'pending'
      );
      pendingRecs.slice(0, 3).forEach((rec) => {
        const prio = (rec.priority || '').toLowerCase();
        items.push({
          id: `rec-${rec.id}`,
          title: rec.title,
          message: rec.suggested_action || rec.description,
          time: `${(rec.priority || 'medium').toUpperCase()} priority`,
          type: prio === 'critical' ? 'critical' : prio === 'high' ? 'warning' : 'info',
          to: '/recommendations',
        });
      });

      setNotifications(items);
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    loadRealAlerts();
  }, [loadRealAlerts]);

  const visibleNotifications = notifications.filter((n) => !dismissedIds.has(n.id));
  const unreadCount = visibleNotifications.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = () => {
    setReadIds(new Set(visibleNotifications.map((n) => n.id)));
  };

  const removeNotification = (id) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'critical':
        return <ShieldAlert className="w-3.5 h-3.5 text-[#EF4444]" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />;
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />;
      default:
        return <Info className="w-3.5 h-3.5 text-[#078BFF]" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) loadRealAlerts();
        }}
        title="Notifications"
        className="relative p-2 rounded-lg bg-[#151719] hover:bg-[#1B1E22] border border-[#292D32] hover:border-[#078BFF]/40 text-[#9CA3AF] hover:text-white transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444] ring-2 ring-[#101214]"></span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#151719] border border-[#292D32] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in duration-150">
            <div className="px-4 py-3 border-b border-[#292D32] flex items-center justify-between bg-[#101214]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Security Alerts
                </span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                    {unreadCount} Active
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] font-medium text-[#078BFF] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-[#292D32]/60">
              {visibleNotifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#9CA3AF]">
                  No active security alerts or overdue monitoring reminders.
                </div>
              ) : (
                visibleNotifications.map((n) => {
                  const isUnread = !readIds.has(n.id);
                  return (
                    <div
                      key={n.id}
                      className={`p-3.5 hover:bg-[#1B1E22] transition-colors flex items-start gap-3 relative ${
                        isUnread ? 'bg-[#181B1E]/60' : ''
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                      <Link
                        to={n.to}
                        onClick={() => setIsOpen(false)}
                        className="flex-1 min-w-0 pr-4"
                      >
                        <div className="text-xs font-semibold text-white leading-tight hover:text-[#00CFFF]">
                          {n.title}
                        </div>
                        <div className="text-[11px] text-[#9CA3AF] mt-0.5 leading-snug line-clamp-2">
                          {n.message}
                        </div>
                        <div className="text-[10px] font-mono text-[#9CA3AF]/70 mt-1">
                          {n.time}
                        </div>
                      </Link>
                      <button
                        onClick={() => removeNotification(n.id)}
                        className="p-1 text-[#9CA3AF] hover:text-white rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-2.5 border-t border-[#292D32] bg-[#101214] flex items-center justify-between px-4">
              <Link
                to="/recommendations"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-[#078BFF] hover:text-[#00CFFF]"
              >
                Recommendations
              </Link>
              <Link
                to="/scan-history"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-[#9CA3AF] hover:text-white"
              >
                Scan History &rarr;
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
