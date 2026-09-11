import fs from 'fs';
import path from 'path';

/**
 * Repository handling persistent storage of Platform ID to MAL ID mappings.
 */
export class FileMappingRepository {
  /**
   * @param {string} filePath - Absolute path to the JSON mapping database.
   */
  constructor(public filePath: string) {}

  loadMappings(): Record<string, any> {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (fs.existsSync(this.filePath)) {
      try {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      } catch (err) {
        console.warn(`Could not parse ${this.filePath}, starting fresh.`, err);
      }
    }
    return {};
  }

  saveMappings(mappings: Record<string, any>) {
    fs.writeFileSync(this.filePath, JSON.stringify(mappings, null, 2), 'utf8');
  }

  /**
   * Get an existing mapping by platform slug and ID
   */
  getMapping(platform: string, platformId: string) {
    const mappings = this.loadMappings();
    const key = `${platform}:${platformId}`;
    return mappings[key];
  }

  /**
   * Lookup mapping backwards by MAL ID
   */
  getMappingByMalId(malId: number | string) {
    const mappings = this.loadMappings();
    for (const val of Object.values(mappings)) {
      if (val.mal_id && Number(val.mal_id) === Number(malId)) {
        return val;
      }
    }
    return null;
  }

  setMapping(platform: string, platformId: string, malId: number | string, malTitle: string, extraData: any = {}) {
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
