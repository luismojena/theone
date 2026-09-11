import { IAnimePlatform } from '../core/IAnimePlatform.js';
import { FileMappingRepository } from '../repositories/FileMappingRepository.js';
import { cleanBaseTitle } from '../utils.js';

export class PlatformImporterService {
  constructor(
    private repository: FileMappingRepository,
    private platform: IAnimePlatform
  ) {}

  /**
   * Scans the repository for unique MAL items that are NOT mapped to the target platform,
   * searches the target platform for a match, and saves the mapping.
   */
  async mapMissingEntries(): Promise<number> {
    const allMappings = this.repository.loadMappings();
    const platformName = this.platform.platformName;

    // 1. Extract all unique MAL items
    const malItems = new Map<number | string, { title: string; status: string; episodes: number }>();
    const mappedToPlatform = new Set<number | string>();

    for (const key of Object.keys(allMappings)) {
      const entry = allMappings[key];
      if (!entry.mal_id) continue;

      if (entry.platform === platformName) {
        mappedToPlatform.add(entry.mal_id);
      } else {
        if (!malItems.has(entry.mal_id)) {
          malItems.set(entry.mal_id, {
            title: entry.mal_title,
            status: entry.mal_status || entry.last_synced_status || 'Plan to Watch',
            episodes: entry.last_synced_episodes || 0
          });
        }
      }
    }

    // 2. Find entries that need mapping
    const toMap = Array.from(malItems.entries()).filter(([malId]) => !mappedToPlatform.has(malId));
    let mappedCount = 0;

    console.log(`Found ${toMap.length} unmapped MAL entries for platform '${platformName}'.`);

    // 3. Search and map
    for (const [malId, data] of toMap) {
      const searchTitle = cleanBaseTitle(data.title);
      console.log(`\nSearching for: "${searchTitle}" (MAL ID: ${malId})`);
      
      try {
        const results = await this.platform.searchAnime(searchTitle);
        if (results.length > 0) {
          // Auto-pick the first result for this headless importer
          const bestMatch = results[0];
          console.log(`✅ Found match: "${bestMatch.title}" (ID: ${bestMatch.platform_id})`);
          
          this.repository.setMapping(platformName, bestMatch.platform_id, malId, data.title, {
            title: bestMatch.title,
            mal_status: data.status, // Copy the known status
            last_synced_episodes: 0, // 0 means it will be pushed on next sync
            last_synced_status: 'Plan to Watch' // Default dummy state so diff engine detects a change
          });
          mappedCount++;
        } else {
          console.log(`❌ No results found on ${platformName}.`);
        }
      } catch (err: any) {
        console.error(`⚠️ Search failed for "${searchTitle}":`, err.message);
      }
    }

    return mappedCount;
  }
}
