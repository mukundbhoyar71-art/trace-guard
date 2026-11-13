import api from './api';

export const aiService = {
  getStatus: async () => {
    const res = await api.get('/ai/status');
    return res.data;
  },

  getSuggestedPrompts: async () => {
    const res = await api.get('/ai/suggested-prompts');
    return res.data;
  },

  getDiagnostic: async () => {
    const res = await api.get('/ai/diagnostic');
    return res.data;
  },

  sendMessage: async (message, history = []) => {
    const res = await api.post('/ai/chat', { message, history });
    return res.data;
  },
};

export default aiService;

