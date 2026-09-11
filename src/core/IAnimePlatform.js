import { sleep } from '../utils.js';

/**
 * Interface contract for all Platform Adapters
 * Because JavaScript does not have strict interfaces, we define an abstract class
 * that throws errors if methods are not implemented.
 */
export class IAnimePlatform {
  /**
   * Helper method shared across all platforms to handle network failures, 502s, and timeouts gracefully.
   */
  async _fetchWithRetry(url, options = {}, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, options);

        if (res.ok) {
          return res;
        }

        console.warn(`[${this.platformName}] Attempt ${attempt}/${maxRetries} failed with status ${res.status} for ${url}`);
      } catch (err) {
        console.warn(`[${this.platformName}] Attempt ${attempt}/${maxRetries} network error: ${err.message}`);
      }

      if (attempt < maxRetries) {
        await sleep(2000 * attempt);
      }
    }

    console.error(`\nWe have tried ${maxRetries} times to reach ${url}.`);
    console.error(`The website might be down. Please check visiting here: ${url}\n`);
    throw new Error('WEBSITE_DOWN');
  }
  /**
   * Returns the canonical name of the platform (e.g., 'jkanime', 'animeflv', 'mal')
   * @returns {string}
   */
  get platformName() {
    throw new Error('Not implemented: platformName');
  }

  /**
   * Authenticates the user with the platform.
   * @param {Object} credentials 
   * @returns {Promise<void>}
   */
  async authenticate(credentials) {
    throw new Error('Not implemented: authenticate');
  }

  /**
   * Fetches the user's complete watchlist from the platform.
   * @returns {Promise<import('./domain.js').WatchlistEntry[]>}
   */
  async fetchWatchlist() {
    throw new Error('Not implemented: fetchWatchlist');
  }

  /**
   * Updates the progress/status of an entry on the platform.
   * @param {import('./domain.js').WatchlistEntry} entry 
   * @returns {Promise<void>}
   */
  async updateEntryStatus(entry) {
    throw new Error('Not implemented: updateEntryStatus');
  }

  /**
   * Searches for an anime on the platform by title.
   * @param {string} query 
   * @returns {Promise<Object[]>}
   */
  async searchAnime(query) {
    throw new Error('Not implemented: searchAnime');
  }
}
