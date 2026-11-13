/**
 * TRACE GUARD - Client-Side K-Anonymity Pwned Passwords Verification Service
 *
 * Official Documentation: https://haveibeenpwned.com/API/v3#PwnedPasswords
 *
 * PRIVACY GUARANTEES:
 * 1. The full password NEVER leaves the browser memory.
 * 2. SHA-1 is computed purely locally using the browser's native Web Crypto API.
 * 3. Only the first 5 hexadecimal characters of the SHA-1 digest (the prefix) are sent to the API.
 * 4. The API returns ~500-1000 anonymous hash suffixes matching that 5-char prefix.
 * 5. The suffix comparison is executed entirely in local browser memory.
 * 6. The plain password is never transmitted, never stored, and never logged.
 */

export const passwordService = {
  /**
   * Computes the SHA-1 hash of a string using the native Web Crypto API.
   * Returns an uppercase 40-character hexadecimal string.
   */
  async computeSha1(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const cryptoApi = typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;
    const hashBuffer = await cryptoApi.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  },

  /**
   * Evaluates password strength and entropy locally in the browser.
   */
  calculateEntropy(password) {
    if (!password) return { bits: 0, label: 'Empty', color: '#9CA3AF' };

    let poolSize = 0;
    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/[0-9]/.test(password)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) poolSize += 33;

    if (poolSize === 0) poolSize = 1;

    // Shannon entropy: L * log2(R)
    const bits = Math.round(password.length * Math.log2(poolSize));

    let label = 'Very Weak';
    let color = '#EF4444';
    if (bits >= 80) {
      label = 'Very Strong';
      color = '#22C55E';
    } else if (bits >= 60) {
      label = 'Strong';
      color = '#00CFFF';
    } else if (bits >= 40) {
      label = 'Moderate';
      color = '#F59E0B';
    } else if (bits >= 25) {
      label = 'Weak';
      color = '#F97316';
    }

    return { bits, label, color, length: password.length };
  },

  /**
   * Checks whether a password appears in Have I Been Pwned's 850M+ breached password database
   * using the k-Anonymity privacy model.
   *
   * @param {string} password - The candidate password (computed and cleared immediately)
   * @returns {Promise<{
   *   breached: boolean,
   *   count: number,
   *   prefix: string,
   *   suffixMatchesChecked: number,
   *   checkedAt: string
   * }>}
   */
  async checkPasswordBreach(password) {
    if (!password) {
      throw new Error('Please enter a password to evaluate.');
    }

    // 1. Compute SHA-1 locally in browser memory
    const fullHash = await this.computeSha1(password);

    // 2. Split into 5-char prefix and 35-char suffix
    const prefix = fullHash.substring(0, 5);
    const suffix = fullHash.substring(5);

    // 3. Query the official HIBP range endpoint
    // Add-Padding: true is set to prevent response length side-channel analysis
    const url = `https://api.pwnedpasswords.com/range/${prefix}`;

    let responseText = '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second timeout

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Add-Padding': 'true',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Pwned Passwords API returned HTTP ${response.status}. Please check network connectivity.`
        );
      }

      responseText = await response.text();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Pwned Passwords verification timed out. Please check your internet connection.');
      }
      throw new Error(
        err.message || 'Unable to connect to the Pwned Passwords range endpoint.'
      );
    }

    // 4. Compare suffixes locally in memory
    // Format of returned text: lines of "HASH_SUFFIX:FREQUENCY_COUNT\r\n"
    const lines = responseText.split('\n');
    let breachCount = 0;
    let candidatesCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      candidatesCount++;

      const [lineSuffix, countStr] = line.split(':');
      if (lineSuffix && lineSuffix.toUpperCase() === suffix) {
        const parsed = parseInt(countStr, 10);
        breachCount = isNaN(parsed) ? 1 : parsed;
        break;
      }
    }

    return {
      breached: breachCount > 0,
      count: breachCount,
      prefix,
      suffixMatchesChecked: candidatesCount,
      checkedAt: new Date().toISOString(),
    };
  },
};

export default passwordService;
