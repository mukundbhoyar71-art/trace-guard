import api from './api';

export const securityService = {
  /**
   * Fetches dynamic recommendations based on scans, checks, and permissions.
   */
  async getRecommendations() {
    const res = await api.get('/security/recommendations');
    return res.data;
  },

  /**
   * Toggles recommendation status (pending | completed | dismissed).
   */
  async updateRecommendationStatus(recId, status) {
    const res = await api.patch(`/security/recommendations/${recId}`, { status });
    return res.data;
  },

  /**
   * Calculates the current 0-100 real-data-driven Privacy Risk Score and factor breakdown.
   */
  async getRiskScore() {
    const res = await api.get('/security/risk-score');
    return res.data;
  },

  /**
   * Fetches score history snapshots.
   */
  async getRiskHistory(limit = 10) {
    const res = await api.get(`/security/risk-history?limit=${limit}`);
    return res.data;
  },

  /**
   * Fetches paginated security activity timeline.
   */
  async getActivities(page = 1, pageSize = 15, activityType = null) {
    let url = `/security/activities?page=${page}&page_size=${pageSize}`;
    if (activityType) {
      url += `&activity_type=${encodeURIComponent(activityType)}`;
    }
    const res = await api.get(url);
    return res.data;
  },

  /**
   * Logs zero-knowledge password k-anonymity check outcome (without password or hash prefix).
   */
  async recordPasswordCheckAudit(payload) {
    const res = await api.post('/security/password-checks', payload);
    return res.data;
  },
};

export default securityService;

