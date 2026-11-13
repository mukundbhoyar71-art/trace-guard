/**
 * TRACE GUARD - Real Browser Permission Auditing Service
 * Inspects real browser security scopes using navigator.permissions, Notification,
 * MediaDevices, and Geolocation APIs.
 *
 * Strict Privacy Rules:
 * - Never uploads or stores camera/mic streams. Tracks are stopped immediately.
 * - Never saves or logs geographic coordinates.
 * - Never triggers permission prompts automatically on page load.
 * - Never produces random, simulated, or fake permission values.
 * - Allowed statuses: GRANTED, DENIED, PROMPT, UNSUPPORTED, ERROR.
 */

export const PERMISSION_STATUS = {
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  PROMPT: 'PROMPT',
  UNSUPPORTED: 'UNSUPPORTED',
  ERROR: 'ERROR',
};

export const PERMISSION_EXPLANATIONS = {
  camera: {
    title: 'Camera Access',
    description: 'Allows web applications to capture video streams and take photos through your device camera.',
    implication: 'Invasive visual access. When granted, rogue scripts or compromised extensions could capture your physical surroundings.',
    recommendation: 'Keep set to PROMPT or DENIED unless actively needed for video verification.',
  },
  microphone: {
    title: 'Microphone Hardware',
    description: 'Allows web applications to capture audio input through your device microphone.',
    implication: 'Ambient eavesdropping risk. Could enable unauthorized acoustic fingerprinting or voice recording.',
    recommendation: 'Restricted by default. Never leave granted on untrusted domains.',
  },
  location: {
    title: 'Precise Geolocation',
    description: 'Allows web applications to determine your physical GPS or Wi-Fi triangulation coordinates.',
    implication: 'Physical privacy and tracking risk. Correlates online identity with physical residence and real-time movement.',
    recommendation: 'Keep DENIED or require explicit prompt per visit.',
  },
  notifications: {
    title: 'System Notifications',
    description: 'Allows web applications to deliver native operating system banner alerts and push notifications.',
    implication: 'Can be abused for persistent spam, phishing redirects, or background wake-ups.',
    recommendation: 'Grant only to critical trusted services.',
  },
};

export const browserPermissionService = {
  /**
   * Identifies user's active browser and platform.
   */
  getBrowserDetails() {
    if (typeof navigator === 'undefined') {
      return { browser: 'Unknown', platform: 'Unknown', hasPermissionsAPI: false };
    }
    const ua = navigator.userAgent;
    let browser = 'Modern Browser';
    if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
    else if (ua.includes('Edg/')) browser = 'Microsoft Edge';
    else if (ua.includes('Chrome/')) browser = 'Google Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Apple Safari';
    else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera';

    const hasPermissionsAPI = 'permissions' in navigator && typeof navigator.permissions.query === 'function';

    return {
      browser,
      platform: navigator.platform || 'Unknown OS',
      userAgent: ua,
      hasPermissionsAPI,
      hasMediaDevices: typeof navigator.mediaDevices !== 'undefined' && typeof navigator.mediaDevices.getUserMedia === 'function',
      hasGeolocation: 'geolocation' in navigator,
      hasNotification: typeof window !== 'undefined' && 'Notification' in window,
    };
  },

  /**
   * Passively queries the current browser status for a single permission without triggering prompts.
   */
  async queryPermission(key) {
    const now = new Date();
    const explanation = PERMISSION_EXPLANATIONS[key] || {};

    // 1. NOTIFICATIONS
    if (key === 'notifications') {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        return {
          key: 'notifications',
          name: 'Notifications',
          status: PERMISSION_STATUS.UNSUPPORTED,
          supported: false,
          supportText: 'Notifications API not supported in this browser',
          lastChecked: now,
          explanation: explanation.description,
          permissionStatusObj: null,
        };
      }

      // Check via Notification.permission
      const perm = Notification.permission;
      const mapped =
        perm === 'granted'
          ? PERMISSION_STATUS.GRANTED
          : perm === 'denied'
          ? PERMISSION_STATUS.DENIED
          : PERMISSION_STATUS.PROMPT;

      let statusObj = null;
      if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        try {
          statusObj = await navigator.permissions.query({ name: 'notifications' });
        } catch (_) {
          // Some browsers do not support { name: 'notifications' } in query; fallback to Notification.permission
        }
      }

      return {
        key: 'notifications',
        name: 'Notifications',
        status: statusObj ? statusObj.state.toUpperCase() : mapped,
        supported: true,
        supportText: statusObj ? 'Permissions API + Notifications API' : 'Notifications API (Notification.permission)',
        lastChecked: now,
        explanation: explanation.description,
        permissionStatusObj: statusObj,
      };
    }

    // 2. LOCATION (GEOLOCATION)
    if (key === 'location') {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        return {
          key: 'location',
          name: 'Location',
          status: PERMISSION_STATUS.UNSUPPORTED,
          supported: false,
          supportText: 'Geolocation API not supported in this browser',
          lastChecked: now,
          explanation: explanation.description,
          permissionStatusObj: null,
        };
      }

      if ('permissions' in navigator && typeof navigator.permissions.query === 'function') {
        try {
          const statusObj = await navigator.permissions.query({ name: 'geolocation' });
          return {
            key: 'location',
            name: 'Location',
            status: statusObj.state.toUpperCase(),
            supported: true,
            supportText: 'Permissions API (navigator.permissions.query)',
            lastChecked: now,
            explanation: explanation.description,
            permissionStatusObj: statusObj,
          };
        } catch (err) {
          return {
            key: 'location',
            name: 'Location',
            status: PERMISSION_STATUS.UNSUPPORTED,
            supported: true,
            supportText: 'Geolocation supported for interactive test only',
            lastChecked: now,
            explanation: explanation.description,
            permissionStatusObj: null,
          };
        }
      }

      return {
        key: 'location',
        name: 'Location',
        status: PERMISSION_STATUS.UNSUPPORTED,
        supported: true,
        supportText: 'Permissions API query unavailable; Geolocation test supported',
        lastChecked: now,
        explanation: explanation.description,
        permissionStatusObj: null,
      };
    }

    // 3. CAMERA
    if (key === 'camera') {
      const hasMedia = typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';

      if (typeof navigator !== 'undefined' && 'permissions' in navigator && typeof navigator.permissions.query === 'function') {
        try {
          const statusObj = await navigator.permissions.query({ name: 'camera' });
          return {
            key: 'camera',
            name: 'Camera',
            status: statusObj.state.toUpperCase(),
            supported: true,
            supportText: 'Permissions API (navigator.permissions.query)',
            lastChecked: now,
            explanation: explanation.description,
            permissionStatusObj: statusObj,
          };
        } catch (err) {
          // Firefox and some browser versions throw on query({ name: 'camera' })
          return {
            key: 'camera',
            name: 'Camera',
            status: PERMISSION_STATUS.UNSUPPORTED,
            supported: hasMedia,
            supportText: hasMedia ? 'MediaDevices available for test; Permissions API query unsupported' : 'Unsupported in this browser',
            lastChecked: now,
            explanation: explanation.description,
            permissionStatusObj: null,
          };
        }
      }

      return {
        key: 'camera',
        name: 'Camera',
        status: PERMISSION_STATUS.UNSUPPORTED,
        supported: hasMedia,
        supportText: hasMedia ? 'MediaDevices available; Permissions API not available' : 'Unsupported in this browser',
        lastChecked: now,
        explanation: explanation.description,
        permissionStatusObj: null,
      };
    }

    // 4. MICROPHONE
    if (key === 'microphone') {
      const hasMedia = typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';

      if (typeof navigator !== 'undefined' && 'permissions' in navigator && typeof navigator.permissions.query === 'function') {
        try {
          const statusObj = await navigator.permissions.query({ name: 'microphone' });
          return {
            key: 'microphone',
            name: 'Microphone',
            status: statusObj.state.toUpperCase(),
            supported: true,
            supportText: 'Permissions API (navigator.permissions.query)',
            lastChecked: now,
            explanation: explanation.description,
            permissionStatusObj: statusObj,
          };
        } catch (err) {
          return {
            key: 'microphone',
            name: 'Microphone',
            status: PERMISSION_STATUS.UNSUPPORTED,
            supported: hasMedia,
            supportText: hasMedia ? 'MediaDevices available for test; Permissions API query unsupported' : 'Unsupported in this browser',
            lastChecked: now,
            explanation: explanation.description,
            permissionStatusObj: null,
          };
        }
      }

      return {
        key: 'microphone',
        name: 'Microphone',
        status: PERMISSION_STATUS.UNSUPPORTED,
        supported: hasMedia,
        supportText: hasMedia ? 'MediaDevices available; Permissions API not available' : 'Unsupported in this browser',
        lastChecked: now,
        explanation: explanation.description,
        permissionStatusObj: null,
      };
    }

    return {
      key,
      name: key,
      status: PERMISSION_STATUS.UNSUPPORTED,
      supported: false,
      supportText: 'Unknown permission key',
      lastChecked: now,
      explanation: '',
      permissionStatusObj: null,
    };
  },

  /**
   * Queries all 4 required permissions simultaneously without triggering user prompts.
   */
  async queryAllPermissions() {
    const keys = ['camera', 'microphone', 'location', 'notifications'];
    const results = await Promise.all(keys.map((k) => this.queryPermission(k)));
    const mapped = {};
    for (const r of results) {
      mapped[r.key] = r;
    }
    return mapped;
  },

  /**
   * User-controlled test: Request camera access, then immediately close media track.
   */
  async testCamera() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return {
        status: PERMISSION_STATUS.UNSUPPORTED,
        message: 'MediaDevices getUserMedia API is not supported in this browser or context.',
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Immediately stop all hardware tracks to guarantee zero recording/storage
      stream.getTracks().forEach((track) => track.stop());
      return {
        status: PERMISSION_STATUS.GRANTED,
        message: 'Camera permission is GRANTED. Hardware video stream was stopped immediately.',
      };
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return {
          status: PERMISSION_STATUS.DENIED,
          message: 'Camera permission was DENIED by user or blocked by browser security settings.',
        };
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        return {
          status: PERMISSION_STATUS.ERROR,
          message: 'No physical camera hardware detected on this device.',
        };
      }
      return {
        status: PERMISSION_STATUS.ERROR,
        message: `Camera verification error: ${err.message || err.name}`,
      };
    }
  },

  /**
   * User-controlled test: Request microphone access, then immediately close media track.
   */
  async testMicrophone() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return {
        status: PERMISSION_STATUS.UNSUPPORTED,
        message: 'MediaDevices getUserMedia API is not supported in this browser or context.',
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop all audio tracks
      stream.getTracks().forEach((track) => track.stop());
      return {
        status: PERMISSION_STATUS.GRANTED,
        message: 'Microphone permission is GRANTED. Hardware audio stream was stopped immediately.',
      };
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return {
          status: PERMISSION_STATUS.DENIED,
          message: 'Microphone permission was DENIED by user or blocked by browser security settings.',
        };
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        return {
          status: PERMISSION_STATUS.ERROR,
          message: 'No physical microphone hardware detected on this device.',
        };
      }
      return {
        status: PERMISSION_STATUS.ERROR,
        message: `Microphone verification error: ${err.message || err.name}`,
      };
    }
  },

  /**
   * User-controlled test: Check location permission. Coordinates are strictly discarded!
   */
  async testLocation() {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator) || typeof navigator.geolocation.getCurrentPosition !== 'function') {
      return {
        status: PERMISSION_STATUS.UNSUPPORTED,
        message: 'Geolocation API is not supported in this browser.',
      };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Zero-knowledge: position coordinates are never saved, read, or transmitted
          resolve({
            status: PERMISSION_STATUS.GRANTED,
            message: 'Location permission is GRANTED. Geographic coordinates were not saved or stored.',
          });
        },
        (error) => {
          if (error.code === 1 /* PERMISSION_DENIED */) {
            resolve({
              status: PERMISSION_STATUS.DENIED,
              message: 'Location permission was DENIED by user or blocked by browser settings.',
            });
          } else if (error.code === 2 /* POSITION_UNAVAILABLE */) {
            resolve({
              status: PERMISSION_STATUS.ERROR,
              message: 'Location determination unavailable (GPS/Network offline).',
            });
          } else if (error.code === 3 /* TIMEOUT */) {
            resolve({
              status: PERMISSION_STATUS.ERROR,
              message: 'Location check timed out.',
            });
          } else {
            resolve({
              status: PERMISSION_STATUS.ERROR,
              message: `Location check error: ${error.message}`,
            });
          }
        },
        { timeout: 8000, maximumAge: 0, enableHighAccuracy: false }
      );
    });
  },

  /**
   * User-controlled test: Request notification permission.
   */
  async testNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window) || typeof Notification.requestPermission !== 'function') {
      return {
        status: PERMISSION_STATUS.UNSUPPORTED,
        message: 'Notification API is not supported in this browser.',
      };
    }

    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        return {
          status: PERMISSION_STATUS.GRANTED,
          message: 'Notification permission is GRANTED by user.',
        };
      }
      if (res === 'denied') {
        return {
          status: PERMISSION_STATUS.DENIED,
          message: 'Notification permission was DENIED by user or browser policy.',
        };
      }
      return {
        status: PERMISSION_STATUS.PROMPT,
        message: 'Notification prompt was dismissed without granting.',
      };
    } catch (err) {
      return {
        status: PERMISSION_STATUS.ERROR,
        message: `Notification request error: ${err.message}`,
      };
    }
  },
};

export default browserPermissionService;

