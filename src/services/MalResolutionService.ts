import type { SearchResult } from "../core/domain.js";
import type { IAnimePlatform } from "../core/interfaces.js";

export class MalResolutionService {
	constructor(private malPlatform: IAnimePlatform) {}

	public async searchAnimeWithFallbacks(
		title: string,
		platformId?: string,
	): Promise<SearchResult[]> {
		let results = await this.malPlatform.searchAnime(title);

		// If MAL fails to find it because of exact punctuation matching (like colons),
		// strip special characters and retry.
		if (results.length === 0) {
			const strippedTitle = title
				.replace(/[^a-zA-Z0-9 ]/g, " ")
				.replace(/\s+/g, " ")
				.trim();
			if (strippedTitle !== title) {
				results = await this.malPlatform.searchAnime(strippedTitle);
			}

			// FINAL FALLBACK: If title is totally corrupted in the DB, use the formatted slug
			if (results.length === 0 && platformId) {
				const slugTitle = platformId.replace(/-/g, " ");
				results = await this.malPlatform.searchAnime(slugTitle);
			}
		}

		return results;
	}
}
