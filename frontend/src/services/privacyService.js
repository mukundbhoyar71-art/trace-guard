import api from './api';

export const privacyService = {
  /**
   * Fetches app permissions overview, checklist status, and reviews.
   */
  async getOverview() {
    const res = await api.get('/privacy/permissions');
    return res.data;
  },

  /**
   * Records a manual app permission review.
   */
  async createReview(payload) {
    const res = await api.post('/privacy/permissions', payload);
    return res.data;
  },

  /**
   * Updates an existing review.
   */
  async updateReview(id, payload) {
    const res = await api.patch(`/privacy/permissions/${id}`, payload);
    return res.data;
  },

  /**
   * Deletes a review.
   */
  async deleteReview(id) {
    const res = await api.delete(`/privacy/permissions/${id}`);
    return res.data;
  },

  /**
   * Saves a real browser permission audit snapshot to the backend.
   */
  async saveBrowserAudit(payload) {
    const res = await api.post('/privacy/browser-audit', payload);
    return res.data;
  },

  /**
   * Gets the latest browser permission audit snapshot.
   */
  async getBrowserAudit() {
    const res = await api.get('/privacy/browser-audit');
    return res.data;
  },
};

export default privacyService;

