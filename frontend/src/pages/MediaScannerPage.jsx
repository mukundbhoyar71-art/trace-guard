import React, { useState, useRef } from 'react';
import {
  FileImage,
  FileAudio,
  UploadCloud,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
  Clock,
  Sparkles,
  Lock,
  Layers,
  ArrowRight,
  FileText,
  Volume2,
  Eye,
  Sliders,
  Check,
  X,
  FileSearch,
  MapPin,
  Download,
  ExternalLink,
  Code2,
  Copy,
  Terminal,
  Filter,
} from 'lucide-react';
import { mediaScannerService } from '../services/mediaScannerService';

export const MediaScannerPage = () => {
  const [activeTab, setActiveTab] = useState('media-scanner'); // 'media-scanner', 'metadata', 'document-scanner'

  // ==========================================
  // TAB 1: SENSITIVE MEDIA SCANNER STATE
  // ==========================================
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // ==========================================
  // TAB 2: METADATA INTELLIGENCE STATE
  // ==========================================
  const [metaFile, setMetaFile] = useState(null);
  const [metaPreviewUrl, setMetaPreviewUrl] = useState(null);
  const [metaScanning, setMetaScanning] = useState(false);
  const [metaProgress, setMetaProgress] = useState(0);
  const [metaResult, setMetaResult] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [sanitizing, setSanitizing] = useState(false);
  const [sanitizeSuccess, setSanitizeSuccess] = useState(null);
  const [isMetaDragOver, setIsMetaDragOver] = useState(false);
  const metaFileInputRef = useRef(null);

  // ==========================================
  // TAB 3: DOCUMENT PII SCANNER STATE
  // ==========================================
  const [docFile, setDocFile] = useState(null);
  const [docScanning, setDocScanning] = useState(false);
  const [docProgress, setDocProgress] = useState(0);
  const [docResult, setDocResult] = useState(null);
  const [docError, setDocError] = useState(null);
  const [docFilter, setDocFilter] = useState('ALL'); // 'ALL', 'CRITICAL', 'HIGH', 'MEDIUM'
  const [isDocDragOver, setIsDocDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const docFileInputRef = useRef(null);

  // ------------------------------------------
  // Tab 1 Handlers
  // ------------------------------------------
  const handleFileChange = (file) => {
    if (!file) return;
    setScanResult(null);
    setError(null);
    setProgress(0);
    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleStartScan = async () => {
    if (!selectedFile) return;
    setScanning(true);
    setError(null);
    setProgress(20);

    try {
      const res = await mediaScannerService.scanMedia(selectedFile, (pct) => {
        setProgress(Math.max(20, pct));
      });
      setProgress(100);
      setScanResult(res);
    } catch (err) {
      console.error('Media scan failed:', err);
      setError(err.response?.data?.detail || err.message || 'Media scan encountered an unexpected error.');
    } finally {
      setScanning(false);
    }
  };

  // ------------------------------------------
  // Tab 2 Handlers (Metadata Intelligence)
  // ------------------------------------------
  const handleMetaFileChange = (file) => {
    if (!file) return;
    setMetaResult(null);
    setMetaError(null);
    setSanitizeSuccess(null);
    setMetaProgress(0);
    setMetaFile(file);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setMetaPreviewUrl(url);
    } else {
      setMetaPreviewUrl(null);
    }
  };

  const handleStartMetaExtract = async () => {
    if (!metaFile) return;
    setMetaScanning(true);
    setMetaError(null);
    setSanitizeSuccess(null);
    setMetaProgress(25);

    try {
      const res = await mediaScannerService.extractMetadata(metaFile, (pct) => {
        setMetaProgress(Math.max(25, pct));
      });
      setMetaProgress(100);
      setMetaResult(res);
    } catch (err) {
      console.error('Metadata extraction failed:', err);
      setMetaError(err.response?.data?.detail || err.message || 'Metadata extraction failed.');
    } finally {
      setMetaScanning(false);
    }
  };

  const handleDownloadSanitized = async () => {
    const fileToSanitize = metaFile || selectedFile;
    if (!fileToSanitize) return;

    setSanitizing(true);
    setSanitizeSuccess(null);
    try {
      const result = await mediaScannerService.downloadSanitizedFile(fileToSanitize);
      setSanitizeSuccess(`Successfully stripped metadata! Downloaded "${result.filename}" (${(result.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error('Sanitization download failed:', err);
      setMetaError('Failed to sanitize and download file.');
    } finally {
      setSanitizing(false);
    }
  };

  // ------------------------------------------
  // Tab 3 Handlers (Document PII Scanner)
  // ------------------------------------------
  const handleDocFileChange = (file) => {
    if (!file) return;
    setDocResult(null);
    setDocError(null);
    setDocProgress(0);
    setDocFile(file);
  };

  const handleStartDocScan = async () => {
    if (!docFile) return;
    setDocScanning(true);
    setDocError(null);
    setDocProgress(20);

    try {
      const res = await mediaScannerService.scanDocument(docFile, (pct) => {
        setDocProgress(Math.max(20, pct));
      });
      setDocProgress(100);
      setDocResult(res);
    } catch (err) {
      console.error('Document scan failed:', err);
      setDocError(err.response?.data?.detail || err.message || 'Document scan failed.');
    } finally {
      setDocScanning(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper Badges
  const getStatusBadge = (detectionType) => {
    switch (detectionType) {
      case 'CONFIRMED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> CONFIRMED
          </span>
        );
      case 'POSSIBLE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" /> POSSIBLE
          </span>
        );
      case 'NOT_DETECTED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> NOT DETECTED
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-500/20 text-slate-400 border border-slate-500/30 flex items-center gap-1">
            <Info className="w-3 h-3" /> UNAVAILABLE
          </span>
        );
      case 'UNSUPPORTED':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> UNSUPPORTED
          </span>
        );
    }
  };

  const getRiskBadge = (risk) => {
    switch (risk) {
      case 'CRITICAL':
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/40">CRITICAL RISK</span>;
      case 'HIGH':
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-orange-500/20 text-orange-400 border border-orange-500/40">HIGH RISK</span>;
      case 'MODERATE':
      case 'MEDIUM':
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40">MODERATE RISK</span>;
      case 'LOW':
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/40">LOW RISK</span>;
      case 'CLEAN':
      default:
        return <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">CLEAN / SAFE</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#292D32] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 uppercase tracking-widest mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Digital Footprint Auditor • Advanced Privacy Suite</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Sensitive Media & File Privacy Intelligence
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Local algorithmic inspection of media exposures, EXIF hardware metadata, GPS coordinates, and document secrets.
          </p>
        </div>

        {/* Global Privacy Indicator Pill */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#151719] border border-[#292D32] text-xs text-slate-300">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>Local In-Memory Runtime • Zero External Cloud Storage</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#292D32] pb-3">
        <button
          onClick={() => setActiveTab('media-scanner')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'media-scanner'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-[#151719]'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Sensitive Media Scanner</span>
        </button>

        <button
          onClick={() => setActiveTab('metadata')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'metadata'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-[#151719]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Metadata Intelligence & Sanitizer</span>
          {metaResult && metaResult.has_gps && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('document-scanner')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'document-scanner'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-[#151719]'
          }`}
        >
          <FileSearch className="w-4 h-4" />
          <span>Sensitive Information & PII Detector</span>
          {docResult && docResult.findings_count_by_severity.CRITICAL > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-400 text-[10px]">
              {docResult.findings_count_by_severity.CRITICAL}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SENSITIVE MEDIA SCANNER                                            */}
      {/* ========================================================================= */}
      {activeTab === 'media-scanner' && (
        <div className="space-y-6">
          <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-1">Select Media File to Scan</h2>
            <p className="text-xs text-slate-400 mb-4">
              Supported formats: Images (JPG, JPEG, PNG, WEBP) and Audio (MP3, WAV, M4A). Max file size: 25MB.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-[#292D32] hover:border-slate-500 bg-[#151719]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">Click or drag & drop media file here</p>
              <p className="text-xs text-slate-500 mt-1">Processed entirely in-memory. Zero disk persistence.</p>
            </div>

            {selectedFile && (
              <div className="mt-4 p-4 rounded-lg bg-[#151719] border border-[#292D32] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-12 h-12 rounded object-cover border border-[#292D32]" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-[#1B1E22] flex items-center justify-center border border-[#292D32]">
                      <FileAudio className="w-6 h-6 text-indigo-400" />
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate max-w-xs">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'media file'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleStartScan}
                    disabled={scanning}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/30"
                  >
                    {scanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Analyzing Local Vectors...</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4" />
                        <span>Run Algorithmic Scan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {scanning && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Executing Mathematical Chrominance & Structure Heuristics...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#1B1E22] rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Results Display */}
          {scanResult && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-[#101214] border border-[#292D32] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 uppercase">File Analyzed:</span>
                    <span className="text-sm font-bold text-white">{scanResult.file_name}</span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-3">
                    <span>Kind: {scanResult.media_kind.toUpperCase()}</span>
                    <span>•</span>
                    <span>Status: {scanResult.scan_status}</span>
                  </div>
                </div>
                <div>{getRiskBadge(scanResult.overall_privacy_risk)}</div>
              </div>

              {/* Technical Properties Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(scanResult.technical_properties).map(([key, val]) => (
                  <div key={key} className="p-3.5 rounded-lg bg-[#101214] border border-[#292D32]">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block truncate">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-bold text-slate-200 mt-0.5 block truncate">
                      {String(val)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Findings List */}
              <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-white">Algorithmic Heuristic Findings</h3>
                <div className="space-y-3">
                  {scanResult.findings.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-[#151719] border border-[#292D32] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{item.category}</span>
                        {getStatusBadge(item.detection_type)}
                      </div>
                      <p className="text-xs text-slate-300">{item.detail}</p>
                      <div className="text-[11px] text-slate-400 flex items-start gap-1.5 pt-1 border-t border-[#292D32]/60">
                        <span className="text-indigo-400 font-bold shrink-0">Recommendation:</span>
                        <span>{item.recommendation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Truthful Capabilities Disclosure */}
              <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#292D32]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-base font-semibold text-white">Classifier Engine Capabilities</h3>
                  </div>
                  <span className="text-xs text-slate-500">Zero Simulated Scores Policy</span>
                </div>
                <div className="space-y-3">
                  {scanResult.classifier_capabilities.map((cap, idx) => (
                    <div key={idx} className="p-3.5 rounded-lg bg-[#151719] border border-[#292D32] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{cap.capability_name}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            cap.status === 'ACTIVE_LOCAL_HEURISTIC'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                          }`}
                        >
                          {cap.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{cap.engine_details}</p>
                      <p className="text-[11px] text-slate-500 italic">{cap.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: METADATA INTELLIGENCE & SANITIZER                                  */}
      {/* ========================================================================= */}
      {activeTab === 'metadata' && (
        <div className="space-y-6">
          <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-1">Metadata Intelligence & GPS Auditor</h2>
            <p className="text-xs text-slate-400 mb-4">
              Inspect embedded EXIF hardware serials, GPS coordinates, timestamps, and audio ID3 container tags.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsMetaDragOver(true);
              }}
              onDragLeave={() => setIsMetaDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsMetaDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleMetaFileChange(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => metaFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isMetaDragOver
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-[#292D32] hover:border-slate-500 bg-[#151719]'
              }`}
            >
              <input
                ref={metaFileInputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp,.wav,.mp3"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleMetaFileChange(e.target.files[0]);
                  }
                }}
              />
              <Sliders className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">Select image or audio file to audit metadata</p>
              <p className="text-xs text-slate-500 mt-1">Supports JPG, PNG, WEBP, WAV, MP3</p>
            </div>

            {metaFile && (
              <div className="mt-4 p-4 rounded-lg bg-[#151719] border border-[#292D32] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {metaPreviewUrl ? (
                    <img src={metaPreviewUrl} alt="Preview" className="w-12 h-12 rounded object-cover border border-[#292D32]" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-[#1B1E22] flex items-center justify-center border border-[#292D32]">
                      <FileAudio className="w-6 h-6 text-indigo-400" />
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate max-w-xs">{metaFile.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {(metaFile.size / 1024).toFixed(1)} KB • {metaFile.type || 'file'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleStartMetaExtract}
                    disabled={metaScanning}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/30"
                  >
                    {metaScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Parsing EXIF / IFD Blocks...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>Audit Metadata</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {metaScanning && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Deconstructing EXIF, GPS and audio containers...</span>
                  <span>{metaProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#1B1E22] rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${metaProgress}%` }} />
                </div>
              </div>
            )}

            {metaError && (
              <div className="mt-4 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{metaError}</span>
              </div>
            )}
          </div>

          {/* Metadata Results View */}
          {metaResult && (
            <div className="space-y-6">
              {/* Summary Header */}
              <div className="p-6 rounded-xl bg-[#101214] border border-[#292D32] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 uppercase">Target:</span>
                    <span className="text-sm font-bold text-white">{metaResult.file_name}</span>
                  </div>
                  <p className="text-xs text-slate-300">{metaResult.summary}</p>
                </div>
                <div>{getRiskBadge(metaResult.overall_metadata_risk)}</div>
              </div>

              {/* GPS Geolocation Alert Box (if GPS is present) */}
              {metaResult.has_gps && metaResult.gps_coordinates && (
                <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/40 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-rose-500/20 text-rose-400">
                        <MapPin className="w-6 h-6 animate-bounce" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Physical GPS Coordinates Embedded</h3>
                        <p className="text-xs text-rose-300/80 mt-0.5">
                          Latitude: {metaResult.gps_coordinates.latitude}°, Longitude: {metaResult.gps_coordinates.longitude}°
                        </p>
                      </div>
                    </div>

                    <a
                      href={metaResult.gps_coordinates.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shrink-0 transition-colors shadow-lg shadow-rose-600/30"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View on Google Maps</span>
                    </a>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    This file discloses the exact physical geolocation where it was captured. Correlating this location could compromise home, business, or confidential site privacy.
                  </p>
                </div>
              )}

              {/* One-Click Sanitizer Card */}
              <div className="p-6 rounded-xl bg-[#101214] border border-indigo-500/30 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <ShieldCheck className="w-5 h-5" />
                      <h3 className="text-sm font-bold text-white">One-Click Metadata Sanitization</h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Strip all EXIF, GPS, camera serials, and ID3 tags. Your original file remains 100% untouched.
                    </p>
                  </div>

                  <button
                    onClick={handleDownloadSanitized}
                    disabled={sanitizing}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-600/30"
                  >
                    {sanitizing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sanitizing In-Memory...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Download Sanitized Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {sanitizeSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{sanitizeSuccess}</span>
                  </div>
                )}
              </div>

              {/* Metadata Fields Table */}
              <div className="bg-[#101214] border border-[#292D32] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-[#292D32] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Extracted Metadata Tags ({metaResult.metadata_fields.length})</h3>
                  <span className="text-xs text-slate-500">Categorized by Privacy Significance</span>
                </div>

                <div className="divide-y divide-[#292D32]/60">
                  {metaResult.metadata_fields.map((field, idx) => (
                    <div key={idx} className="p-4 hover:bg-[#151719] transition-colors space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{field.label}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1B1E22] text-slate-400 border border-[#292D32]">
                            {field.category}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border self-start sm:self-auto ${
                            field.privacy_risk_level === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : field.privacy_risk_level === 'HIGH'
                              ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                              : field.privacy_risk_level === 'MEDIUM'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                          }`}
                        >
                          {field.privacy_risk_level}
                        </span>
                      </div>

                      <div className="p-2 rounded bg-[#0E1012] border border-[#292D32]/40 font-mono text-xs text-indigo-300 break-all">
                        {field.value}
                      </div>

                      <p className="text-[11px] text-slate-400 italic">
                        <span className="font-semibold text-slate-300">Privacy Significance: </span>
                        {field.privacy_significance}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DOCUMENT PII & SECRETS DETECTOR                                    */}
      {/* ========================================================================= */}
      {activeTab === 'document-scanner' && (
        <div className="space-y-6">
          <div className="bg-[#101214] border border-[#292D32] rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-1">Sensitive Information & PII Detector</h2>
            <p className="text-xs text-slate-400 mb-4">
              Local document scanning with Luhn-verified financial card detection, IBAN mod-97 verification, SSNs, and cloud API keys.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDocDragOver(true);
              }}
              onDragLeave={() => setIsDocDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDocDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleDocFileChange(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => docFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDocDragOver
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-[#292D32] hover:border-slate-500 bg-[#151719]'
              }`}
            >
              <input
                ref={docFileInputRef}
                type="file"
                className="hidden"
                accept=".txt,.csv,.json,.log,.md,.xml,.yaml,.yml,.pdf,.env,.sql"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleDocFileChange(e.target.files[0]);
                  }
                }}
              />
              <FileSearch className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">Select document (TXT, CSV, JSON, LOG, MD, PDF)</p>
              <p className="text-xs text-slate-500 mt-1">Processed entirely in-memory. Zero cloud transmission.</p>
            </div>

            {docFile && (
              <div className="mt-4 p-4 rounded-lg bg-[#151719] border border-[#292D32] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-12 h-12 rounded bg-[#1B1E22] flex items-center justify-center border border-[#292D32]">
                    <FileText className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate max-w-xs">{docFile.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {(docFile.size / 1024).toFixed(1)} KB • {docFile.type || 'document'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleStartDocScan}
                    disabled={docScanning}
                    className="w-full sm:w-auto px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/30"
                  >
                    {docScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Scanning PII & Checksums...</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4" />
                        <span>Scan Document for PII</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {docScanning && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Executing Luhn card checksums, IBAN mod-97, and regex engines...</span>
                  <span>{docProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#1B1E22] rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${docProgress}%` }} />
                </div>
              </div>
            )}

            {docError && (
              <div className="mt-4 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{docError}</span>
              </div>
            )}
          </div>

          {/* Document Scan Results Display */}
          {docResult && (
            <div className="space-y-6">
              {/* Metric Counters Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32]">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Total Lines</span>
                  <span className="text-xl font-bold text-white mt-1 block">{docResult.total_lines}</span>
                </div>
                <div className="p-4 rounded-xl bg-[#101214] border border-rose-500/30">
                  <span className="text-[10px] font-mono text-rose-400 uppercase block">Critical Findings</span>
                  <span className="text-xl font-bold text-rose-400 mt-1 block">
                    {docResult.findings_count_by_severity.CRITICAL || 0}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-[#101214] border border-orange-500/30">
                  <span className="text-[10px] font-mono text-orange-400 uppercase block">High Severity</span>
                  <span className="text-xl font-bold text-orange-400 mt-1 block">
                    {docResult.findings_count_by_severity.HIGH || 0}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-[#101214] border border-amber-500/30">
                  <span className="text-[10px] font-mono text-amber-400 uppercase block">Medium Severity</span>
                  <span className="text-xl font-bold text-amber-400 mt-1 block">
                    {docResult.findings_count_by_severity.MEDIUM || 0}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] flex flex-col justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Risk Level</span>
                  <div>{getRiskBadge(docResult.overall_privacy_risk)}</div>
                </div>
              </div>

              {/* Severity Filter Bar */}
              <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-300">Filter Severity:</span>
                  {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setDocFilter(lvl)}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        docFilter === lvl
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#151719] text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-500">
                  Showing {docResult.findings.filter((f) => docFilter === 'ALL' || f.severity === docFilter).length} of {docResult.findings.length} findings
                </span>
              </div>

              {/* Findings List */}
              {docResult.findings.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#101214] border border-emerald-500/30 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h3 className="text-sm font-bold text-white">Clean Document — Zero Sensitive Findings</h3>
                  <p className="text-xs text-slate-400">
                    No credit card PANs, SSNs, IBANs, API keys, or personal addresses detected.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {docResult.findings
                    .filter((f) => docFilter === 'ALL' || f.severity === docFilter)
                    .map((item) => (
                      <div
                        key={item.finding_id}
                        className="p-5 rounded-xl bg-[#101214] border border-[#292D32] space-y-3 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm font-bold text-white">{item.category}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                item.severity === 'CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                  : item.severity === 'HIGH'
                                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              }`}
                            >
                              {item.severity}
                            </span>
                            {item.detection_type === 'CONFIRMED' ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                CONFIRMED
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                POSSIBLE
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                            {item.line_number && <span>Line {item.line_number}</span>}
                            {item.column_offset !== null && <span>Col {item.column_offset}</span>}
                          </div>
                        </div>

                        {/* Masked Value Snippet */}
                        <div className="p-3 rounded-lg bg-[#0E1012] border border-[#292D32] flex items-center justify-between gap-2 font-mono text-xs">
                          <span className="text-rose-300 font-semibold truncate">{item.masked_value}</span>
                          <button
                            onClick={() => copyToClipboard(item.masked_value, item.finding_id)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1B1E22] transition-colors"
                            title="Copy masked token"
                          >
                            {copiedId === item.finding_id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Evidence & Snippet */}
                        <div className="p-2.5 rounded bg-[#151719] border border-[#292D32]/50 font-mono text-[11px] text-slate-300">
                          <span className="text-slate-500 select-none mr-2">$</span>
                          <span>{item.evidence_snippet}</span>
                        </div>

                        {/* Risk & Remediation */}
                        <div className="space-y-1 pt-1 border-t border-[#292D32]/60 text-xs">
                          <p className="text-slate-300 leading-relaxed">
                            <span className="font-bold text-rose-400">Risk Assessment: </span>
                            {item.risk_explanation}
                          </p>
                          <p className="text-indigo-400 leading-relaxed">
                            <span className="font-bold text-indigo-300">Remediation: </span>
                            {item.remediation_advice}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Actionable Recommendations Card */}
              {docResult.recommendations && docResult.recommendations.length > 0 && (
                <div className="bg-[#101214] border border-indigo-500/30 rounded-xl p-5 space-y-2.5">
                  <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider block">
                    Security Remediation Plan
                  </span>
                  <ul className="space-y-1.5">
                    {docResult.recommendations.map((rec, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Global Local Guarantee Footer */}
      <div className="p-5 rounded-xl bg-[#101214] border border-[#292D32] space-y-2 text-xs text-slate-400 leading-relaxed">
        <span className="font-bold text-white block text-sm">Privacy & Security Architecture Guarantee:</span>
        <p>
          TRACE GUARD performs all media chrominance heuristic calculations, EXIF/GPS coordinate parsing, and document PII regex/checksum validations strictly in memory inside your local backend runtime. Zero media files or document contents are uploaded to external LLM endpoints (Gemini, OpenAI), written to temp folders, or stored in any database.
        </p>
      </div>
    </div>
  );
};

export default MediaScannerPage;
