import api from './api';

export const reportService = {
  /**
   * Generates a new security audit report (PDF).
   */
  async generateReport(payload = {}) {
    const res = await api.post('/reports', payload);
    return res.data;
  },

  /**
   * Lists generated security reports.
   */
  async listReports(reportType = null) {
    const url = reportType ? `/reports?report_type=${encodeURIComponent(reportType)}` : '/reports';
    const res = await api.get(url);
    return res.data;
  },

  /**
   * Fetches metadata for a single report.
   */
  async getReportDetails(reportId) {
    const res = await api.get(`/reports/${reportId}`);
    return res.data;
  },

  /**
   * Downloads a generated PDF report directly to the client.
   */
  async downloadReport(reportId, filename = 'TRACE_GUARD_Report.pdf') {
    const res = await api.get(`/reports/${reportId}/download`, {
      responseType: 'blob',
    });

    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default reportService;

