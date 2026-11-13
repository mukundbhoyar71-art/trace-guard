import api from './api';

export const scanService = {
  /**
   * Fetches scanner status and provider configuration state.
   */
  async getScannerStatus() {
    const res = await api.get('/scans/status');
    return res.data;
  },

  /**
   * Starts an authenticated Personal Data Exposure scan for the given email.
   * @param {string} email - The target email address
   * @param {boolean} isDemo - Whether to run in demo simulation mode
   */
  async startScan(email, isDemo = false) {
    const res = await api.post('/scans', { email, is_demo: isDemo });
    return res.data;
  },

  /**
   * Fetches the user's paginated scan history with optional search/status/date filters.
   * @param {number} page
   * @param {number} pageSize
   * @param {boolean|null} isDemo - Filter by demo (true), live (false), or all (null)
   * @param {object} filters - Optional { search, status, dateFrom, dateTo, scanType }
   */
  async getScanHistory(page = 1, pageSize = 10, isDemo = null, filters = {}) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (isDemo !== null && isDemo !== undefined) {
      params.set('is_demo', String(isDemo));
    }
    if (filters?.scanType) {
      params.set('scan_type', filters.scanType);
    }
    if (filters?.status && filters.status !== 'all') {
      params.set('status', filters.status);
    }
    if (filters?.search && filters.search.trim()) {
      params.set('search', filters.search.trim());
    }
    if (filters?.dateFrom) {
      params.set('date_from', filters.dateFrom);
    }
    if (filters?.dateTo) {
      params.set('date_to', filters.dateTo);
    }
    const res = await api.get(`/scans?${params.toString()}`);
    return res.data;
  },

  /**
   * Fetches full details for a single scan.
   */
  async getScanDetails(scanId) {
    const res = await api.get(`/scans/${scanId}`);
    return res.data;
  },

  /**
   * Fetches confirmed breach findings for a scan.
   */
  async getScanFindings(scanId) {
    const res = await api.get(`/scans/${scanId}/findings`);
    return res.data;
  },

  /**
   * Fetches unified multi-category scan history across all 6 security categories.
   * @param {number} page
   * @param {number} pageSize
   * @param {string} scope - 'live' | 'demo' | 'all'
   * @param {object} filters - { category, severity, status, search, dateFrom, dateTo }
   */
  async getUnifiedHistory(page = 1, pageSize = 10, scope = 'live', filters = {}) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    params.set('scope', scope || 'live');

    if (filters?.category && filters.category !== 'all') {
      params.set('category', filters.category);
    }
    if (filters?.severity && filters.severity !== 'all') {
      params.set('severity', filters.severity);
    }
    if (filters?.status && filters.status !== 'all') {
      params.set('status', filters.status);
    }
    if (filters?.search && filters.search.trim()) {
      params.set('search', filters.search.trim());
    }
    if (filters?.dateFrom) {
      params.set('date_from', filters.dateFrom);
    }
    if (filters?.dateTo) {
      params.set('date_to', filters.dateTo);
    }

    const res = await api.get(`/scans/unified?${params.toString()}`);
    return res.data;
  },

  /**
   * Fetches complete normalized dossier details for a specific unified scan record.
   */
  async getUnifiedDetail(category, recordId) {
    const res = await api.get(
      `/scans/unified/${encodeURIComponent(category)}/${encodeURIComponent(recordId)}`
    );
    return res.data;
  },
};

export default scanService;
