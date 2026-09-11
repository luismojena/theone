import fs from 'fs';
import path from 'path';

/**
 * Repository handling persistent storage of Platform ID to MAL ID mappings.
 */
export class FileMappingRepository {
  /**
   * @param {string} filePath - Absolute path to the JSON mapping database.
   */
  constructor(filePath) {
    this.filePath = filePath;
    this.ensureDirectory();
  }

  ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * @returns {Object} All mappings dictionary
   */
  loadMappings() {
    if (fs.existsSync(this.filePath)) {
      try {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      } catch (err) {
        console.error('Error reading mappings database:', err);
      }
    }
    return {};
  }

  /**
   * @param {Object} mappings 
   */
  saveMappings(mappings) {
    fs.writeFileSync(this.filePath, JSON.stringify(mappings, null, 2), 'utf8');
  }

  /**
   * Retrieves a mapping by its composite platform and slug key.
   * @param {string} platform 
   * @param {string} platformId 
   * @returns {Object|null}
   */
  getMapping(platform, platformId) {
    const mappings = this.loadMappings();
    const key = `${platform}:${platformId}`;
    return mappings[key] || null;
  }

  /**
   * Retrieves a mapping by canonical MyAnimeList ID.
   * @param {number} malId 
   * @returns {Object|null}
   */
  getMappingByMalId(malId) {
    const mappings = this.loadMappings();
    for (const key in mappings) {
      if (mappings[key].mal_id === Number(malId)) {
        return mappings[key];
      }
    }
    return null;
  }

  /**
   * Saves or updates a mapping entry.
   * @param {string} platform 
   * @param {string} platformId 
   * @param {number} malId 
   * @param {string} malTitle 
   * @param {Object} extraData - Additional platform-specific status details
   * @returns {Object} The saved mapping
   */
  setMapping(platform, platformId, malId, malTitle, extraData = {}) {
    const mappings = this.loadMappings();
    const key = `${platform}:${platformId}`;
    
    mappings[key] = {
      ...(mappings[key] || {}),
      platform,
      platform_id: platformId,
      mal_id: malId,
      mal_title: malTitle,
      ...extraData,
      updated_at: new Date().toISOString()
    };
    
    this.saveMappings(mappings);
    return mappings[key];
  }
}
