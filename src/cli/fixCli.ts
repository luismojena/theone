import { PlatformFactory } from "../platforms/PlatformFactory.js";
import { MALPlatform } from "../platforms/MALPlatform.js";
import { FileMappingRepository } from "../repositories/FileMappingRepository.js";

export async function runFixEntry(platformName: string, platformId: string) {
	console.log(`--- Surgical Fix: ${platformName} -> ${platformId} ---`);

	const repo = new FileMappingRepository("./migrations/mappings.json");
	const existing = repo.getMapping(platformName, platformId);

	if (!existing) {
		console.error(`❌ Entry '${platformName}:${platformId}' does not exist in mappings.json`);
		return;
	}

	let newTitle = existing.title;
	let newMalTitle = existing.mal_title;
	const changes: string[] = [];

	// 1. Fetch Platform Data
	try {
		console.log(`Fetching live data from ${platformName} for '${platformId}'...`);
		const platform = PlatformFactory.getPlatform(platformName);
		const details = await platform.fetchAnimeDetails(platformId);

		if (details && details.title !== existing.title) {
			changes.push(`Title: "${existing.title}" -> "${details.title}"`);
			newTitle = details.title;
		} else if (details) {
			console.log(`Platform title is already perfectly correct: "${details.title}"`);
		} else {
			console.warn(`⚠️ Could not find a valid title on ${platformName}.`);
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`❌ Failed to scrape ${platformName}:`, msg);
	}

	// 2. Fetch MAL Data
	const malId = Number(existing.mal_id);
	if (malId > 0) {
		console.log(`Fetching live HTML from MyAnimeList for ID '${malId}'...`);
		try {
			const malPlatform = PlatformFactory.getPlatform("mal");
			const details = await malPlatform.fetchAnimeDetails(malId.toString());

			if (details && details.title !== existing.mal_title) {
				changes.push(`MAL Title: "${existing.mal_title}" -> "${details.title}"`);
				newMalTitle = details.title;
			} else if (details) {
				console.log(`MAL title is already perfectly correct: "${details.title}"`);
			} else {
				console.warn("⚠️ Could not find a valid title in the MyAnimeList HTML.");
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`❌ Failed to scrape MyAnimeList:`, msg);
		}
	} else {
		console.log(`⚠️ No mal_id mapped for this entry. Dropping into interactive MAL review...`);

		const { InteractiveReviewService, ReviewResult } = await import(
			"../services/InteractiveReviewService.js"
		);
		const malPlatform = new MALPlatform();
		const reviewService = new InteractiveReviewService(repo, malPlatform);

		// Ensure the entry passed to review has the freshly scraped title so it's clean for the prompt
		const freshEntry = { ...existing, title: newTitle } as import("../core/domain.js").MappingEntry;

		const result = await reviewService.reviewSingleEntry(freshEntry);
		if (result === ReviewResult.RESOLVED) {
			// If they resolved it interactively, the repository was already updated!
			// We just need to load the fresh data to display the success message.
			const updatedMapping = repo.getMapping(platformName, platformId);
			if (updatedMapping) {
				newMalTitle = updatedMapping.mal_title;
				changes.push(`Interactively mapped to MAL ID: ${updatedMapping.mal_id} (${newMalTitle})`);
			}
		} else {
			console.log("Interactive MAL sync skipped.");
		}
	}

	// 3. Save Changes
	if (changes.length > 0) {
		console.log(`\n✅ Applying fixes to ${platformName}:${platformId}:`);
		for (const change of changes) {
			console.log(`   - ${change}`);
		}

		// If they interactively resolved it, the repo already has the new MAL ID. We must not overwrite it with 0.
		const freshestMapping = repo.getMapping(platformName, platformId);
		const finalMalId = freshestMapping ? freshestMapping.mal_id : malId;
		const finalMalTitle = freshestMapping ? freshestMapping.mal_title : newMalTitle || "";

		repo.setMapping(platformName, platformId, Number(finalMalId), finalMalTitle || "", {
			...existing,
			title: newTitle,
		});
		console.log(`\n🎉 Entry successfully healed!`);
	} else {
		console.log(`\n✅ Entry is already in perfect condition. No changes needed.`);
	}
}
