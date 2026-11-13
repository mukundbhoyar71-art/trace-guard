import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Check active session on startup via HTTP-only cookie
  const checkAuth = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await api.get('/auth/me');
      if (response.data) {
        setUser(response.data);
      } else {
        setUser(null);
      }
    } catch {
      // Not authenticated or session expired
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password, rememberMe = true) => {
    setAuthError(null);
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
        remember_me: rememberMe,
      });
      if (response.data?.user) {
        setUser(response.data.user);
      }
      return { success: true, user: response.data.user, message: response.data.message };
    } catch (err) {
      const message = err.message || 'Login failed';
      setAuthError(message);
      return {
        success: false,
        error: message,
        isUnverified: message.toLowerCase().includes('not been verified'),
      };
    }
  };

  const register = async ({ fullName, email, password, confirmPassword, termsAccepted }) => {
    setAuthError(null);
    try {
      const response = await api.post('/auth/register', {
        full_name: fullName,
        email,
        password,
        confirm_password: confirmPassword,
        terms_accepted: termsAccepted,
      });
      return {
        success: true,
        user: response.data.user,
        message: response.data.message,
        emailDelivered: response.data.email_delivered,
        deliveryNotice: response.data.delivery_notice,
      };
    } catch (err) {
      const message = err.message || 'Registration failed';
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  const verifyEmail = async (token) => {
    try {
      const response = await api.post('/auth/verify-email', { token });
      if (response.data?.user) {
        setUser(response.data.user);
      }
      return { success: true, user: response.data.user, message: response.data.message };
    } catch (err) {
      return { success: false, error: err.message || 'Email verification failed.' };
    }
  };

  const resendVerification = async (email) => {
    try {
      const response = await api.post('/auth/resend-verification', { email });
      return {
        success: true,
        message: response.data.message,
        emailDelivered: response.data.email_delivered,
        deliveryNotice: response.data.delivery_notice,
      };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to resend verification email.' };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return { success: true, message: response.data.message };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to request password reset.' };
    }
  };

  const resetPassword = async ({ token, newPassword, confirmPassword }) => {
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      return { success: true, message: response.data.message };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to update password.' };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      setUser(null);
    }
  };

  const enterDemoMode = () => {
    setUser({
      id: 999,
      full_name: 'Alex Vance (Demo)',
      email: 'alex.vance@traceguard.io',
      auth_provider: 'demo',
      is_email_verified: true,
      created_at: new Date().toISOString(),
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        authError,
        checkAuth,
        login,
        register,
        verifyEmail,
        resendVerification,
        forgotPassword,
        resetPassword,
        logout,
        enterDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
