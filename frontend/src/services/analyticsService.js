import api from './api';

export const analyticsService = {
  getOverview: async () => {
    const res = await api.get('/analytics/overview');
    return res.data;
  },

  getRiskTrends: async () => {
    const res = await api.get('/analytics/risk-trends');
    return res.data;
  },

  getExposureAnalytics: async () => {
    const res = await api.get('/analytics/exposure');
    return res.data;
  },

  getPermissionsAnalytics: async () => {
    const res = await api.get('/analytics/permissions');
    return res.data;
  },

  getRecommendationsAnalytics: async () => {
    const res = await api.get('/analytics/recommendations');
    return res.data;
  },

  getActivityAnalytics: async () => {
    const res = await api.get('/analytics/activity');
    return res.data;
  },
};

export default analyticsService;

