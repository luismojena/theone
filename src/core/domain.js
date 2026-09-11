/**
 * Standardized Watch Statuses across all platforms
 * @readonly
 * @enum {string}
 */
export const WatchStatus = {
  WATCHING: 'Watching',
  COMPLETED: 'Completed',
  ON_HOLD: 'On-Hold',
  DROPPED: 'Dropped',
  PLAN_TO_WATCH: 'Plan to Watch'
};

/**
 * Represents a Canonical Anime Entity (MyAnimeList anchor)
 */
export class Anime {
  /**
   * @param {number} malId - Canonical MyAnimeList ID
   * @param {string} title - Canonical Title
   */
  constructor(malId, title) {
    this.malId = malId;
    this.title = title;
  }
}

/**
 * Represents a user's progress for a specific Anime
 */
export class WatchlistEntry {
  /**
   * @param {string} platform - The source platform (e.g., 'jkanime', 'animeflv')
   * @param {string} platformId - The unique ID or slug on the source platform
   * @param {string} title - The title as it appears on the platform
   * @param {string} status - Standardized WatchStatus
   * @param {number} episodesWatched - Number of episodes watched
   * @param {number|null} [malId=null] - Resolved MyAnimeList ID (if mapped)
   */
  constructor(platform, platformId, title, status, episodesWatched, malId = null) {
    this.platform = platform;
    this.platformId = platformId;
    this.title = title;
    this.status = status;
    this.episodesWatched = episodesWatched;
    this.malId = malId;
  }
}
