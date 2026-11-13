import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Database,
  KeyRound,
  Smartphone,
  Fingerprint,
  Bot,
  Lock,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Menu,
  X,
  Gauge,
  Sparkles,
  Search,
  Eye,
  Activity,
  Layers,
  FileCheck,
} from 'lucide-react';
import { TraceGuardLogo } from '../components/common/TraceGuardLogo';

export const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white selection:bg-[#078BFF] selection:text-white font-sans cyber-grid-pattern overflow-x-hidden">
      {/* 1. TOP STICKY NAVIGATION BAR */}
      <header className="h-20 border-b border-[#292D32] bg-[#101214]/90 backdrop-blur-md sticky top-0 z-50 px-6 lg:px-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <TraceGuardLogo variant="full" size="md" showTagline={true} />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-[#9CA3AF]">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="hover:text-white transition-colors"
          >
            Home
          </button>
          <button
            onClick={() => scrollToSection('features')}
            className="hover:text-white transition-colors"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="hover:text-white transition-colors"
          >
            How It Works
          </button>
          <button
            onClick={() => scrollToSection('why-traceguard')}
            className="hover:text-white transition-colors"
          >
            About
          </button>
        </nav>

        {/* Right Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 text-xs font-bold text-[#9CA3AF] hover:text-white transition-colors"
          >
            Login
          </button>
          <button
            onClick={() => navigate('/register')}
            className="px-4 py-2.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-[0_0_15px_rgba(7,139,255,0.35)] border border-[#078BFF]/40 transition-all flex items-center gap-1.5"
          >
            <span>Get Started</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile Menu Hamburger Toggle */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-[#151719] border border-[#292D32] text-[#9CA3AF] hover:text-white"
            title="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-20 bg-[#101214] border-b border-[#292D32] z-40 p-6 space-y-4 md:hidden shadow-2xl animate-in slide-in-from-top-3 duration-200">
          <div className="space-y-3 text-sm font-semibold text-[#9CA3AF]">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="block w-full text-left py-1 hover:text-white"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-left py-1 hover:text-white"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left py-1 hover:text-white"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('why-traceguard')}
              className="block w-full text-left py-1 hover:text-white"
            >
              About Trace Guard
            </button>
          </div>
          <div className="pt-4 border-t border-[#292D32] flex flex-col gap-2.5">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/login');
              }}
              className="w-full py-2.5 rounded-xl bg-[#151719] text-[#9CA3AF] hover:text-white border border-[#292D32] text-xs font-bold"
            >
              Login
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/register');
              }}
              className="w-full py-2.5 rounded-xl bg-[#078BFF] text-white text-xs font-bold shadow-lg shadow-[#078BFF]/30"
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* 2. HERO SECTION */}
      <section className="relative pt-16 sm:pt-24 pb-24 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headlines & CTA */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#101214] border border-[#078BFF]/30 text-[#00CFFF] text-[11px] font-mono font-semibold shadow-[0_0_15px_-3px_rgba(7,139,255,0.2)]">
              <span className="w-2 h-2 rounded-full bg-[#00CFFF] animate-ping"></span>
              <span>AI-POWERED PERSONAL DATA FOOTPRINT AUDITOR</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.05]">
              YOUR DIGITAL LIFE.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#078BFF] via-[#00CFFF] to-[#8B5CF6]">
                YOUR CONTROL.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-[#9CA3AF] max-w-2xl leading-relaxed">
              Take control of your digital footprint with TRACE GUARD. Discover exposed personal information, monitor known data breaches and strengthen your online privacy with intelligent security insights.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-[0_0_25px_-3px_rgba(7,139,255,0.45)] border border-[#078BFF]/50 transition-all flex items-center justify-center gap-2"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => scrollToSection('features')}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#151719] hover:bg-[#1B1E22] text-[#9CA3AF] hover:text-white text-xs font-bold border border-[#292D32] transition-all flex items-center justify-center gap-2"
              >
                <span>Explore Features</span>
              </button>
            </div>

            {/* Quick Trust Badges */}
            <div className="pt-6 border-t border-[#292D32]/70 grid grid-cols-3 gap-3 text-center sm:text-left">
              <div>
                <div className="text-sm font-bold text-white font-mono">Zero Plaintext</div>
                <div className="text-[10px] text-[#9CA3AF]">Passkeys & Hashes Only</div>
              </div>
              <div>
                <div className="text-sm font-bold text-[#00CFFF] font-mono">700+ Breaches</div>
                <div className="text-[10px] text-[#9CA3AF]">Verified Registry Sync</div>
              </div>
              <div>
                <div className="text-sm font-bold text-[#22C55E] font-mono">Transparent</div>
                <div className="text-[10px] text-[#9CA3AF]">Zero Fabricated Data</div>
              </div>
            </div>
          </div>

          {/* Right Column: Futuristic Cybersecurity Visual */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            {/* Ambient Background Glow */}
            <div className="absolute w-72 h-72 bg-[#078BFF]/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute w-60 h-60 bg-[#8B5CF6]/15 rounded-full blur-3xl pointer-events-none"></div>

            {/* Main Cyber Graphic Container */}
            <div className="relative w-full max-w-md p-6 rounded-3xl bg-[#101214]/80 border border-[#292D32] shadow-2xl backdrop-blur-md">
              {/* Circuit Scan Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#292D32] text-[10px] font-mono text-[#9CA3AF]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#EF4444]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#22C55E]"></div>
                  <span className="ml-1 text-white">SYSTEM TELEMETRY</span>
                </div>
                <span className="text-[#00CFFF]">ACTIVE SENSING</span>
              </div>

              {/* Large Shield-and-Fingerprint SVG Icon Center */}
              <div className="py-8 flex flex-col items-center justify-center relative">
                <TraceGuardLogo variant="icon" size="lg" className="w-32 h-32" />

                <div className="mt-4 text-center">
                  <div className="text-xs font-mono font-bold text-white tracking-widest uppercase">
                    TRACE GUARD VAULT
                  </div>
                  <div className="text-[10px] font-mono text-[#00CFFF]">
                    Continuous Cryptographic Defense
                  </div>
                </div>
              </div>

              {/* Floating Security Information Cards */}
              <div className="space-y-2.5 pt-2">
                <div className="p-3 rounded-xl bg-[#151719] border border-[#292D32] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
                    <div>
                      <div className="text-xs font-bold text-white">Identity Shield Active</div>
                      <div className="text-[10px] text-[#9CA3AF]">Multi-vector posture tracking</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30">
                    PROTECTED
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#151719] border border-[#292D32] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-[#078BFF]" />
                    <div>
                      <div className="text-xs font-bold text-white">K-Anonymity Verified</div>
                      <div className="text-[10px] text-[#9CA3AF]">Zero plaintext secrets stored</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#078BFF]/15 text-[#00CFFF] border border-[#078BFF]/30">
                    SHA-1 PREFIX
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SECURITY PREVIEW SECTION */}
      <section className="py-16 px-6 lg:px-12 max-w-7xl mx-auto border-t border-[#292D32]">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="text-xs font-mono font-bold text-[#078BFF] uppercase tracking-wider mb-2">
            Live Interface Architecture
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Security Intelligence Dashboard Preview
          </h2>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Experience an integrated executive overview of breach incidents, credential integrity, and attack surface scores.
          </p>
        </div>

        {/* Dashboard Preview Card Container */}
        <div className="cyber-card p-6 lg:p-8 rounded-3xl border border-[#292D32] relative overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#292D32]">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#078BFF]"></span>
              <span className="text-xs font-bold font-mono text-white tracking-wider uppercase">
                EXECUTIVE DASHBOARD MONITOR
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#101214] text-[#F59E0B] border border-[#F59E0B]/30">
              DEMO DATA PREVIEW
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32]">
              <div className="flex items-center justify-between mb-2">
                <Database className="w-4 h-4 text-[#22C55E]" />
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30">
                  DEMO DATA
                </span>
              </div>
              <div className="text-2xl font-black text-white">0</div>
              <div className="text-xs font-bold text-white mt-0.5">Breaches Found</div>
              <div className="text-[10px] text-[#9CA3AF] mt-1">Zero leaks detected across 700+ registers</div>
            </div>

            <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32]">
              <div className="flex items-center justify-between mb-2">
                <Fingerprint className="w-4 h-4 text-[#078BFF]" />
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#078BFF]/15 text-[#00CFFF] border border-[#078BFF]/30">
                  DEMO DATA
                </span>
              </div>
              <div className="text-2xl font-black text-white">1</div>
              <div className="text-xs font-bold text-white mt-0.5">Exposed Data</div>
              <div className="text-[10px] text-[#9CA3AF] mt-1">Public usernames identified in open OSINT</div>
            </div>

            <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32]">
              <div className="flex items-center justify-between mb-2">
                <KeyRound className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30">
                  DEMO DATA
                </span>
              </div>
              <div className="text-2xl font-black text-white">96 Bits</div>
              <div className="text-xs font-bold text-white mt-0.5">Password Security</div>
              <div className="text-[10px] text-[#9CA3AF] mt-1">Strong client-side entropy verification</div>
            </div>

            <div className="p-4 rounded-xl bg-[#101214] border border-[#292D32]">
              <div className="flex items-center justify-between mb-2">
                <Gauge className="w-4 h-4 text-[#078BFF]" />
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#078BFF]/15 text-[#00CFFF] border border-[#078BFF]/30">
                  DEMO DATA
                </span>
              </div>
              <div className="text-2xl font-black text-white">28 / 100</div>
              <div className="text-xs font-bold text-white mt-0.5">Privacy Risk Score</div>
              <div className="text-[10px] text-[#9CA3AF] mt-1">Controlled exposure profile (Grade A-)</div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#292D32] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-[#9CA3AF]">
              All preview values reflect representative sample metrics. No user data was harvested to generate this preview.
            </span>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-xl bg-[#1B1E22] hover:bg-[#202428] text-white text-xs font-bold border border-[#292D32] hover:border-[#078BFF]/40 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <span>Explore Live Dashboard</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#078BFF]" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. FEATURES SECTION (6 Cards) */}
      <section id="features" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-t border-[#292D32]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-xs font-mono font-bold text-[#078BFF] uppercase tracking-wider mb-2">
            Defense Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Six Intelligent Layers of Digital Identity Protection
          </h2>
          <p className="text-xs sm:text-sm text-[#9CA3AF] mt-2">
            Engineered around verifiable threat registries, zero-knowledge cryptographic safeguards, and contextual analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between group">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#078BFF]/10 border border-[#078BFF]/30 text-[#078BFF] flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                <Fingerprint className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">1. Personal Data Exposure</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Scan and catalog public visibility across personal emails, phone numbers, and username reuse with automatic PII masking.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#292D32] text-[10px] font-mono text-[#00CFFF]">
              Automated PII Masking
            </div>
          </div>

          {/* Feature 2 */}
          <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between group">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">2. Breach Monitoring</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Verify whether your email credentials appear in known global commercial, dark-web, and corporate breach incident corpora.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#292D32] text-[10px] font-mono text-[#EF4444]">
              700+ Verified Repositories
            </div>
          </div>

          {/* Feature 3 */}
          <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between group">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-[#8B5CF6] flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">3. Password Security</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Zero-knowledge k-anonymity protocol: passwords are never sent to our servers. Only the first 5 characters of your SHA-1 hash are queried.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#292D32] text-[10px] font-mono text-[#8B5CF6]">
              Zero Plaintext Exposure
            </div>
          </div>

          {/* Feature 4 */}
          <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between group">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">4. App Permission Auditing</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Review mobile hardware telemetry scopes (camera, microphone, background GPS, contacts) to detect invasive data harvesting.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#292D32] text-[10px] font-mono text-[#F59E0B]">
              User Scope Audit Model
            </div>
          </div>

          {/* Feature 5 */}
          <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between group">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#00CFFF]/10 border border-[#00CFFF]/30 text-[#00CFFF] flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                <Gauge className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">5. Privacy Risk Assessment</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                A transparent, weighted 0 to 100 risk scoring index that mathematically evaluates your overall digital exposure surface.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#292D32] text-[10px] font-mono text-[#00CFFF]">
              Weighted Mathematical Matrix
            </div>
          </div>

          {/* Feature 6 */}
          <div className="cyber-card p-6 rounded-2xl flex flex-col justify-between group">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">6. AI Security Assistant</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Contextual cybersecurity guidance designed to clarify threats, interpret CVEs, and generate prioritized remediation steps.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#292D32] text-[10px] font-mono text-[#22C55E]">
              Contextual Remediation
            </div>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS (3 Steps Timeline) */}
      <section id="how-it-works" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-t border-[#292D32]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-xs font-mono font-bold text-[#078BFF] uppercase tracking-wider mb-2">
            Execution Workflow
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            How Trace Guard Audits Your Footprint
          </h2>
          <p className="text-xs sm:text-sm text-[#9CA3AF] mt-2">
            Three straightforward phases designed to identify, assess, and mitigate digital exposure.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          <div className="cyber-card p-6 rounded-2xl relative">
            <span className="text-3xl font-black font-mono text-[#078BFF]/30">01</span>
            <h3 className="text-base font-bold text-white mt-3 mb-2">
              Connect or Provide Identifiers
            </h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Input the email address, username, or application permissions you wish to evaluate. Sensitive identifiers are masked immediately.
            </p>
          </div>

          <div className="cyber-card p-6 rounded-2xl relative">
            <span className="text-3xl font-black font-mono text-[#00CFFF]/30">02</span>
            <h3 className="text-base font-bold text-white mt-3 mb-2">
              Analyze Exposure & Security Data
            </h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Verify against verified global breach registries and calculate password entropy via zero-knowledge k-anonymity prefix comparison.
            </p>
          </div>

          <div className="cyber-card p-6 rounded-2xl relative">
            <span className="text-3xl font-black font-mono text-[#8B5CF6]/30">03</span>
            <h3 className="text-base font-bold text-white mt-3 mb-2">
              Review Risks & Follow Recommendations
            </h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Examine your transparent 0–100 privacy risk score, follow prioritized remediation actions, and export formal PDF audit dossiers.
            </p>
          </div>
        </div>
      </section>

      {/* 6. WHY TRACE GUARD (4 Pillars) */}
      <section id="why-traceguard" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-t border-[#292D32]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-xs font-mono font-bold text-[#078BFF] uppercase tracking-wider mb-2">
            Core Philosophy
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Why Individuals Rely on Trace Guard
          </h2>
          <p className="text-xs sm:text-sm text-[#9CA3AF] mt-2">
            Built strictly on privacy-first design, objective telemetry, and actionable remediation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-[#101214] border border-[#292D32]">
            <Lock className="w-6 h-6 text-[#078BFF] mb-3" />
            <h3 className="text-sm font-bold text-white mb-1.5">Privacy-Focused Analysis</h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Client-side cryptographic hashing ensures sensitive passwords and private tokens are never transmitted in plaintext.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#101214] border border-[#292D32]">
            <Activity className="w-6 h-6 text-[#00CFFF] mb-3" />
            <h3 className="text-sm font-bold text-white mb-1.5">Clear Security Insights</h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Complex CVE vulnerability data and hardware scopes are translated into intuitive, readable metrics.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#101214] border border-[#292D32]">
            <FileCheck className="w-6 h-6 text-[#22C55E] mb-3" />
            <h3 className="text-sm font-bold text-white mb-1.5">Transparent Findings</h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Zero fabricated alarms or synthetic risk inflation. If an item cannot be confirmed, it is marked as unverified.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#101214] border border-[#292D32]">
            <CheckCircle2 className="w-6 h-6 text-[#8B5CF6] mb-3" />
            <h3 className="text-sm font-bold text-white mb-1.5">Actionable Guidance</h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Concrete remediation checklists: revoke unnecessary app scopes, rotate weak credentials, and shrink your footprint.
            </p>
          </div>
        </div>
      </section>

      {/* 7. CALL TO ACTION (CTA) */}
      <section className="py-20 px-6 lg:px-12 border-t border-[#292D32] text-center relative overflow-hidden bg-[#101214]">
        <div className="max-w-3xl mx-auto relative z-10 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#078BFF]/10 border border-[#078BFF]/30 flex items-center justify-center mx-auto mb-4 text-[#078BFF] shadow-lg shadow-[#078BFF]/20">
            <Shield className="w-7 h-7" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            TAKE CONTROL OF YOUR DIGITAL FOOTPRINT.
          </h2>

          <p className="text-xs sm:text-sm text-[#9CA3AF] max-w-xl mx-auto leading-relaxed">
            Start understanding your online exposure and make smarter privacy decisions.
          </p>

          <div className="pt-4 flex justify-center">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-3.5 rounded-xl bg-[#078BFF] hover:bg-[#0077E6] text-white text-xs font-bold shadow-[0_0_25px_-3px_rgba(7,139,255,0.45)] border border-[#078BFF]/50 transition-all flex items-center gap-2"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="py-12 px-6 lg:px-12 bg-[#0E1012] border-t border-[#292D32] text-xs text-[#9CA3AF]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <TraceGuardLogo variant="compact" size="sm" showTagline={false} />
            <div className="h-4 w-px bg-[#292D32] hidden sm:block"></div>
            <span className="font-mono text-[10px] text-[#9CA3AF]">
              YOUR DIGITAL LIFE. YOUR CONTROL.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[11px]">
            <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">
              Features
            </button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors">
              How It Works
            </button>
            <Link to="/dashboard" className="text-[#078BFF] hover:underline font-semibold">
              Live Dashboard
            </Link>
            <a href="#why-traceguard" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#why-traceguard" className="hover:text-white transition-colors">
              Terms of Service
            </a>
            <a href="mailto:security@traceguard.io" className="hover:text-white transition-colors">
              Contact: security@traceguard.io
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-[#292D32]/60 text-center text-[10px] text-[#9CA3AF]/60 font-mono">
          © 2026 TRACE GUARD. All rights reserved. Built with cryptographic privacy-first protocols.
        </div>
      </footer>
    </div>
  );
};
