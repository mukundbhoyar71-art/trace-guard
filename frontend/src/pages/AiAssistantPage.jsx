import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Trash2,
  Sparkles,
  ShieldAlert,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Lock,
  ArrowRight,
  Info,
  User,
  Activity,
  X,
  Zap,
} from 'lucide-react';
import { aiService } from '../services/aiService';

// Lightweight Markdown Formatter for Assistant Responses
function renderFormattedMessage(text) {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div className="space-y-2 text-xs md:text-sm leading-relaxed text-[#E5E7EB]">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className="text-sm md:text-base font-bold text-white tracking-wide text-[#00CFFF] pt-1"
            >
              {trimmed.replace('### ', '')}
            </h4>
          );
        }

        if (trimmed.startsWith('#### ')) {
          return (
            <h5
              key={idx}
              className="text-xs md:text-sm font-semibold text-[#93C5FD] pt-1"
            >
              {trimmed.replace('#### ', '')}
            </h5>
          );
        }

        if (trimmed === '---') {
          return <hr key={idx} className="border-[#292D32] my-2" />;
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#078BFF] mt-1.5 shrink-0" />
              <div>{renderInlineFormatting(content)}</div>
            </div>
          );
        }

        if (/^\d+\.\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)\.\s/)[1];
          const content = trimmed.replace(/^\d+\.\s/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-[11px] font-mono font-bold text-[#078BFF] mt-0.5 shrink-0">
                {num}.
              </span>
              <div>{renderInlineFormatting(content)}</div>
            </div>
          );
        }

        return <p key={idx}>{renderInlineFormatting(line)}</p>;
      })}
    </div>
  );
}

function renderInlineFormatting(str) {
  const parts = [];
  let remaining = str;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);

    let firstMatch = null;
    let type = null;

    if (boldMatch && codeMatch) {
      if (boldMatch.index < codeMatch.index) {
        firstMatch = boldMatch;
        type = 'bold';
      } else {
        firstMatch = codeMatch;
        type = 'code';
      }
    } else if (boldMatch) {
      firstMatch = boldMatch;
      type = 'bold';
    } else if (codeMatch) {
      firstMatch = codeMatch;
      type = 'code';
    }

    if (!firstMatch) {
      parts.push(<span key={keyIdx++}>{remaining}</span>);
      break;
    }

    if (firstMatch.index > 0) {
      parts.push(
        <span key={keyIdx++}>
          {remaining.substring(0, firstMatch.index)}
        </span>
      );
    }

    if (type === 'bold') {
      parts.push(
        <strong key={keyIdx++} className="font-semibold text-white">
          {firstMatch[1]}
        </strong>
      );
    } else if (type === 'code') {
      parts.push(
        <code
          key={keyIdx++}
          className="px-1.5 py-0.5 rounded bg-[#101214] border border-[#292D32] text-[#00CFFF] font-mono text-[11px]"
        >
          {firstMatch[1]}
        </code>
      );
    }

    remaining = remaining.substring(firstMatch.index + firstMatch[0].length);
  }

  return parts;
}

export const AiAssistantPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [currentTelemetry, setCurrentTelemetry] = useState(null);
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [loadingDiagnostic, setLoadingDiagnostic] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const loadStatusMeta = async () => {
    try {
      const [status, promptsData] = await Promise.all([
        aiService.getStatus().catch(() => null),
        aiService.getSuggestedPrompts().catch(() => ({ prompts: [] })),
      ]);
      setStatusInfo(status);
      setSuggestedPrompts(promptsData?.prompts || []);

      const isLive = status?.is_configured;
      const providerLabel = isLive
        ? (status?.provider === 'gemini' ? 'Google Gemini 3.5 Flash' : 'OpenAI')
        : 'Rule Engine v3.0';

      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `### TRACE GUARD AI Security Advisor Online\n\nWelcome! I am your real-time cybersecurity intelligence assistant, currently powered by **${providerLabel}**.\n\nI analyze your authentic attack surface telemetry, verified breach history, and browser permissions directly from your database.\n\nSelect a suggested prompt below or enter any security question to begin.`,
          provider: status?.provider || 'rule_engine',
          model: status?.model || 'traceguard-rules-v3.0',
          created_at: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err) {
      console.error('Failed to initialize AI assistant meta:', err);
    }
  };

  useEffect(() => {
    loadStatusMeta();
  }, []);

  const handleOpenDiagnostic = async () => {
    setShowDiagnosticModal(true);
    setLoadingDiagnostic(true);
    try {
      const data = await aiService.getDiagnostic();
      setDiagnosticData(data);
    } catch (err) {
      console.error('Failed to load AI diagnostic:', err);
    } finally {
      setLoadingDiagnostic(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      created_at: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await aiService.sendMessage(query, historyPayload);

      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.response,
        provider: res.provider,
        model: res.model,
        is_live_ai: res.is_live_ai,
        context_summary: res.context_summary,
        created_at: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      if (res.context_summary) {
        setCurrentTelemetry(res.context_summary);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `### Security Advisor Communication Error\n\nUnable to process query: ${
            err.message || 'Unknown network error'
          }. Please retry in a moment.`,
          provider: 'system',
          model: 'error',
          created_at: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content:
          "### Chat Session Reset\n\nYour conversation history has been cleared. How can I assist your privacy defense today?",
        provider: statusInfo?.provider || 'rule_engine',
        model: statusInfo?.model || 'traceguard-rules-v3.0',
        created_at: new Date().toLocaleTimeString(),
      },
    ]);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#14171A] border border-[#292D32] shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#078BFF]/20 to-[#00CFFF]/20 border border-[#078BFF]/40 flex items-center justify-center text-[#078BFF] shadow-[0_0_20px_rgba(7,139,255,0.25)]">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                AI Security Assistant
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#078BFF]/15 text-[#00CFFF] border border-[#078BFF]/30">
                Phase 4
              </span>
            </div>
            <p className="text-xs md:text-sm text-[#9CA3AF] mt-0.5">
              Real-time conversational cybersecurity intelligence interpreting your authentic database telemetry.
            </p>
          </div>
        </div>

        {/* Status Indicators & Actions */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#101214] border border-[#292D32] text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                statusInfo?.is_configured ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'
              } animate-pulse`}
            />
            <span className="text-[#9CA3AF]">PROVIDER:</span>
            <span className="text-white font-semibold">
              {statusInfo?.is_configured
                ? statusInfo?.provider === 'gemini'
                  ? 'Google Gemini'
                  : 'OpenAI'
                : 'Rule Engine'}
            </span>
            <span className="text-[#00CFFF]">
              ({statusInfo?.model || 'traceguard-rules-v3.0'})
            </span>
          </div>

          <button
            onClick={handleOpenDiagnostic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#101214] hover:bg-[#1E2227] border border-[#292D32] text-xs font-semibold text-[#00CFFF] hover:text-white transition-colors cursor-pointer"
            title="Inspect AI Connection Diagnostics"
          >
            <Activity className="w-3.5 h-3.5 text-[#00CFFF]" />
            <span>Diagnostics</span>
          </button>

          <button
            onClick={handleClearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#101214] hover:bg-[#1E2227] border border-[#292D32] text-xs font-semibold text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* DIAGNOSTIC MODAL */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#14171A] border border-[#292D32] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#292D32] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#078BFF]/20 border border-[#078BFF]/40 flex items-center justify-center text-[#078BFF]">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">AI Provider Connection Diagnostic</h3>
                  <p className="text-[11px] text-[#9CA3AF]">Zero-knowledge connection & telemetry verification</p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#1E2227] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDiagnostic ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[#9CA3AF]">
                <RefreshCw className="w-5 h-5 animate-spin text-[#078BFF]" />
                <span>Pinging AI provider & measuring roundtrip latency...</span>
              </div>
            ) : diagnosticData ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-[#101214] border border-[#292D32] flex items-center justify-between">
                  <span className="text-[#9CA3AF]">Connection Status:</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                      diagnosticData.connection_status === 'CONNECTED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {diagnosticData.connection_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="p-2.5 rounded-lg bg-[#101214] border border-[#292D32]">
                    <div className="text-[#9CA3AF] text-[10px]">ACTIVE PROVIDER</div>
                    <div className="font-bold text-white uppercase">{diagnosticData.provider}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#101214] border border-[#292D32]">
                    <div className="text-[#9CA3AF] text-[10px]">MODEL</div>
                    <div className="font-bold text-[#00CFFF]">{diagnosticData.model}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#101214] border border-[#292D32]">
                    <div className="text-[#9CA3AF] text-[10px]">API KEY STATUS</div>
                    <div className="font-bold text-white">
                      {diagnosticData.key_present ? `Detected (${diagnosticData.key_masked})` : 'Missing'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#101214] border border-[#292D32]">
                    <div className="text-[#9CA3AF] text-[10px]">API LATENCY</div>
                    <div className="font-bold text-[#22C55E]">
                      {diagnosticData.connection_latency_ms
                        ? `${diagnosticData.connection_latency_ms} ms`
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#101214] border border-[#292D32]">
                    <div className="text-[#9CA3AF] text-[10px]">SDK INTEGRATION</div>
                    <div className="font-bold text-white">{diagnosticData.sdk_version || 'httpx'}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#101214] border border-[#292D32]">
                    <div className="text-[#9CA3AF] text-[10px]">OPERATIONAL MODE</div>
                    <div className="font-bold text-[#00CFFF]">{diagnosticData.operational_mode}</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#101214] border border-[#292D32] text-[11px] text-[#9CA3AF] flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#078BFF] shrink-0 mt-0.5" />
                  <p>{diagnosticData.connection_message}</p>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-[#9CA3AF]">
                Diagnostic failed to load.
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-[#292D32]">
              <button
                onClick={handleOpenDiagnostic}
                disabled={loadingDiagnostic}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#101214] hover:bg-[#1E2227] border border-[#292D32] text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    loadingDiagnostic ? 'animate-spin text-[#078BFF]' : ''
                  }`}
                />
                <span>Re-test Connection</span>
              </button>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#078BFF] hover:bg-[#0576DB] text-white text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. REAL-TIME TELEMETRY STRIP (Dynamic DB Grounding) */}
      {currentTelemetry && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-xl bg-[#101214] border border-[#292D32]/80 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[#078BFF]" />
            <div>
              <div className="text-[10px] text-[#9CA3AF]">RISK SCORE</div>
              <div className="font-bold text-white">
                {currentTelemetry.risk_score !== null
                  ? `${currentTelemetry.risk_score} (${currentTelemetry.grade})`
                  : 'Insufficient Data'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
            <div>
              <div className="text-[10px] text-[#9CA3AF]">COVERAGE</div>
              <div className="font-bold text-white">
                {currentTelemetry.coverage_percentage}%
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <div>
              <div className="text-[10px] text-[#9CA3AF]">VERIFIED BREACHES</div>
              <div className="font-bold text-white">
                {currentTelemetry.verified_breaches_count}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
            <div>
              <div className="text-[10px] text-[#9CA3AF]">HIGH-RISK PERMS</div>
              <div className="font-bold text-white">
                {currentTelemetry.high_risk_permissions_count}
              </div>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#A855F7]" />
            <div>
              <div className="text-[10px] text-[#9CA3AF]">PENDING RECS</div>
              <div className="font-bold text-white">
                {currentTelemetry.pending_recommendations_count}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SUGGESTED INQUIRIES (Dynamic Chips) */}
      {suggestedPrompts.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#9CA3AF]">
            <Sparkles className="w-3.5 h-3.5 text-[#078BFF]" />
            <span>Suggested Security Inquiries</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedPrompts.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSendMessage(p.prompt)}
                disabled={loading}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#14171A] hover:bg-[#1C2025] border border-[#292D32] hover:border-[#078BFF]/50 text-xs text-[#D1D5DB] hover:text-white transition-all text-left cursor-pointer"
              >
                <span className="font-medium">{p.title}</span>
                <ArrowRight className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#00CFFF] transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. CHAT LOG WINDOW */}
      <div className="h-[480px] md:h-[540px] flex flex-col rounded-2xl bg-[#0D0F11] border border-[#292D32] overflow-hidden shadow-2xl">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex items-start gap-3 ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold border ${
                    isUser
                      ? 'bg-[#078BFF]/20 border-[#078BFF]/40 text-[#078BFF]'
                      : 'bg-[#14171A] border-[#292D32] text-[#00CFFF]'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3.5 shadow-md ${
                    isUser
                      ? 'bg-[#12263F] border border-[#078BFF]/40 text-white rounded-tr-none'
                      : 'bg-[#14171A] border border-[#292D32] rounded-tl-none'
                  }`}
                >
                  {/* Assistant Header Badge */}
                  {!isUser && (
                    <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-[#292D32]/60 text-[10px] font-mono text-[#9CA3AF]">
                      <span className="flex items-center gap-1.5">
                        <Cpu className="w-3 h-3 text-[#078BFF]" />
                        <span className="font-semibold text-white">TRACE GUARD AI</span>
                        {m.model && (
                          <span className="text-[#00CFFF]">({m.model})</span>
                        )}
                      </span>
                      <span>{m.created_at}</span>
                    </div>
                  )}

                  {/* Body Text */}
                  {isUser ? (
                    <p className="text-xs md:text-sm text-white whitespace-pre-wrap leading-relaxed">
                      {m.content}
                    </p>
                  ) : (
                    renderFormattedMessage(m.content)
                  )}

                  {/* User Timestamp */}
                  {isUser && (
                    <div className="text-right text-[10px] font-mono text-[#9CA3AF]/70 pt-1.5">
                      {m.created_at}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Thinking / Typing Pulse */}
          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#14171A] border border-[#292D32] flex items-center justify-center text-[#00CFFF] shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-2xl rounded-tl-none bg-[#14171A] border border-[#292D32] px-4 py-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#078BFF] animate-bounce" />
                <span
                  className="w-2 h-2 rounded-full bg-[#00CFFF] animate-bounce"
                  style={{ animationDelay: '0.15s' }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-[#22C55E] animate-bounce"
                  style={{ animationDelay: '0.3s' }}
                />
                <span className="text-xs font-mono text-[#9CA3AF] pl-2">
                  Correlating telemetry & computing defense strategy...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 5. INPUT FORM */}
        <div className="p-3 md:p-4 bg-[#101214] border-t border-[#292D32]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask TRACE GUARD AI about your risk score, breaches, permissions..."
              disabled={loading}
              className="flex-1 bg-[#14171A] border border-[#292D32] focus:border-[#078BFF] focus:ring-1 focus:ring-[#078BFF] rounded-xl px-4 py-2.5 text-xs md:text-sm text-white placeholder-[#9CA3AF]/60 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#078BFF] to-[#00CFFF] hover:from-[#0576DB] hover:to-[#00B5E2] disabled:opacity-50 text-white font-semibold text-xs md:text-sm flex items-center gap-1.5 shadow-[0_0_15px_rgba(7,139,255,0.3)] transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* 6. DISCLAIMER NOTICE */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#101214] border border-[#292D32] text-xs text-[#9CA3AF]">
        <Info className="w-4 h-4 text-[#078BFF] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-white">Defensive Privacy Notice:</strong> TRACE GUARD AI provides automated advisory guidance based strictly on your database telemetry. For active credential attacks, financial fraud, or enterprise breach incidents, immediate credential rotation and certified incident response assistance is recommended.
        </p>
      </div>
    </div>
  );
};

export default AiAssistantPage;
