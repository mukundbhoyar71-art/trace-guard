import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Database,
  KeyRound,
  FileCheck,
  Shield,
  FileSearch,
  Sparkles,
  Info,
  Wrench,
} from 'lucide-react';
import { scanService } from '../services/scanService';

const CATEGORY_META = {
  email_exposure: { label: 'Email Exposure Scan', icon: Database, color: 'text-[#00CFFF]' },
  password_breach: { label: 'Password Breach Check', icon: KeyRound, color: 'text-emerald-400' },
  external_verification: { label: 'External Breach Verification', icon: FileCheck, color: 'text-indigo-400' },
  browser_permission: { label: 'Browser Permission Audit', icon: Shield, color: 'text-amber-400' },
  app_permission: { label: 'App Permission Audit', icon: ShieldAlert, color: 'text-orange-400' },
  sensitive_media: { label: 'Sensitive Media Scan', icon: FileSearch, color: 'text-purple-400' },
};

const getSeverityBadge = (severity) => {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/40';
    case 'high':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/40';
    case 'moderate':
    case 'medium':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/40';
    default:
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
  }
};

const getStatusBadge = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <XCircle className="w-3.5 h-3.5" />
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5" />
          {status || 'Pending'}
        </span>
      );
  }
};

const PREFIX_TO_CATEGORY = {
  EXP: 'email_exposure',
  PWD: 'password_breach',
  EXT: 'external_verification',
  BRW: 'browser_permission',
  APP: 'app_permission',
  MED: 'sensitive_media',
};

export const ScanDetailPage = () => {
  const { category, scanId } = useParams();
  const navigate = useNavigate();

  let resolvedCategory = category || 'email_exposure';
  let resolvedRecordId = scanId;
  if (!category && typeof scanId === 'string' && scanId.includes('-')) {
    const [prefix, numPart] = scanId.split('-');
    if (PREFIX_TO_CATEGORY[prefix?.toUpperCase()] && /^\d+$/.test(numPart || '')) {
      resolvedCategory = PREFIX_TO_CATEGORY[prefix.toUpperCase()];
      resolvedRecordId = numPart;
    }
  }
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadDetail = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await scanService.getUnifiedDetail(resolvedCategory, resolvedRecordId);
        if (active) setDetail(data);
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load scan details or access unauthorized.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDetail();
    return () => {
      active = false;
    };
  }, [resolvedCategory, resolvedRecordId]);

  const catMeta = CATEGORY_META[resolvedCategory] || CATEGORY_META.email_exposure;
  const CatIcon = catMeta.icon;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Top Breadcrumb / Back Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#292D32]">
        <button
          type="button"
          onClick={() => navigate('/scan-history')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#151719] hover:bg-[#1E2124] text-slate-300 hover:text-white border border-[#292D32] text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Unified Scan History</span>
        </button>

        {detail && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Scan ID:</span>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-[#101214] text-[#00CFFF] border border-[#078BFF]/30">
              {detail.id}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-[#101214] border border-[#292D32] rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-xs text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-[#078BFF]" />
          <span>Retrieving authenticated scan dossier...</span>
        </div>
      ) : error || !detail ? (
        <div className="bg-rose-950/35 border border-rose-500/40 rounded-2xl p-8 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Scan Record Not Found</h2>
            <p className="text-xs text-rose-200 max-w-md mx-auto">
              {error || 'The requested scan record does not exist or belongs to another account.'}
            </p>
          </div>
          <Link
            to="/scan-history"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#078BFF] hover:bg-[#0576DB] text-white text-xs font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Scan History</span>
          </Link>
        </div>
      ) : (
        <>
          {/* Header Dossier Card */}
          <section className="bg-[#101214] border border-[#292D32] rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#151719] border border-[#292D32] flex items-center justify-center shrink-0">
                  <CatIcon className={`w-5 h-5 ${catMeta.color}`} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-white">{detail.scan_name}</h1>
                    {detail.is_demo && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        <Sparkles className="w-3 h-3" /> Demo Telemetry
                      </span>
                    )}
                    {getStatusBadge(detail.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Category: <span className="text-slate-200">{detail.category_label}</span> • Target:{' '}
                    <span className="text-white">{detail.target}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1.5">
                <span
                  className={`text-xs font-bold uppercase px-3 py-1 rounded-full border ${getSeverityBadge(
                    detail.severity
                  )}`}
                >
                  {detail.severity} Severity
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Executed: {new Date(detail.executed_at).toLocaleString()}
                </span>
              </div>
            </div>

            {detail.error_message && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Execution Error: {detail.error_message}</span>
              </div>
            )}

            {/* Key Provenance & Summary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-[#151719] border border-[#292D32]">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Findings Count
                </span>
                <div className="text-xl font-black text-white mt-1">{detail.findings_count}</div>
                <span className="text-[10px] text-slate-400">
                  {detail.verified_findings_count} verified / {detail.unverified_findings_count} unverified
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#151719] border border-[#292D32]">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Severity Score
                </span>
                <div className="text-xl font-black text-white mt-1">
                  {detail.risk_score !== null && detail.risk_score !== undefined
                    ? `${detail.risk_score}/100`
                    : 'N/A'}
                </div>
                <span className="text-[10px] uppercase text-slate-400 font-mono">{detail.severity}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#151719] border border-[#292D32] col-span-2 md:col-span-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Scan Source & Provenance
                </span>
                <div className="text-sm font-bold text-white mt-1">{detail.scan_source}</div>
                <span className="text-[11px] text-[#00CFFF] font-mono">
                  Verification: {detail.verification_status}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#151719] border border-[#292D32]">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Completed At
                </span>
                <div className="text-xs font-mono text-white mt-1.5">
                  {detail.completed_at ? new Date(detail.completed_at).toLocaleDateString() : 'Not completed'}
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {detail.completed_at ? new Date(detail.completed_at).toLocaleTimeString() : '—'}
                </span>
              </div>
            </div>
          </section>

          {/* Severity Breakdown Strip */}
          {detail.severity_breakdown && (
            <section className="bg-[#101214] border border-[#292D32] rounded-2xl p-5 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Severity Distribution Breakdown
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                  <span className="text-rose-300 font-semibold">Critical</span>
                  <span className="text-white font-black text-sm">{detail.severity_breakdown.critical ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-between">
                  <span className="text-orange-300 font-semibold">High</span>
                  <span className="text-white font-black text-sm">{detail.severity_breakdown.high ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <span className="text-amber-300 font-semibold">Moderate</span>
                  <span className="text-white font-black text-sm">{detail.severity_breakdown.moderate ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <span className="text-emerald-300 font-semibold">Low / Safe</span>
                  <span className="text-white font-black text-sm">{detail.severity_breakdown.low ?? 0}</span>
                </div>
              </div>
            </section>
          )}

          {/* Individual Findings */}
          <section className="bg-[#101214] border border-[#292D32] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00CFFF]" />
                <span>Audit Findings & Items ({detail.findings?.length || 0})</span>
              </h2>
              <span className="text-[11px] font-mono text-slate-400">{detail.summary}</span>
            </div>

            {detail.findings && detail.findings.length > 0 ? (
              <div className="space-y-3">
                {detail.findings.map((finding, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#151719] border border-[#292D32] space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{finding.title}</span>
                        {finding.category_or_domain && (
                          <span className="text-[11px] font-mono text-slate-400">
                            ({finding.category_or_domain})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#101214] text-slate-300 border border-[#292D32]">
                          {finding.verification_status}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getSeverityBadge(
                            finding.severity
                          )}`}
                        >
                          {finding.severity}
                        </span>
                      </div>
                    </div>

                    {finding.details && (
                      <p className="text-xs text-slate-300 leading-relaxed">{finding.details}</p>
                    )}

                    {finding.data_classes && finding.data_classes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {finding.data_classes.map((dc, dIdx) => (
                          <span
                            key={dIdx}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#101214] text-slate-300 border border-[#292D32]"
                          >
                            {dc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[#151719] border border-[#292D32] text-center text-xs text-slate-400">
                Zero risk findings recorded in this check ({detail.summary}).
              </div>
            )}
          </section>

          {/* Recommendations & Technical Metadata */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-[#101214] border border-[#292D32] rounded-2xl p-6 space-y-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-400" />
                <span>Recommended Remediation Actions</span>
              </h2>
              {detail.recommendations && detail.recommendations.length > 0 ? (
                <ul className="space-y-2 text-xs text-slate-300">
                  {detail.recommendations.map((rec, i) => (
                    <li key={i} className="p-3 rounded-xl bg-[#151719] border border-[#292D32] flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">No immediate remediation actions required for this check.</p>
              )}
            </section>

            <section className="bg-[#101214] border border-[#292D32] rounded-2xl p-6 space-y-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-[#078BFF]" />
                <span>Audit Provenance & Technical Metadata</span>
              </h2>
              {detail.metadata && Object.keys(detail.metadata).length > 0 ? (
                <div className="bg-[#151719] border border-[#292D32] rounded-xl divide-y divide-[#292D32] text-xs">
                  {Object.entries(detail.metadata).map(([k, v]) => (
                    <div key={k} className="px-3.5 py-2.5 flex items-start justify-between gap-4">
                      <span className="font-mono text-slate-400 capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-slate-200 text-right break-all max-w-xs">
                        {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '—')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No extra technical metadata attached to this record.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default ScanDetailPage;

