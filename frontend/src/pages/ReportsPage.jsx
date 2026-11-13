import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
  FileCheck,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { reportService } from '../services/reportService';

export const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportFilter, setReportFilter] = useState('all'); // 'all' | 'production' | 'demo'
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [toast, setToast] = useState(null);

  // New Report Configuration Form State — defaults strictly to Production data only
  const [showModal, setShowModal] = useState(false);
  const [reportTitle, setReportTitle] = useState('Comprehensive Digital Exposure & Privacy Assessment');
  const [includeDemo, setIncludeDemo] = useState(false);

  const showNotification = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadReports = useCallback(
    async (isSilent = false, filterType = reportFilter) => {
      if (!isSilent) setLoading(true);
      setError('');
      try {
        const typeParam = filterType === 'all' ? null : filterType;
        const data = await reportService.listReports(typeParam);
        setReports(data?.items || []);
      } catch (err) {
        console.error('Failed to list reports:', err);
        setError(err.message || 'Failed to fetch security reports list.');
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [reportFilter]
  );

  useEffect(() => {
    loadReports(false, reportFilter);
  }, [loadReports, reportFilter]);

  const handleGenerateReport = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const newReport = await reportService.generateReport({
        report_title: reportTitle.trim() || 'TRACE GUARD Comprehensive Security Dossier',
        include_demo_data: includeDemo,
      });

      showNotification('Confidential Security Dossier PDF successfully generated.');
      setShowModal(false);
      await loadReports(true, reportFilter);

      // Auto-trigger download for convenient UX
      await handleDownload(newReport.id, `TRACE_GUARD_Report_${newReport.id}.pdf`);
    } catch (err) {
      showNotification(err.message || 'Failed to generate report PDF.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (reportId, filename) => {
    setDownloadingId(reportId);
    try {
      await reportService.downloadReport(reportId, filename);
      showNotification('Report download initiated.');
    } catch (err) {
      showNotification(err.message || 'Failed to download report PDF.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getRiskBadge = (rep) => {
    const score = rep.risk_score;
    if (score === null || score === undefined) {
      return {
        cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
        label: `Insufficient Data${rep.summary_json?.coverage_percentage ? ` (${rep.summary_json.coverage_percentage}% cov)` : ''}`,
      };
    }
    if (score >= 70) {
      return {
        cls: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
        label: `${score}/100 (${rep.risk_category || 'Critical'})`,
      };
    }
    if (score >= 40) {
      return {
        cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        label: `${score}/100 (${rep.risk_category || 'High'})`,
      };
    }
    if (score >= 20) {
      return {
        cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        label: `${score}/100 (${rep.risk_category || 'Moderate'})`,
      };
    }
    return {
      cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      label: `${score}/100 (${rep.risk_category || 'Low'})`,
    };
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium flex items-center gap-2.5 transition-all duration-300 ${
            toast.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-800'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
          }`}
        >
          {toast.type === 'error' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#292D32]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Security Dossiers & Audit Reports</h1>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Executive PDF Engine
            </span>
          </div>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Export real-data cybersecurity dossiers summarizing your risk posture, 5 security pillars, verified breach findings, permission audits, monitoring cadence, and remediation plans.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadReports(false, reportFilter)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#151719] hover:bg-[#1E2124] text-slate-300 hover:text-white border border-[#292D32] transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Generate PDF Dossier</span>
          </button>
        </div>
      </div>

      {/* Prominent Legal & Data Scope Disclaimer Banner */}
      <div className="bg-[#101214] border border-[#292D32] rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white block mb-0.5">Confidential Real-Data Reporting Policy:</span>
          Dossiers strictly compile authenticated database records for your account, explicitly distinguishing API-verified exposure scans, user-attested manual HIBP checks, browser/app permission audits, and unperformed checks. Simulated demo telemetry is excluded by default.
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 flex items-center justify-between gap-4 text-xs text-rose-200">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadReports(false, reportFilter)}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold border border-rose-500/40"
          >
            Retry
          </button>
        </div>
      )}

      {/* Reports Listing Table */}
      <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#292D32]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Generated Dossier Archive</h2>
            <span className="text-xs text-slate-400 ml-1 font-mono">({reports.length})</span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#151719] border border-[#292D32] rounded-lg text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'production', label: 'Production' },
              { id: 'demo', label: 'Demo-Inclusive' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setReportFilter(tab.id)}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  reportFilter === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span>Loading generated PDF security dossiers...</span>
          </div>
        ) : reports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase bg-[#151719] text-slate-400 border-b border-[#292D32]">
                <tr>
                  <th className="px-4 py-3">Report ID</th>
                  <th className="px-4 py-3">Report Title</th>
                  <th className="px-4 py-3">Created Date</th>
                  <th className="px-4 py-3">Report Type</th>
                  <th className="px-4 py-3">Risk Assessment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">File Size</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292D32]/50 text-slate-300">
                {reports.map((rep) => {
                  const filename = `TRACE_GUARD_Report_${rep.id}.pdf`;
                  const isDownloading = downloadingId === rep.id;
                  const riskBadge = getRiskBadge(rep);
                  const repType =
                    rep.report_type ||
                    (rep.is_demo ? 'Demo-Inclusive Dossier' : 'Production Security Dossier');
                  const repStatus = rep.status || 'Available';
                  const isAvailable = repStatus === 'Available';

                  return (
                    <tr key={rep.id} className="hover:bg-[#151719]/60 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-indigo-300 whitespace-nowrap">
                        #{rep.id}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-white">
                        <div className="flex items-center gap-2.5">
                          <FileCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div>
                            <div className="text-sm font-semibold text-white">{rep.report_title}</div>
                            {rep.summary_json?.coverage_percentage !== undefined && (
                              <div className="text-[11px] text-slate-400 font-mono">
                                Coverage: {rep.summary_json.coverage_percentage}% • Engine v
                                {rep.summary_json.engine_version || '3.0'}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                        {new Date(rep.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {rep.is_demo ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            {repType}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            {repType}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${riskBadge.cls}`}>
                          {riskBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3" /> {repStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                        {formatFileSize(rep.file_size_bytes)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDownload(rep.id, filename)}
                          disabled={isDownloading || !isAvailable}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                          <span>{isDownloading ? 'Downloading...' : 'Download PDF'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 text-xs space-y-3 border border-dashed border-[#292D32] rounded-xl bg-[#151719]/40">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-300 font-semibold">No security dossiers found.</p>
            <p className="max-w-md mx-auto text-slate-400">
              Click "Generate PDF Dossier" above to compile your authentic risk score, pillar coverage, scan findings, permission audits, and monitoring cadence into a downloadable PDF.
            </p>
          </div>
        )}
      </div>

      {/* Modal: Generate Report */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#101214] border border-[#292D32] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#292D32]">
              <h3 className="text-lg font-bold text-white">Generate Executive Security Report</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Compile your verified risk score, 5 security pillars, live breach findings, user-confirmed HIBP checks, permission audits, monitoring status, and remediation actions into a timestamped PDF dossier.
            </p>

            <form onSubmit={handleGenerateReport} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Dossier Title</label>
                <input
                  type="text"
                  required
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full bg-[#151719] border border-[#292D32] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-[#151719] border border-[#292D32] rounded-lg p-3">
                <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDemo}
                    onChange={(e) => setIncludeDemo(e.target.checked)}
                    className="mt-0.5 rounded bg-[#101214] border-[#292D32] text-indigo-500 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-white block">
                      Include Isolated Demo Simulation Appendix
                    </span>
                    <span className="text-[11px] text-slate-400 leading-snug block mt-0.5">
                      Optional. Appends simulated demo scans in a clearly separated fictional appendix without altering your verified Risk Score.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#292D32]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {generating && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{generating ? 'Building PDF...' : 'Generate & Download'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
