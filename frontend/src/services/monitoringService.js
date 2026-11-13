import api from './api';

export const monitoringService = {
  /**
   * Fetches monitoring overview, active reminder, and external checks.
   */
  async getOverview() {
    const res = await api.get('/monitoring');
    return res.data;
  },

  /**
   * Creates or replaces an active breach check reminder.
   */
  async createReminder(payload) {
    const res = await api.post('/monitoring/reminders', payload);
    return res.data;
  },

  /**
   * Updates an existing reminder.
   */
  async updateReminder(id, payload) {
    const res = await api.patch(`/monitoring/reminders/${id}`, payload);
    return res.data;
  },

  /**
   * Deletes an existing monitoring reminder.
   */
  async deleteReminder(id) {
    const res = await api.delete(`/monitoring/reminders/${id}`);
    return res.data;
  },

  /**
   * Records a user-confirmed manual check from Have I Been Pwned.
   */
  async recordExternalCheck(payload) {
    const res = await api.post('/monitoring/external-checks', payload);
    return res.data;
  },

  /**
   * Configures automated scheduled background monitoring (daily | weekly | monthly).
   */
  async updateConfig(payload) {
    const res = await api.put('/monitoring/config', payload);
    return res.data;
  },

  /**
   * Triggers an immediate execution of the user's automated monitoring check.
   */
  async runMonitoringNow() {
    const res = await api.post('/monitoring/run');
    return res.data;
  },

  /**
   * Fetches automated monitoring execution history logs.
   */
  async getExecutions(limit = 20) {
    const res = await api.get(`/monitoring/executions?limit=${limit}`);
    return res.data;
  },
};

export default monitoringService;

