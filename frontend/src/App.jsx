import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicRoute } from './components/auth/PublicRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Public Landing Page
import { LandingPage } from './pages/LandingPage';

// Main Dashboard Page
import { DashboardPage } from './pages/DashboardPage';

// Main Navigation Pages
import { AttackSurfacePage } from './pages/AttackSurfacePage';
import { BreachScannerPage } from './pages/BreachScannerPage';
import { BreachMonitoringPage } from './pages/BreachMonitoringPage';
import { PasswordSecurityPage } from './pages/PasswordSecurityPage';
import { PermissionAuditorPage } from './pages/PermissionAuditorPage';
import { DigitalFootprintPage } from './pages/DigitalFootprintPage';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { SecurityAlertsPage } from './pages/SecurityAlertsPage';
import { ReportsPage } from './pages/ReportsPage';
import { HistoryPage } from './pages/HistoryPage';
import { ScanHistoryPage } from './pages/ScanHistoryPage';
import { ScanDetailPage } from './pages/ScanDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SupportPage } from './pages/SupportPage';
import { MediaScannerPage } from './pages/MediaScannerPage';
import { MediaLeakCheckPage } from './pages/MediaLeakCheckPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

// Authentication Pages
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Public Auth Routes (Redirect to /dashboard if active session exists) */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Email Verification Page (accessible with or without prior session) */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Protected Cybersecurity Dashboard & Subsystems */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Main Navigation Modules */}
              <Route path="/data-exposure" element={<BreachScannerPage />} />
              <Route path="/scan-history" element={<ScanHistoryPage />} />
              <Route path="/scan-history/:category/:scanId" element={<ScanDetailPage />} />
              <Route path="/scan-history/:scanId" element={<ScanDetailPage />} />
              <Route path="/breach-monitoring" element={<BreachMonitoringPage />} />
              <Route path="/monitoring" element={<BreachMonitoringPage />} />
              <Route path="/password-security" element={<PasswordSecurityPage />} />
              <Route path="/app-permissions" element={<PermissionAuditorPage />} />
              <Route path="/media-scanner" element={<MediaScannerPage />} />
              <Route path="/dashboard/media-leak-check" element={<MediaLeakCheckPage />} />
              <Route path="/risk-score" element={<AttackSurfacePage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/recommendations" element={<SecurityAlertsPage />} />
              <Route path="/reports" element={<ReportsPage />} />

              {/* Bottom Navigation */}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              {/* Module Aliases for Deep Links */}
              <Route path="/attack-surface" element={<AttackSurfacePage />} />
              <Route path="/breach-scanner" element={<BreachScannerPage />} />
              <Route path="/file-privacy" element={<MediaScannerPage />} />
              <Route path="/media-privacy" element={<MediaScannerPage />} />
              <Route path="/media-leak-check" element={<MediaLeakCheckPage />} />
              <Route path="/permission-auditor" element={<PermissionAuditorPage />} />
              <Route path="/digital-footprint" element={<DigitalFootprintPage />} />
              <Route path="/ai-assistant" element={<AiAssistantPage />} />
              <Route path="/security-analytics" element={<AnalyticsPage />} />
              <Route path="/security-alerts" element={<SecurityAlertsPage />} />
              <Route path="/history" element={<ScanHistoryPage />} />
              <Route path="/activity" element={<HistoryPage />} />
              <Route path="/activity-history" element={<HistoryPage />} />
            </Route>
          </Route>

          {/* Fallback to Landing Page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
