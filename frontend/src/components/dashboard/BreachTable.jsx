import React, { useState } from 'react';
import { Database, Search, ShieldCheck, ShieldAlert, ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export const BreachTable = ({ realFindings, hasScanned, scannedEmail, isDemoScan }) => {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');

  // If real findings were passed or scan status is known
  const isRealData = hasScanned !== undefined;
  const breachesList = realFindings || [];

  const filteredBreaches = breachesList.filter((b) => {
    const title = b.title || b.breach_name || '';
    const domain = b.domain || '';
    const classes = (b.data_classes || []).join(' ');

    const matchesSearch =
      title.toLowerCase().includes(search.toLowerCase()) ||
      domain.toLowerCase().includes(search.toLowerCase()) ||
      classes.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity =
      severityFilter === 'All' ||
      (b.severity && b.severity.toLowerCase() === severityFilter.toLowerCase());

    return matchesSearch && matchesSeverity;
  });

  const getSeverityBadge = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'critical':
        return 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30';
      case 'high':
        return 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30';
      case 'medium':
      case 'moderate':
        return 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30';
      default:
        return 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30';
    }
  };

  return (
    <div className="cyber-card p-6 rounded-2xl bg-[#151719] border border-[#292D32]">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                !hasScanned ? 'bg-[#9CA3AF]' : breachesList.length > 0 ? 'bg-[#EF4444]' : 'bg-[#22C55E]'
              }`}
            />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Breach Monitoring Register
            </h2>
            {isDemoScan ? (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border bg-purple-500/20 text-purple-300 border-purple-500/40">
                DEMO DATA
              </span>
            ) : isRealData ? (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border bg-[#078BFF]/10 text-[#00CFFF] border-[#078BFF]/30">
                LIVE TELEMETRY
              </span>
            ) : (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border bg-[#101214] text-[#9CA3AF] border-[#292D32]">
                DEMO RECORDS
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
            Confirmed incident corpora evaluated against global breach repositories.
          </p>
        </div>

        {/* If scanned and has breaches, show search/filter */}
        {hasScanned && breachesList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter breaches..."
                className="bg-[#101214] text-xs text-white placeholder-[#9CA3AF]/60 pl-8.5 pr-3 py-1.5 rounded-lg border border-[#292D32] focus:outline-none focus:border-[#078BFF] transition-all w-40 sm:w-48"
              />
            </div>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-[#101214] text-xs text-[#9CA3AF] px-2.5 py-1.5 rounded-lg border border-[#292D32] focus:outline-none focus:border-[#078BFF]"
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        )}
      </div>

      {/* State 1: User has never scanned */}
      {hasScanned === false && (
        <div className="p-8 rounded-xl bg-[#101214] border border-[#292D32] text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#078BFF]/15 text-[#00CFFF] border border-[#078BFF]/30 flex items-center justify-center mx-auto">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">No exposure scan performed yet.</h3>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Run your first Personal Data Exposure audit to query genuine breach intelligence.
            </p>
          </div>
          <Link
            to="/breach-scanner"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/25 border border-[#078BFF]/40 transition-all"
          >
            <span>Run Exposure Audit</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* State 2: User scanned, 0 breaches found */}
      {hasScanned === true && breachesList.length === 0 && (
        <div className="p-6 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">
            No known breaches found for this email in the connected data source.
          </h3>
          <p className="text-xs text-[#9CA3AF] max-w-lg mx-auto leading-relaxed">
            Target <span className="text-white font-mono">{scannedEmail || 'account'}</span> did not appear in known publicly indexed breach registries.
          </p>
          <div className="text-[11px] text-[#9CA3AF]/80 italic pt-1">
            * Note: This indicates absence from known compromised datasets; it does not claim the email is completely safe.
          </div>
        </div>
      )}

      {/* State 3: User scanned, breaches found */}
      {hasScanned === true && breachesList.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[#292D32] bg-[#101214]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#292D32] bg-[#151719] text-[#9CA3AF] font-mono text-[10px] uppercase">
                <th className="py-3 px-4">Breach Source</th>
                <th className="py-3 px-4">Breach Date</th>
                <th className="py-3 px-4">Exposed Data Categories</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#292D32]/60">
              {filteredBreaches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#9CA3AF]">
                    No matching breach incidents found for current filters.
                  </td>
                </tr>
              ) : (
                filteredBreaches.map((b) => (
                  <tr key={b.id} className="hover:bg-[#181B1E] transition-colors">
                    <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-[#078BFF] shrink-0" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>{b.title || b.breach_name}</span>
                          {(isDemoScan || b.is_fabricated) && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              DEMO
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#9CA3AF] font-mono">{b.domain || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#9CA3AF]">{b.breach_date || 'N/A'}</td>
                    <td className="py-3 px-4 text-[#9CA3AF] max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {(b.data_classes || []).map((c, i) => (
                          <span
                            key={i}
                            className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono ${
                              c.toLowerCase().includes('password')
                                ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
                                : 'bg-[#101214] text-[#9CA3AF] border border-[#292D32]'
                            }`}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border uppercase ${getSeverityBadge(
                          b.severity
                        )}`}
                      >
                        {b.severity || 'Medium'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to="/breach-scanner"
                        className="text-[11px] font-bold text-[#00CFFF] hover:underline inline-flex items-center gap-1"
                      >
                        <span>Audit</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* External HIBP verification link notice */}
      <div className="mt-4 pt-3 border-t border-[#292D32] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#9CA3AF]">
        <span className="text-[11px]">
          Want an independent check on the web? Verify your email directly on Have I Been Pwned.
        </span>
        <a
          href="https://haveibeenpwned.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-[#078BFF] hover:text-[#00CFFF] flex items-center gap-1 transition-colors whitespace-nowrap"
        >
          <span>Check Email on HIBP</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
