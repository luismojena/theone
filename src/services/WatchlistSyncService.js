import { WatchlistEntry } from '../core/domain.js';

export class WatchlistSyncService {
  /**
   * @param {import('../repositories/FileMappingRepository.js').FileMappingRepository} mappingRepository 
   */
  constructor(mappingRepository) {
    this.mappingRepository = mappingRepository;
  }

  /**
   * Computes the incremental differences between an incoming list of WatchlistEntries and the stored mapping state.
   * @param {WatchlistEntry[]} incomingEntries 
   * @returns {Object} { newEntries, modifiedEntries, unchangedEntries }
   */
  computeIncrementalDiff(incomingEntries) {
    const diff = {
      newEntries: [],
      modifiedEntries: [],
      unchangedEntries: []
    };

    for (const incoming of incomingEntries) {
      const mapping = this.mappingRepository.getMapping(incoming.platform, incoming.platformId);

      if (!mapping) {
        diff.newEntries.push(incoming);
      } else {
        const lastEpisodes = mapping.last_synced_episodes || 0;
        const lastStatus = mapping.last_synced_status || 'Unknown';

        // Check for modifications
        if (lastEpisodes !== incoming.episodesWatched || lastStatus !== incoming.status) {
          incoming.malId = mapping.mal_id;
          diff.modifiedEntries.push({
            entry: incoming,
            previous_episodes: lastEpisodes,
            previous_status: lastStatus,
            mal_id: mapping.mal_id,
            mal_title: mapping.mal_title
          });
        } else {
          incoming.malId = mapping.mal_id;
          diff.unchangedEntries.push(incoming);
        }
      }
    }

    return diff;
  }
}
