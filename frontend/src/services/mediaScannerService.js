import api from './api';

export const mediaScannerService = {
  /**
   * Stage 1: Uploads and scans user-selected image or audio file locally.
   * @param {File} file
   * @param {Function} onUploadProgress - optional progress callback
   */
  async scanMedia(file, onUploadProgress = null) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post('/media/scan-media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percentCompleted);
        }
      },
    });

    return res.data;
  },

  /**
   * Stage 2: Extracts complete EXIF, GPS geolocation, hardware, and audio ID3 metadata.
   * @param {File} file
   * @param {Function} onUploadProgress
   */
  async extractMetadata(file, onUploadProgress = null) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post('/media/metadata', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percentCompleted);
        }
      },
    });

    return res.data;
  },

  /**
   * Stage 2: Strips EXIF/GPS/metadata and initiates immediate download of sanitized copy.
   * @param {File} file
   */
  async downloadSanitizedFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post('/media/sanitize', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob',
    });

    // Extract filename from Content-Disposition header if available
    let filename = `sanitized_${file.name}`;
    const disposition = res.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    // Trigger browser download
    const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);

    return { filename, size: blob.size };
  },

  /**
   * Stage 3: Scans TXT, CSV, JSON, LOG, MD, or PDF documents for PII and secrets.
   * Employs Luhn checksum validation for credit cards and Mod-97 for IBANs.
   * @param {File} file
   * @param {Function} onUploadProgress
   */
  async scanDocument(file, onUploadProgress = null) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post('/media/scan-document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percentCompleted);
        }
      },
    });

    return res.data;
  },

  /**
   * Phase A: On-device AI image detection for a single image.
   * @param {File} file
   * @param {Function} onUploadProgress
   */
  async detectImage(file, onUploadProgress = null) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post('/media/detect-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percentCompleted);
        }
      },
    });

    return res.data;
  },

  /**
   * Phase A: On-device AI image detection for multiple images (batch).
   * @param {File[]|FileList} files
   * @param {Function} onUploadProgress
   */
  async detectImages(files, onUploadProgress = null) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    const res = await api.post('/media/detect-images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percentCompleted);
        }
      },
    });

    return res.data;
  },

  /**
   * Phase A: Retrieves local ONNX classifier availability and metadata.
   */
  async getModelStatus() {
    const res = await api.get('/media/model-status');
    return res.data;
  },
};

export default mediaScannerService;
