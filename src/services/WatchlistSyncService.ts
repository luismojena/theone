import type { WatchlistEntry } from "../core/domain.js";
import type { FileMappingRepository } from "../repositories/FileMappingRepository.js";

export class WatchlistSyncService {
	constructor(public mappingRepository: FileMappingRepository) {}

	computeIncrementalDiff(incomingEntries: WatchlistEntry[]) {
		const diff = {
			newEntries: [] as WatchlistEntry[],
			modifiedEntries: [] as {
				entry: WatchlistEntry;
				previous_episodes: number;
				previous_status: string;
				mal_id?: number;
				mal_title?: string;
			}[],
			unchangedEntries: [] as WatchlistEntry[],
		};

		for (const incoming of incomingEntries) {
			const mapping = this.mappingRepository.getMapping(incoming.platform, incoming.platformId);

			if (!mapping) {
				diff.newEntries.push(incoming);
			} else {
				const lastSyncedEps = mapping.last_synced_episodes || 0;
				const lastSyncedStatus = mapping.last_synced_status || mapping.mal_status;

				if (incoming.episodesWatched > lastSyncedEps || incoming.status !== lastSyncedStatus) {
					diff.modifiedEntries.push({
						entry: incoming,
						previous_episodes: lastSyncedEps,
						previous_status: lastSyncedStatus || "Watching",
						mal_id: mapping.mal_id,
						mal_title: mapping.mal_title,
					});
				} else {
					diff.unchangedEntries.push(incoming);
				}
			}
		}

		return diff;
	}
}
