import React, { useState, useEffect, useRef } from 'react';
import {
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
  Eye,
  X,
  FileImage,
  Cpu,
} from 'lucide-react';
import { mediaScannerService } from '../../services/mediaScannerService';

export const SensitiveMediaScannerSection = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchResult, setBatchResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [modelStatus, setModelStatus] = useState(null);
  const [loadingModelStatus, setLoadingModelStatus] = useState(true);

  const fileInputRef = useRef(null);

  // Check local ONNX model availability on mount
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const status = await mediaScannerService.getModelStatus();
        if (isMounted) setModelStatus(status);
      } catch (err) {
        console.error('Failed to query model status:', err);
        if (isMounted) {
          setModelStatus({
            status: 'UNAVAILABLE',
            model_name: 'Falconsai/nsfw_image_detection (ONNX ViT)',
            license: 'Apache-2.0',
          });
        }
      } finally {
        if (isMounted) setLoadingModelStatus(false);
      }
    };
    fetchStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFilesSelected = (newFiles) => {
    if (!newFiles || newFiles.length === 0) return;

    setError(null);
    setBatchResult(null);

    const validFiles = Array.from(newFiles);
    setSelectedFiles(validFiles);

    // Generate previews
    const previews = validFiles.map((f) => {
      if (f.type.startsWith('image/')) {
        return { file: f, url: URL.createObjectURL(f) };
      }
      return { file: f, url: null };
    });
    setFilePreviews(previews);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const removeFile = (indexToRemove) => {
    const updatedFiles = selectedFiles.filter((_, idx) => idx !== indexToRemove);
    const updatedPreviews = filePreviews.filter((_, idx) => idx !== indexToRemove);
    setSelectedFiles(updatedFiles);
    setFilePreviews(updatedPreviews);
    if (updatedFiles.length === 0) {
      setBatchResult(null);
      setError(null);
    }
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setBatchResult(null);
    setError(null);
    setProgress(0);
  };

  const handleStartScan = async () => {
    if (selectedFiles.length === 0) return;

    setScanning(true);
    setError(null);
    setProgress(15);

    try {
      const res = await mediaScannerService.detectImages(selectedFiles, (pct) => {
        setProgress(Math.max(15, pct));
      });
      setProgress(100);
      setBatchResult(res);
    } catch (err) {
      console.error('AI image scan failed:', err);
      setError(err.message || 'On-device AI scan encountered an error.');
    } finally {
      setScanning(false);
    }
  };

  const getStatusBadge = (status, statusDisplay) => {
    switch (status) {
      case 'SENSITIVE_DETECTED':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{statusDisplay || 'Potentially sensitive content detected'}</span>
          </span>
        );
      case 'NO_SENSITIVE_DETECTED':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{statusDisplay || 'No supported sensitive category detected'}</span>
          </span>
        );
      case 'MODEL_UNAVAILABLE':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-slate-500/20 text-slate-400 border border-slate-500/40 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>{statusDisplay || 'Model unavailable'}</span>
          </span>
        );
      case 'UNSUPPORTED_FILE':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            <span>{statusDisplay || 'Unsupported file'}</span>
          </span>
        );
      case 'SCAN_FAILED':
      default:
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            <span>{statusDisplay || 'Scan failed'}</span>
          </span>
        );
    }
  };

  return (
    <section className="bg-[#101214] border border-[#292D32] rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#292D32] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest font-bold">
              Phase A • On-Device AI Vision Intelligence
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Local ONNX Runtime
            </span>
          </div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Sensitive Media Scanner
          </h2>
          <p className="text-xs text-slate-400">
            Local CPU Vision Transformer (ViT) classification. Evaluates images entirely in-memory with zero cloud API transmission.
          </p>
        </div>

        {/* Live Model Status Indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-lg bg-[#151719] border border-[#292D32] flex items-center gap-2 text-xs">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono text-[11px]">Model:</span>
              {loadingModelStatus ? (
                <span className="text-slate-500 text-[11px] animate-pulse">Checking...</span>
              ) : modelStatus?.status === 'AVAILABLE' ? (
                <span className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active (CPU)
                </span>
              ) : (
                <span className="text-amber-400 font-semibold text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Unavailable
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Model Unavailable Banner (if applicable) */}
      {!loadingModelStatus && modelStatus?.status === 'UNAVAILABLE' && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-200 block">Pretrained ONNX Classifier Unavailable</span>
            <p className="text-slate-300">
              The local ONNX model binary (<code>backend/models/nsfw_detector.onnx</code>) is currently missing. Scans will explicitly report a <strong>Model unavailable</strong> status rather than displaying fake or simulated results.
            </p>
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.005]'
            : 'border-[#292D32] hover:border-slate-500 bg-[#151719]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
        <UploadCloud className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-white">
          Drop image files here or click to browse
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Supports JPG, JPEG, PNG, and WEBP • Max 25 MB per image • Multiple selection enabled
        </p>
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>RAM-only processing • Never saved permanently • Zero external LLM calls</span>
        </div>
      </div>

      {/* Selected Files Queue */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Selected Images ({selectedFiles.length}):
            </span>
            <button
              onClick={clearAll}
              disabled={scanning}
              className="text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-50"
            >
              Clear selection
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filePreviews.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-[#151719] border border-[#292D32] relative group flex items-center gap-3"
              >
                {item.url ? (
                  <img
                    src={item.url}
                    alt={item.file.name}
                    className="w-12 h-12 rounded object-cover border border-[#292D32] shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-[#1B1E22] flex items-center justify-center border border-[#292D32] shrink-0">
                    <FileImage className="w-6 h-6 text-indigo-400" />
                  </div>
                )}

                <div className="overflow-hidden flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {(item.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                {!scanning && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-[#1B1E22] transition-colors"
                    title="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-end pt-2">
            <button
              onClick={handleStartScan}
              disabled={scanning || selectedFiles.length === 0}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/30"
            >
              {scanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing On-Device Inference...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Scan {selectedFiles.length} {selectedFiles.length === 1 ? 'Image' : 'Images'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Scanning Progress Bar */}
      {scanning && (
        <div className="space-y-2 p-4 rounded-xl bg-[#151719] border border-[#292D32]">
          <div className="flex justify-between text-xs font-mono text-slate-300">
            <span>Executing Local ONNX ViT Tensor Normalization & Classification...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-[#1B1E22] rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Display */}
      {batchResult && (
        <div className="space-y-5 pt-3 border-t border-[#292D32]">
          {/* Summary KPI Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#151719] border border-[#292D32]">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Total Scanned</span>
              <span className="text-lg font-bold text-white mt-0.5 block">{batchResult.total_files}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#151719] border border-rose-500/30">
              <span className="text-[10px] font-mono text-rose-400 uppercase block">Sensitive Detected</span>
              <span className="text-lg font-bold text-rose-400 mt-0.5 block">
                {batchResult.sensitive_files_count}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#151719] border border-emerald-500/30">
              <span className="text-[10px] font-mono text-emerald-400 uppercase block">No Sensitive Detected</span>
              <span className="text-lg font-bold text-emerald-400 mt-0.5 block">
                {batchResult.total_files - batchResult.sensitive_files_count}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#151719] border border-[#292D32]">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Overall Risk</span>
              <span
                className={`text-sm font-bold mt-1 block uppercase ${
                  batchResult.overall_risk === 'HIGH' ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {batchResult.overall_risk === 'HIGH' ? 'ELEVATED RISK' : 'LOW RISK'}
              </span>
            </div>
          </div>

          {/* Individual Image Results */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Classification Findings by File</h3>

            {batchResult.results.map((res, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl bg-[#151719] border border-[#292D32] space-y-4 hover:border-slate-600 transition-colors"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#1B1E22] flex items-center justify-center border border-[#292D32] shrink-0">
                      <FileImage className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white break-all">{res.file_name}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {(res.file_size_bytes / 1024).toFixed(1)} KB • {res.mime_type}
                      </p>
                    </div>
                  </div>

                  <div className="self-start sm:self-auto">
                    {getStatusBadge(res.status, res.status_display)}
                  </div>
                </div>

                {/* Probabilities & Confidence Bar (when model inference succeeded) */}
                {res.confidence !== null && res.confidence !== undefined && (
                  <div className="space-y-2 p-3.5 rounded-lg bg-[#0E1012] border border-[#292D32]/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-400">
                        Primary Prediction: <strong className="text-white uppercase">{res.primary_label}</strong>
                      </span>
                      <span
                        className={`font-mono font-bold text-xs ${
                          res.is_sensitive ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        Confidence: {res.confidence_percent}%
                      </span>
                    </div>

                    {/* Dual Probability Bar */}
                    {res.probabilities && res.probabilities.normal !== undefined && (
                      <div className="space-y-1">
                        <div className="h-2 w-full bg-[#1B1E22] rounded-full overflow-hidden flex">
                          <div
                            className="bg-emerald-500 transition-all duration-300"
                            style={{ width: `${(res.probabilities.normal * 100).toFixed(1)}%` }}
                            title={`Normal: ${(res.probabilities.normal * 100).toFixed(1)}%`}
                          />
                          <div
                            className="bg-rose-500 transition-all duration-300"
                            style={{ width: `${(res.probabilities.nsfw * 100).toFixed(1)}%` }}
                            title={`Sensitive: ${(res.probabilities.nsfw * 100).toFixed(1)}%`}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-500">
                          <span>Normal: {(res.probabilities.normal * 100).toFixed(1)}%</span>
                          <span>Sensitive: {(res.probabilities.nsfw * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Probabilistic Interpretation & Disclaimer */}
                <div className="space-y-1 text-xs">
                  <p className="text-slate-300 leading-relaxed">
                    <span className="font-bold text-slate-200">Assessment: </span>
                    {res.interpretation}
                  </p>
                  <p className="text-indigo-400 leading-relaxed">
                    <span className="font-bold text-indigo-300">Recommendation: </span>
                    {res.recommendation}
                  </p>
                </div>

                {/* Model Metadata Pill */}
                {res.model_info && res.model_info.model_name && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#292D32]/60 text-[10px] font-mono text-slate-500">
                    <span>Engine: {res.model_info.model_name}</span>
                    <span>•</span>
                    <span>License: {res.model_info.license || 'Apache-2.0'}</span>
                    <span>•</span>
                    <span>Provider: {res.model_info.execution_provider || 'CPUExecutionProvider'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mandatory Safety Notice */}
          <div className="p-4 rounded-xl bg-[#151719] border border-[#292D32] space-y-1 text-xs text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-200 block text-xs">Probabilistic Classification Notice:</span>
            <p>
              On-device machine learning classifiers operate probabilistically. False positives and false negatives may occur depending on lighting, subject composition, and style. An absence of detected sensitive categories does not imply or certify that an image is safe or suitable for public distribution.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default SensitiveMediaScannerSection;

