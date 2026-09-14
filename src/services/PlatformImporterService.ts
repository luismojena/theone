import type { MappingEntry } from "../core/domain.js";
import type { IAnimePlatform } from "../core/interfaces.js";
import { isError } from "../core/typeGuards.js";
import type { FileMappingRepository } from "../repositories/FileMappingRepository.js";
import { cleanBaseTitle } from "../utils.js";

export class PlatformImporterService {
	constructor(
		private repository: FileMappingRepository,
		private platform: IAnimePlatform,
	) {}

	/**
	 * Scans the repository for unique MAL items that are NOT mapped to the target platform,
	 * searches the target platform for a match, and saves the mapping.
	 */
	async mapMissingEntries(): Promise<number> {
		const allMappings = this.repository.loadMappings();
		const platformName = this.platform.platformName;

		const toMap = this.extractUnmappedMalItems(allMappings, platformName);
		console.log(`Found ${toMap.length} unmapped MAL entries for platform '${platformName}'.`);

		return await this.searchAndMapMissingEntries(toMap, platformName);
	}

	public extractUnmappedMalItems(
		allMappings: Record<string, MappingEntry>,
		platformName: string,
	): [number | string, { title: string; status: string; episodes: number }][] {
		const malItems = new Map<
			number | string,
			{ title: string; status: string; episodes: number }
		>();
		const mappedToPlatform = new Set<number | string>();

		for (const key of Object.keys(allMappings)) {
			const entry = allMappings[key] as MappingEntry;

			if (!entry.mal_id) continue;

			if (entry.platform === platformName) {
				mappedToPlatform.add(entry.mal_id);
			} else {
				if (!malItems.has(entry.mal_id)) {
					malItems.set(entry.mal_id, {
						title: entry.mal_title || "",
						status: entry.mal_status || entry.last_synced_status || "Plan to Watch",
						episodes: entry.last_synced_episodes || 0,
					});
				}
			}
		}

		return Array.from(malItems.entries()).filter(([malId]) => !mappedToPlatform.has(malId));
	}

	private async searchAndMapMissingEntries(
		toMap: [number | string, { title: string; status: string; episodes: number }][],
		platformName: string,
	): Promise<number> {
		let mappedCount = 0;

		for (const [malId, data] of toMap) {
			const searchTitle = cleanBaseTitle(data.title);
			console.log(`\nSearching for: "${searchTitle}" (MAL ID: ${malId})`);

			try {
				const results = await this.platform.searchAnime(searchTitle);
				if (results.length > 0) {
					const bestMatch = results[0];
					console.log(`✅ Found match: "${bestMatch.title}" (ID: ${bestMatch.platform_id})`);

					this.repository.setMapping(platformName, bestMatch.platform_id, malId, data.title, {
						title: bestMatch.title,
						mal_status: data.status,
						last_synced_episodes: 0,
						last_synced_status: "Plan to Watch",
					});
					mappedCount++;
				} else {
					console.log(`❌ No results found on ${platformName}.`);
				}
			} catch (err: unknown) {
				console.error(
					`⚠️ Search failed for "${searchTitle}":`,
					isError(err) ? err.message : String(err),
				);
			}
		}

		return mappedCount;
	}
}
