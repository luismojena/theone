export class WatchlistSyncService {
    mappingRepository;
    constructor(mappingRepository) {
        this.mappingRepository = mappingRepository;
    }
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
            }
            else {
                const lastSyncedEps = mapping.last_synced_episodes || 0;
                const lastSyncedStatus = mapping.last_synced_status || mapping.mal_status;
                if (incoming.episodesWatched > lastSyncedEps || incoming.status !== lastSyncedStatus) {
                    diff.modifiedEntries.push({
                        entry: incoming,
                        previous_episodes: lastSyncedEps,
                        previous_status: lastSyncedStatus,
                        mal_id: mapping.mal_id,
                        mal_title: mapping.mal_title
                    });
                }
                else {
                    diff.unchangedEntries.push(incoming);
                }
            }
        }
        return diff;
    }
}
