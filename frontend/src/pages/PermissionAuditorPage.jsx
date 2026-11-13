import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Camera,
  Mic,
  MapPin,
  Bell,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
  Clock,
  Layers,
  Sparkles,
  Lock,
  Smartphone,
  Laptop,
  Check,
  X,
  Save,
} from 'lucide-react';
import { browserPermissionService, PERMISSION_STATUS, PERMISSION_EXPLANATIONS } from '../services/browserPermissionService';
import { privacyService } from '../services/privacyService';

const PERMISSION_KEYS = ['camera', 'microphone', 'location', 'notifications'];

export const PermissionAuditorPage = () => {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [browserInfo, setBrowserInfo] = useState({});
  const [testingKey, setTestingKey] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [savingAudit, setSavingAudit] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [toast, setToast] = useState(null);

  // Keep references to active PermissionStatus objects for event listener cleanup
  const statusListenersRef = useRef([]);

  const showNotification = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3800);
  };

  // Passive query of all 4 real permissions (NO prompts triggered)
  const refreshPermissions = useCallback(async (isUserAction = false) => {
    if (isUserAction) setRefreshing(true);
    else setLoading(true);

    // Clean up previous change listeners
    statusListenersRef.current.forEach(({ obj, handler }) => {
      try {
        if (obj && typeof obj.removeEventListener === 'function') {
          obj.removeEventListener('change', handler);
        }
      } catch (_) {}
    });
    statusListenersRef.current = [];

    try {
      const bInfo = browserPermissionService.getBrowserDetails();
      setBrowserInfo(bInfo);

      const queried = await browserPermissionService.queryAllPermissions();
      setPermissions(queried);

      // Attach real-time change listeners to Permissions API objects where supported
      Object.values(queried).forEach((p) => {
        if (p.permissionStatusObj && typeof p.permissionStatusObj.addEventListener === 'function') {
          const handler = () => {
            // Re-query passively when user toggles permission in browser lock icon / site settings
            browserPermissionService.queryPermission(p.key).then((updated) => {
              setPermissions((prev) => ({
                ...prev,
                [p.key]: updated,
              }));
              showNotification(`Browser updated ${updated.name} permission to: ${updated.status}`, 'info');
            });
          };

          try {
            p.permissionStatusObj.addEventListener('change', handler);
            statusListenersRef.current.push({ obj: p.permissionStatusObj, handler });
          } catch (_) {}
        }
      });

      if (isUserAction) {
        showNotification('Browser permissions re-audited successfully.');
      }
    } catch (err) {
      console.error('Failed to query browser permissions:', err);
      showNotification('Failed to query browser permissions', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshPermissions(false);

    return () => {
      // Clean up event listeners on unmount
      statusListenersRef.current.forEach(({ obj, handler }) => {
        try {
          if (obj && typeof obj.removeEventListener === 'function') {
            obj.removeEventListener('change', handler);
          }
        } catch (_) {}
      });
    };
  }, [refreshPermissions]);

  // User-Controlled Permission Testing
  const handleTestPermission = async (key) => {
    setTestingKey(key);
    try {
      let res;
      if (key === 'camera') {
        res = await browserPermissionService.testCamera();
      } else if (key === 'microphone') {
        res = await browserPermissionService.testMicrophone();
      } else if (key === 'location') {
        res = await browserPermissionService.testLocation();
      } else if (key === 'notifications') {
        res = await browserPermissionService.testNotifications();
      }

      if (res) {
        setTestResults((prev) => ({
          ...prev,
          [key]: res,
        }));

        // Immediately update displayed permission status with actual result
        setPermissions((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            status: res.status,
            lastChecked: new Date(),
          },
        }));

        showNotification(res.message, res.status === PERMISSION_STATUS.GRANTED ? 'success' : res.status === PERMISSION_STATUS.DENIED ? 'warning' : 'info');
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [key]: {
          status: PERMISSION_STATUS.ERROR,
          message: `Test failed: ${err.message}`,
        },
      }));
      showNotification(`Test encountered an error: ${err.message}`, 'error');
    } finally {
      setTestingKey(null);
    }
  };

  // Save / Sync Audit Snapshot to TRACE GUARD Profile
  const handleSaveAuditSnapshot = async () => {
    setSavingAudit(true);
    try {
      const permMap = {};
      PERMISSION_KEYS.forEach((k) => {
        permMap[k] = permissions[k]?.status || PERMISSION_STATUS.UNSUPPORTED;
      });

      await privacyService.saveBrowserAudit({
        browser_name: browserInfo.browser || 'Browser',
        permissions: permMap,
        notes: `Real browser permission audit conducted via Browser APIs. Verified ${new Date().toLocaleDateString()}.`,
      });

      setLastSavedTime(new Date());
      showNotification('Browser audit snapshot saved to your security profile.');
    } catch (err) {
      showNotification(err.message || 'Failed to sync audit snapshot.', 'error');
    } finally {
      setSavingAudit(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case PERMISSION_STATUS.GRANTED:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> GRANTED
          </span>
        );
      case PERMISSION_STATUS.DENIED:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" /> DENIED (PROTECTED)
          </span>
        );
      case PERMISSION_STATUS.PROMPT:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" /> PROMPT
          </span>
        );
      case PERMISSION_STATUS.UNSUPPORTED:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-500/15 text-slate-400 border border-slate-500/30">
            <Info className="w-3.5 h-3.5" /> UNSUPPORTED
          </span>
        );
      case PERMISSION_STATUS.ERROR:
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-950 text-rose-300 border border-rose-800">
            <XCircle className="w-3.5 h-3.5" /> ERROR
          </span>
        );
    }
  };

  const getPermissionIcon = (key) => {
    switch (key) {
      case 'camera':
        return <Camera className="w-5 h-5 text-indigo-400" />;
      case 'microphone':
        return <Mic className="w-5 h-5 text-indigo-400" />;
      case 'location':
        return <MapPin className="w-5 h-5 text-indigo-400" />;
      case 'notifications':
        return <Bell className="w-5 h-5 text-indigo-400" />;
      default:
        return <Layers className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getTestButtonLabel = (key) => {
    switch (key) {
      case 'camera':
        return 'Test Camera';
      case 'microphone':
        return 'Test Microphone';
      case 'location':
        return 'Check Location Permission';
      case 'notifications':
        return 'Test Notifications';
      default:
        return 'Test Permission';
    }
  };

  // Counts of actual browser states
  const grantedCount = Object.values(permissions).filter((p) => p.status === PERMISSION_STATUS.GRANTED).length;
  const deniedCount = Object.values(permissions).filter((p) => p.status === PERMISSION_STATUS.DENIED).length;
  const promptCount = Object.values(permissions).filter((p) => p.status === PERMISSION_STATUS.PROMPT).length;
  const unsupportedCount = Object.values(permissions).filter((p) => p.status === PERMISSION_STATUS.UNSUPPORTED).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium flex items-center gap-2.5 transition-all duration-300 ${
            toast.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-800'
              : toast.type === 'warning'
              ? 'bg-amber-950/90 text-amber-200 border-amber-800'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
          }`}
        >
          {toast.type === 'error' ? (
            <XCircle className="w-4 h-4" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#292D32]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Browser Permission Auditor</h1>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Real API Detection
            </span>
          </div>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Real-time inspection of active web security scopes (Camera, Microphone, Location, Notifications) using official W3C Permissions APIs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshPermissions(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-300 hover:text-white border border-[#292D32] transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh Permissions</span>
          </button>

          <button
            onClick={handleSaveAuditSnapshot}
            disabled={savingAudit || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
          >
            {savingAudit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Sync Snapshot</span>
          </button>
        </div>
      </div>

      {/* MANDATORY TECHNICAL LIMITATION DISCLOSURE */}
      <div className="bg-[#101214] border border-blue-500/30 rounded-xl p-5 flex items-start gap-3.5 text-xs text-slate-300 leading-relaxed shadow-lg">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-white text-sm block">Installed Native Application Limitations:</span>
          <p>
            Due to browser sandboxing and operating system security boundaries, this web application cannot inspect or query permissions granted to other installed native Android, iOS, Windows, or macOS applications.
          </p>
          <p className="text-slate-400">
            TRACE GUARD performs authentic, real-time auditing of browser-level hardware and data access scopes granted to this web origin. No mock data, simulated installed apps, or fabricated permissions are ever displayed.
          </p>
        </div>
      </div>

      {/* OVERVIEW STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Granted Scopes</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          </div>
          <div className="text-2xl font-bold text-rose-400">{grantedCount}</div>
          <p className="text-[11px] text-slate-400">Active scopes with immediate hardware or data access.</p>
        </div>

        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Denied (Protected)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{deniedCount}</div>
          <p className="text-[11px] text-slate-400">Scopes explicitly blocked by user or browser policy.</p>
        </div>

        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Prompt (Pending)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          </div>
          <div className="text-2xl font-bold text-amber-400">{promptCount}</div>
          <p className="text-[11px] text-slate-400">Unrequested scopes; browser will prompt upon demand.</p>
        </div>

        <div className="bg-[#101214] border border-[#292D32] rounded-xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Active Environment</span>
            <Laptop className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-sm font-bold text-white truncate">{browserInfo.browser || 'Browser'}</div>
          <p className="text-[11px] text-slate-400 truncate">{browserInfo.platform || 'Operating System'}</p>
        </div>
      </div>

      {/* REAL PERMISSION AUDIT GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Verified Browser Security Scopes</span>
            <span className="text-xs font-normal text-slate-400">(4 Core Vectors)</span>
          </h2>
          {lastSavedTime && (
            <span className="text-xs text-slate-500">
              Snapshot saved {lastSavedTime.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PERMISSION_KEYS.map((key) => {
            const perm = permissions[key] || {
              key,
              name: key.charAt(0).toUpperCase() + key.slice(1),
              status: PERMISSION_STATUS.UNSUPPORTED,
              supported: false,
              supportText: 'Evaluating...',
              lastChecked: new Date(),
            };
            const explanation = PERMISSION_EXPLANATIONS[key] || {};
            const isTesting = testingKey === key;
            const testResult = testResults[key];

            return (
              <div
                key={key}
                className="bg-[#101214] border border-[#292D32] rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
              >
                {/* Header row: Icon, Name, and Actual Status */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#151719] border border-[#292D32] flex items-center justify-center">
                        {getPermissionIcon(key)}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{explanation.title || perm.name}</h3>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>Last checked: {perm.lastChecked ? new Date(perm.lastChecked).toLocaleTimeString() : 'Pending'}</span>
                        </span>
                      </div>
                    </div>

                    <div>{getStatusBadge(perm.status)}</div>
                  </div>

                  {/* Browser Support Status */}
                  <div className="bg-[#151719] px-3 py-1.5 rounded-lg border border-[#292D32]/80 text-[11px] text-slate-400 mb-3 flex items-center justify-between">
                    <span className="text-slate-500">API Support:</span>
                    <span className="font-mono text-slate-300 font-medium">{perm.supportText}</span>
                  </div>

                  {/* Explanation & Security Implication */}
                  <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                    <p>{explanation.description}</p>
                    <div className="bg-[#0A0D14] p-3 rounded-lg border border-[#292D32]/60 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                        Threat Implication:
                      </span>
                      <p className="text-[11px] text-slate-400">{explanation.implication}</p>
                    </div>
                  </div>
                </div>

                {/* User-Controlled Test Section */}
                <div className="pt-3 border-t border-[#292D32] space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleTestPermission(key)}
                      disabled={isTesting || loading}
                      className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
                    >
                      {isTesting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Requesting Prompt...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>{getTestButtonLabel(key)}</span>
                        </>
                      )}
                    </button>

                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                      Requires explicit click
                    </span>
                  </div>

                  {/* Test Outcome Feedback */}
                  {testResult && (
                    <div
                      className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                        testResult.status === PERMISSION_STATUS.GRANTED
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          : testResult.status === PERMISSION_STATUS.DENIED
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : testResult.status === PERMISSION_STATUS.UNSUPPORTED
                          ? 'bg-slate-500/10 border-slate-500/30 text-slate-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {testResult.status === PERMISSION_STATUS.GRANTED ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : testResult.status === PERMISSION_STATUS.DENIED ? (
                        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PRIVACY & ZERO-KNOWLEDGE GUARANTEE CARD */}
      <div className="bg-[#101214] border border-[#292D32] rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>TRACE GUARD Privacy & Hardware Sandboxing Guarantees</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400 leading-relaxed">
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <b>Zero Media Retention:</b> Camera and microphone hardware tracks are immediately stopped upon grant verification. Zero audio or video frames are recorded, captured, or transmitted.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <b>Discarded Coordinates:</b> Geolocation tests verify permission grant only. Latitude and longitude coordinates are immediately discarded and never stored or logged in any database.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <b>Zero AI Telemetry:</b> Browser permission states are never sent to external LLMs or third-party analytical telemetry endpoints.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <b>User-Initiated Execution:</b> No sensor requests or browser permission prompts are ever invoked automatically upon page render.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionAuditorPage;
