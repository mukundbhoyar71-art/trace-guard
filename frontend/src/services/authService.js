import api from './api';

export const authService = {
  async getMe() {
    const res = await api.get('/auth/me');
    return res.data;
  },

  async getSessions() {
    const res = await api.get('/auth/sessions');
    return res.data;
  },

  async logoutAll() {
    const res = await api.post('/auth/logout-all');
    return res.data;
  },

  async requestPasswordReset(email) {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },
};

export default authService;

