import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe,
  Search,
  Video,
  FileImage,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Download,
  Trash2,
  Lock,
  ArrowRight,
  Info,
  CheckCircle2,
  Clock,
  Sparkles,
  PhoneCall,
  FileText,
  Copy,
  Check,
  X,
  Play,
  Layers,
} from 'lucide-react';
import { ExternalRedirectModal } from '../components/common/ExternalRedirectModal';

export const MediaLeakCheckPage = () => {
  // ------------------------------------------
  // External Redirect Modal State
  // ------------------------------------------
  const [redirectModalOpen, setRedirectModalOpen] = useState(false);
  const [targetService, setTargetService] = useState(null);

  const openRedirectDialog = (serviceConfig) => {
    setTargetService(serviceConfig);
    setRedirectModalOpen(true);
  };

  // ------------------------------------------
  // Video Frame Extraction State (Local Browser)
  // ------------------------------------------
  const [videoFile, setVideoFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractedFrames, setExtractedFrames] = useState([]);
  const [selectedFrameId, setSelectedFrameId] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const videoInputRef = useRef(null);

  // Clean up object URLs on unmount or file change
  useEffect(() => {
    return () => {
      extractedFrames.forEach((frame) => {
        if (frame.dataUrl && frame.dataUrl.startsWith('blob:')) {
          URL.revokeObjectURL(frame.dataUrl);
        }
      });
    };
  }, [extractedFrames]);

  // Handle Video Selection
  const handleVideoSelect = (file) => {
    if (!file) return;

    // Reset previous frames
    setExtractedFrames([]);
    setSelectedFrameId(null);
    setVideoError(null);
    setVideoDuration(null);
    setVideoFile(file);

    // Extract frames automatically on selection
    extractFrames(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleVideoSelect(file);
    }
  };

  const clearVideo = () => {
    setVideoFile(null);
    setExtractedFrames([]);
    setSelectedFrameId(null);
    setVideoError(null);
    setVideoDuration(null);
    setExtractionProgress(0);
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  // Local In-Browser Frame Extraction using HTML5 Video and Canvas
  const extractFrames = async (file) => {
    setExtracting(true);
    setExtractionProgress(10);
    setVideoError(null);

    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    const numFrames = 6; // Extract 6 representative keyframes

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      setVideoDuration(duration);

      if (!duration || duration <= 0 || isNaN(duration)) {
        URL.revokeObjectURL(videoUrl);
        setVideoError('Unable to determine video duration. File may be corrupted or unsupported.');
        setExtracting(false);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const frames = [];

      // Scale down canvas for memory efficiency (max width 1280px)
      const targetWidth = Math.min(video.videoWidth || 640, 1280);
      const scale = targetWidth / (video.videoWidth || 640);
      canvas.width = targetWidth;
      canvas.height = (video.videoHeight || 360) * scale;

      // Calculate evenly spaced seek timestamps
      const interval = duration / (numFrames + 1);
      const timestamps = [];
      for (let i = 1; i <= numFrames; i++) {
        timestamps.push(i * interval);
      }

      try {
        for (let i = 0; i < timestamps.length; i++) {
          const t = timestamps[i];
          await seekToTime(video, t);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');

          const mins = Math.floor(t / 60);
          const secs = Math.floor(t % 60);
          const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

          frames.push({
            id: `frame_${i + 1}`,
            index: i + 1,
            timestamp: t,
            timeFormatted,
            dataUrl,
            filename: `traceguard_frame_${String(i + 1).padStart(2, '0')}_${timeFormatted.replace(':', 'm')}s.png`,
          });

          setExtractionProgress(Math.round(((i + 1) / timestamps.length) * 100));
        }

        URL.revokeObjectURL(videoUrl);
        setExtractedFrames(frames);
        if (frames.length > 0) {
          setSelectedFrameId(frames[0].id);
        }
      } catch (err) {
        console.error('Frame extraction failed:', err);
        URL.revokeObjectURL(videoUrl);
        setVideoError(`Local frame extraction failed: ${err.message || 'Browser decoding error'}`);
      } finally {
        setExtracting(false);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      setVideoError('Failed to load video file. Ensure file format is MP4, MOV, or WEBM.');
      setExtracting(false);
    };
  };

  const seekToTime = (video, time) => {
    return new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });
  };

  const downloadFrame = (frame) => {
    if (!frame || !frame.dataUrl) return;
    const link = document.createElement('a');
    link.href = frame.dataUrl;
    link.download = frame.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeSelectedFrame = extractedFrames.find((f) => f.id === selectedFrameId) || extractedFrames[0];

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
      {/* ========================================================================= */}
      {/* 1. PAGE HEADING AND PRIVACY INTRODUCTION                                  */}
      {/* ========================================================================= */}
      <div className="border-b border-[#292D32] pb-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 uppercase tracking-widest mb-1.5 font-bold">
              <Globe className="w-4 h-4" />
              <span>Digital Footprint Auditor • External Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              External Media Leak Check
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Check whether your personal photos or videos may be circulating online using trusted external services. Get guidance on protecting and reporting exposed personal media.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#151719] border border-[#292D32] text-xs text-slate-300 shrink-0 self-start sm:self-auto">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Client-Side Local Runtime • Zero Server Video Uploads</span>
          </div>
        </div>

        {/* Global Privacy Assurance Notice */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/30 via-[#101214] to-indigo-950/30 border border-indigo-500/20 text-xs text-slate-300 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Zero Automatic Data Sharing Guarantee:</strong> TRACE GUARD never automatically uploads your photos, videos, or extracted frames to any external service or cloud server. You control what media to search and upload manually on third-party websites.
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 shrink-0">
            Strict Non-Transmission Policy
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PHOTO LEAK SEARCH                                                      */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-400" />
              <span>Photo Leak Search</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Perform reverse image searches to find matching or modified copies of your personal photos across the web.
            </p>
          </div>
        </div>

        {/* 4-Step Instructions Card */}
        <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] space-y-2">
          <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 tracking-wider">
            Manual Search Instructions
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-slate-300">
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#151719] border border-[#292D32]/50">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
              <span>Open the selected reverse image search service below.</span>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#151719] border border-[#292D32]/50">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
              <span>Manually choose your photo on that external service.</span>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#151719] border border-[#292D32]/50">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
              <span>Review the visual matches and indexed image results.</span>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#151719] border border-[#292D32]/50">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">4</span>
              <span>If you find an unauthorized copy, save the source URL and evidence.</span>
            </div>
          </div>
        </div>

        {/* Two Service Cards: Google Lens & TinEye */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Google Lens Card */}
          <div className="p-6 rounded-2xl bg-[#101214] border border-[#292D32] hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                    G
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Google Lens</h3>
                    <span className="text-[10px] font-mono text-slate-500">Operated by Google LLC</span>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  REVERSE IMAGE SEARCH
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Google Lens can find visually similar images, duplicate photos, and publicly indexed image matches across billions of web pages and social media platforms.
              </p>

              <div className="p-2.5 rounded-lg bg-[#151719] border border-[#292D32]/60 text-[11px] text-slate-400 font-mono">
                Official: https://lens.google.com/
              </div>
            </div>

            <button
              onClick={() =>
                openRedirectDialog({
                  name: 'Google Lens',
                  operator: 'Google LLC',
                  url: 'https://lens.google.com/',
                  category: 'Reverse Image Search',
                })
              }
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              <span>Open Google Lens</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TinEye Card */}
          <div className="p-6 rounded-2xl bg-[#101214] border border-[#292D32] hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                    T
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">TinEye</h3>
                    <span className="text-[10px] font-mono text-slate-500">Operated by TinEye Inc.</span>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  IMAGE MODIFICATION TRACKER
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                TinEye can find matching and modified copies of images in its index. It specializes in pattern matching for altered, cropped, resized, or color-adjusted images.
              </p>

              <div className="p-2.5 rounded-lg bg-[#151719] border border-[#292D32]/60 text-[11px] text-slate-400 font-mono">
                Official: https://tineye.com/
              </div>
            </div>

            <button
              onClick={() =>
                openRedirectDialog({
                  name: 'TinEye',
                  operator: 'TinEye Inc.',
                  url: 'https://tineye.com/',
                  category: 'Reverse Image Search',
                })
              }
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              <span>Open TinEye</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. VIDEO LEAK SEARCH (SEARCH VIDEOS USING FRAMES)                         */}
      {/* ========================================================================= */}
      <section className="space-y-4 pt-4 border-t border-[#292D32]">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-400" />
            <span>Search Videos Using Frames</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Extract representative visual frames locally in your browser to reverse-search key scenes on search engines.
          </p>
        </div>

        {/* Mandatory Technical Notice */}
        <div className="p-4 rounded-xl bg-[#101214] border border-blue-500/30 space-y-1 text-xs text-slate-300 leading-relaxed">
          <div className="flex items-center gap-2 text-blue-400 font-bold">
            <Info className="w-4 h-4 shrink-0" />
            <span>Reverse Video Search Limitation Notice</span>
          </div>
          <p className="text-slate-400">
            Universal reverse-video search across the web is not available from any provider. Searching selected video frames can help identify visually similar images, but it cannot establish whether the complete video has been leaked.
          </p>
        </div>

        {/* Video Selector / Drag-and-Drop Area */}
        <div className="bg-[#101214] border border-[#292D32] rounded-2xl p-6 space-y-4">
          {!videoFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => videoInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-[#292D32] hover:border-slate-500 bg-[#151719]'
              }`}
            >
              <input
                ref={videoInputRef}
                type="file"
                className="hidden"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleVideoSelect(e.target.files[0]);
                  }
                }}
              />
              <Video className="w-10 h-10 text-blue-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">
                Select a video to extract search frames
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports MP4, MOV, and WEBM formats
              </p>
              <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Frames extracted 100% locally on your device • Video is never uploaded to TRACE GUARD</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected Video Header Info */}
              <div className="p-4 rounded-xl bg-[#151719] border border-[#292D32] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white truncate max-w-sm" title={videoFile.name}>
                      {videoFile.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {(videoFile.size / (1024 * 1024)).toFixed(2)} MB • {videoFile.type || 'video/mp4'}{' '}
                      {videoDuration && `• Duration: ${Math.round(videoDuration)}s`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={clearVideo}
                    disabled={extracting}
                    className="px-3.5 py-1.5 rounded-lg bg-[#1B1E22] hover:bg-[#22262B] text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-[#292D32] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Clear Frames & Video</span>
                  </button>
                </div>
              </div>

              {/* Extraction Progress Bar */}
              {extracting && (
                <div className="p-4 rounded-xl bg-[#151719] border border-[#292D32] space-y-2">
                  <div className="flex justify-between text-xs font-mono text-slate-300">
                    <span className="flex items-center gap-2">
                      <Play className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                      <span>Extracting visual keyframes via HTML5 Canvas...</span>
                    </span>
                    <span>{extractionProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#1B1E22] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-200"
                      style={{ width: `${extractionProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Video Extraction Error */}
              {videoError && (
                <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{videoError}</span>
                </div>
              )}

              {/* Extracted Frames Gallery */}
              {extractedFrames.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Extracted Representative Frames ({extractedFrames.length})
                    </span>
                    <span className="text-xs text-slate-400">
                      Click a frame to inspect, download, or search
                    </span>
                  </div>

                  {/* Frame Thumbnails Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {extractedFrames.map((frame) => {
                      const isSelected = selectedFrameId === frame.id;
                      return (
                        <div
                          key={frame.id}
                          onClick={() => setSelectedFrameId(frame.id)}
                          className={`group cursor-pointer rounded-xl overflow-hidden border transition-all ${
                            isSelected
                              ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-500/10'
                              : 'border-[#292D32] hover:border-slate-500 bg-[#151719]'
                          }`}
                        >
                          <div className="aspect-video relative overflow-hidden bg-black">
                            <img
                              src={frame.dataUrl}
                              alt={`Frame at ${frame.timeFormatted}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                              {frame.timeFormatted}
                            </span>
                          </div>
                          <div className="p-2 text-center text-[11px] font-mono font-semibold text-slate-300 truncate">
                            Frame #{frame.index}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected Frame Action Panel */}
                  {activeSelectedFrame && (
                    <div className="p-5 rounded-xl bg-[#151719] border border-[#292D32] flex flex-col md:flex-row items-center justify-between gap-5">
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <img
                          src={activeSelectedFrame.dataUrl}
                          alt="Active Frame"
                          className="w-24 h-16 object-cover rounded-lg border border-[#292D32] shrink-0"
                        />
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold text-white">
                            Selected Frame #{activeSelectedFrame.index} (Timestamp {activeSelectedFrame.timeFormatted})
                          </h4>
                          <p className="text-xs text-slate-400">
                            Download this frame to your device, then upload it on Google Lens or TinEye.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
                        {/* Download Selected Frame */}
                        <button
                          onClick={() => downloadFrame(activeSelectedFrame)}
                          className="px-3.5 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Frame</span>
                        </button>

                        {/* Search on Google Lens */}
                        <button
                          onClick={() =>
                            openRedirectDialog({
                              name: 'Google Lens',
                              operator: 'Google LLC',
                              url: 'https://lens.google.com/',
                              category: 'Reverse Image Search',
                            })
                          }
                          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-600/20"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Search on Google Lens</span>
                          <ExternalLink className="w-3 h-3 text-indigo-200" />
                        </button>

                        {/* Search on TinEye */}
                        <button
                          onClick={() =>
                            openRedirectDialog({
                              name: 'TinEye',
                              operator: 'TinEye Inc.',
                              url: 'https://tineye.com/',
                              category: 'Reverse Image Search',
                            })
                          }
                          className="px-3.5 py-2 rounded-lg bg-[#1B1E22] hover:bg-[#22262B] text-slate-300 border border-[#292D32] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <Search className="w-3.5 h-3.5 text-blue-400" />
                          <span>Search on TinEye</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. INTIMATE MEDIA PROTECTION                                              */}
      {/* ========================================================================= */}
      <section className="space-y-4 pt-4 border-t border-[#292D32]">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>Intimate Media Protection</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographic digital fingerprinting initiatives designed to stop non-consensual intimate imagery (NCII) from being shared.
          </p>
        </div>

        {/* Warning Banner */}
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 leading-relaxed space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-200">
            <Lock className="w-4 h-4 text-rose-400" />
            <span>Never Upload Intimate Media to TRACE GUARD</span>
          </div>
          <p className="text-slate-300">
            TRACE GUARD does not collect or inspect intimate images. Instead, use the verified official platforms below, which generate zero-knowledge cryptographic hashes (digital fingerprints) locally on your device without ever uploading the original image files.
          </p>
        </div>

        {/* Two Service Cards: StopNCII.org & Take It Down */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* StopNCII.org Card */}
          <div className="p-6 rounded-2xl bg-[#101214] border border-[#292D32] hover:border-rose-500/40 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold">
                    S
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">StopNCII.org</h3>
                    <span className="text-[10px] font-mono text-slate-500">Operated by SWGfL & Platform Partners</span>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  ADULTS (18+)
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p>
                  <strong>Eligibility:</strong> Intended for eligible adults (18+) whose intimate images were taken when they were adults.
                </p>
                <p className="text-slate-400">
                  Creates digital hashes (fingerprints) locally on your device. Participating platforms (Facebook, Instagram, OnlyFans, Threads, TikTok, Reddit, etc.) use these fingerprints to detect and prevent unauthorized sharing across their networks.
                </p>
                <p className="text-[11px] text-slate-500 italic">
                  Note: Does not scan the entire internet or unpartnered independent forums.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#151719] border border-[#292D32]/60 text-[11px] text-slate-400 font-mono">
                Official: https://stopncii.org/
              </div>
            </div>

            <button
              onClick={() =>
                openRedirectDialog({
                  name: 'StopNCII.org',
                  operator: 'SWGfL & Global Tech Platform Partners',
                  url: 'https://stopncii.org/',
                  category: 'Adult Non-Consensual Intimate Image Protection',
                })
              }
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/30"
            >
              <span>Visit StopNCII</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Take It Down Card */}
          <div className="p-6 rounded-2xl bg-[#101214] border border-[#292D32] hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                    N
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Take It Down</h3>
                    <span className="text-[10px] font-mono text-slate-500">Operated by NCMEC</span>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                  UNDER 18 (YOUTH)
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p>
                  <strong>Eligibility:</strong> For eligible intimate images or videos taken when the person was under 18 years of age.
                </p>
                <p className="text-slate-400">
                  Operated by the National Center for Missing & Exploited Children (NCMEC). Generates a cryptographic digital fingerprint directly on your device without uploading the original media. Participating platforms use the fingerprint to help detect and remove matching content.
                </p>
                <p className="text-[11px] text-slate-500 italic">
                  Note: Designed to safeguard minors from youth non-consensual imagery and CSAM.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#151719] border border-[#292D32]/60 text-[11px] text-slate-400 font-mono">
                Official: https://takeitdown.ncmec.org/
              </div>
            </div>

            <button
              onClick={() =>
                openRedirectDialog({
                  name: 'Take It Down',
                  operator: 'National Center for Missing & Exploited Children (NCMEC)',
                  url: 'https://takeitdown.ncmec.org/',
                  category: 'Youth Intimate Image Protection',
                })
              }
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              <span>Visit Take It Down</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. REPORT A LEAK AND TAKEDOWN GUIDANCE                                    */}
      {/* ========================================================================= */}
      <section className="space-y-4 pt-4 border-t border-[#292D32]">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span>What to Do If You Find a Leak</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Follow this step-by-step incident response playbook if your personal or intimate media has been posted without your consent.
          </p>
        </div>

        {/* 6-Step Takedown Guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <h4 className="text-xs font-bold text-white">Do Not Panic or Engage</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Do not retaliate, negotiate with, or pay extortionists or distributing accounts. Engaging often prompts blackmailers to demand more money.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <h4 className="text-xs font-bold text-white">Preserve Evidence Lawfully</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Capture full-screen screenshots showing URLs, profile handles, timestamps, and comments where safe and lawful. Save direct page links into a secure document.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">3</span>
              <h4 className="text-xs font-bold text-white">Report on Hosting Platform</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Use the hosting platform’s official reporting button (e.g. "Report Non-Consensual Imagery" or "Privacy Violation"). Most major platforms expedite NCII takedowns.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">4</span>
              <h4 className="text-xs font-bold text-white">Request Host / Search Takedown</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Submit formal de-indexing requests to search engines (Google Removal Form, Bing) and file DMCA / privacy complaints with the web host or domain registrar.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">5</span>
              <h4 className="text-xs font-bold text-white">Register Hashes with StopNCII</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              If intimate media is involved, create digital fingerprints on StopNCII.org (or Take It Down if under 18) to proactively prevent re-upload across partner networks.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32] space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">6</span>
              <h4 className="text-xs font-bold text-white">Seek Cybercrime Authority Help</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              If the situation involves extortion, coercion, blackmail, or child exploitation, file an official report with your regional cybercrime agency immediately.
            </p>
          </div>
        </div>

        {/* Country-Aware Reporting Section (Prominently featuring India) */}
        <div className="p-6 rounded-2xl bg-[#101214] border border-[#292D32] space-y-5">
          <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Official Cybercrime & Emergency Contacts (India & International)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official governmental reporting portals for extortion, non-consensual media, and cyber blackmail.
              </p>
            </div>
          </div>

          {/* India Official Portals Card */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-[#151719] via-[#101214] to-[#151719] border border-emerald-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    India — National Cyber Crime Reporting Portal
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    GOVERNMENT OF INDIA
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Ministry of Home Affairs portal specifically dedicated to reporting cybercrimes, with dedicated priority tracks for crimes against women and children.
                </p>
              </div>

              <button
                onClick={() =>
                  openRedirectDialog({
                    name: 'National Cyber Crime Reporting Portal',
                    operator: 'Ministry of Home Affairs, Government of India',
                    url: 'https://cybercrime.gov.in/',
                    category: 'Government Cybercrime Portal',
                  })
                }
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shrink-0 transition-colors shadow-lg shadow-emerald-600/20"
              >
                <span>Visit Cyber Crime Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Emergency Hotlines in India */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-[#0E1012] border border-[#292D32] flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">Cyber Crime Helpline</span>
                  <span className="text-sm font-bold text-white font-mono">1930</span>
                  <span className="text-[10px] text-slate-400 block">Toll-free national cyber fraud & crime helpline</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#0E1012] border border-[#292D32] flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 shrink-0">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">Emergency Response System</span>
                  <span className="text-sm font-bold text-white font-mono">112</span>
                  <span className="text-[10px] text-slate-400 block">Immediate police assistance where danger or physical threats exist</span>
                </div>
              </div>
            </div>
          </div>

          {/* International Contacts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#151719] border border-[#292D32] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">United States — FBI IC3</span>
                <span className="text-[10px] font-mono text-slate-500">FBI</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                The Internet Crime Complaint Center is the central hub for reporting cyber extortion, harassment, and online threats in the US.
              </p>
              <button
                onClick={() =>
                  openRedirectDialog({
                    name: 'FBI Internet Crime Complaint Center (IC3)',
                    operator: 'Federal Bureau of Investigation (FBI)',
                    url: 'https://www.ic3.gov/',
                    category: 'US Law Enforcement',
                  })
                }
                className="text-indigo-400 hover:text-indigo-300 font-semibold text-xs flex items-center gap-1 pt-1"
              >
                <span>Visit ic3.gov</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#151719] border border-[#292D32] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">United Kingdom — Action Fraud</span>
                <span className="text-[10px] font-mono text-slate-500">City of London Police</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                The UK's national fraud and cybercrime reporting centre providing immediate advice and crime reference numbers.
              </p>
              <button
                onClick={() =>
                  openRedirectDialog({
                    name: 'Action Fraud UK',
                    operator: 'City of London Police',
                    url: 'https://www.actionfraud.police.uk/',
                    category: 'UK Law Enforcement',
                  })
                }
                className="text-indigo-400 hover:text-indigo-300 font-semibold text-xs flex items-center gap-1 pt-1"
              >
                <span>Visit actionfraud.police.uk</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Evidence Disclaimer */}
          <div className="p-3.5 rounded-lg bg-[#0E1012] border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Crucial Safety Directive:</strong> Never forward, upload, or attach intimate content as evidence to TRACE GUARD. Law enforcement agencies maintain designated, secure legal evidence custody channels.
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. PRIVACY AND THIRD-PARTY DISCLAIMER                                     */}
      {/* ========================================================================= */}
      <section className="p-5 rounded-xl bg-[#101214] border border-[#292D32] space-y-2 text-xs text-slate-400 leading-relaxed">
        <span className="font-bold text-white block text-sm">
          Privacy and Third-Party Security Disclaimer:
        </span>
        <p>
          TRACE GUARD provides informational guidance and client-side extraction tools. TRACE GUARD does not crawl private databases, dark web marketplaces, or unindexed forums, and cannot guarantee that all unauthorized copies of media will be identified.
        </p>
        <p>
          All reverse search and intimate media protection platforms linked on this page are operated by independent third parties under their respective terms and privacy policies. TRACE GUARD does not receive, retain, or verify the results of any external searches.
        </p>
      </section>

      {/* Third-Party Redirect Confirmation Dialog Modal */}
      <ExternalRedirectModal
        isOpen={redirectModalOpen}
        onClose={() => setRedirectModalOpen(false)}
        targetService={targetService}
      />
    </div>
  );
};

export default MediaLeakCheckPage;

