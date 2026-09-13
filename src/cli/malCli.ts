import fs from "node:fs";
import { WatchStatus } from "../core/domain.js";
import { MALPlatform } from "../platforms/MALPlatform.js";
import { FileMappingRepository } from "../repositories/FileMappingRepository.js";
import { askQuestion, EXPORT_FILE, loadConfig, saveConfig } from "../utils.js";

export async function runExport() {
	console.log("--- Exporting resolved matches to MyAnimeList XML ---");
	const config = loadConfig();
	let username = process.env.MAL_USER || config.mal_user;

	if (!username) {
		username = await askQuestion(
			"Enter your MyAnimeList Username (press Enter to skip live diff): ",
		);
		if (username) {
			config.mal_user = username;
			saveConfig(config);
		}
	}

	const liveMalMap = new Map();
	if (username) {
		console.log(`Fetching live MyAnimeList watchlist for user "${username}"...`);
		const platform = new MALPlatform();
		await platform.authenticate({ username: (username as string) || "" });
		const entries = await platform.fetchWatchlist();
		for (const entry of entries) {
			liveMalMap.set(entry.malId, entry);
		}
		console.log(`✅ Successfully fetched ${liveMalMap.size} live entries from MyAnimeList.`);
	}

	const repo = new FileMappingRepository("./migrations/mappings.json");
	const mappings = repo.loadMappings();
	const matchedMap = new Map();

	for (const entry of Object.values(mappings)) {
		if (entry.mal_id && Number(entry.mal_id) > 0) {
			matchedMap.set(Number(entry.mal_id), entry);
		}
	}

	const matched = Array.from(matchedMap.values());
	if (matched.length === 0) {
		console.warn("No matched entries found to export.");
		return;
	}

	let xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<myanimelist>\n  <myinfo>\n    <user_export_type>1</user_export_type>\n  </myinfo>\n`;

	for (const item of matched) {
		const malId = item.mal_id;
		const malTitle = item.mal_title;
		const itemStatus = item.mal_status || item.last_synced_status || WatchStatus.WATCHING;
		const itemEpisodes = item.last_synced_episodes || 0;

		xml += `  <anime>
    <series_animedb_id>${malId}</series_animedb_id>
    <series_title><![CDATA[${malTitle}]]></series_title>
    <my_id>0</my_id>
    <my_watched_episodes>${itemEpisodes}</my_watched_episodes>
    <my_status>${itemStatus}</my_status>
    <update_on_import>1</update_on_import>
  </anime>\n`;
	}

	xml += `</myanimelist>\n`;
	fs.writeFileSync(EXPORT_FILE, xml, "utf8");
	console.log(`Export complete: ${EXPORT_FILE}`);
}

export async function runResolve() {
	console.log("--- Resolving missing MAL IDs ---");
	const repo = new FileMappingRepository("./migrations/mappings.json");
	const mappings = repo.loadMappings();
	const malPlatform = new MALPlatform();

	let resolvedCount = 0;
	let missingCount = 0;

	for (const key of Object.keys(mappings)) {
		const entry = mappings[key];
		if (!entry.mal_id || Number(entry.mal_id) === 0) {
			missingCount++;
			const searchTitle = entry.title || "";
			console.log(`\nSearching MAL for: "${searchTitle}"...`);
			try {
				let results = await malPlatform.searchAnime(searchTitle);

				// If MAL fails to find it because of exact punctuation matching (like colons),
				// strip special characters and retry.
				if (results.length === 0) {
					const strippedTitle = searchTitle
						.replace(/[^a-zA-Z0-9 ]/g, " ")
						.replace(/\s+/g, " ")
						.trim();
					if (strippedTitle !== searchTitle) {
						results = await malPlatform.searchAnime(strippedTitle);
					}
					// FINAL FALLBACK: If title is totally corrupted in the DB, use the formatted slug
					if (results.length === 0 && entry.platform_id) {
						const slugTitle = entry.platform_id.replace(/-/g, " ");
						results = await malPlatform.searchAnime(slugTitle);
					}
				}

				if (results.length > 0) {
					const bestMatch = results[0];
					console.log(`✅ Found match: "${bestMatch.title}" (ID: ${bestMatch.platform_id})`);
					repo.setMapping(
						entry.platform || "",
						entry.platform_id || "",
						Number(bestMatch.platform_id),
						bestMatch.title,
						entry,
					);
					resolvedCount++;
				} else {
					console.log(`❌ No results found on MAL.`);
				}
				// Sleep to avoid rate limits
				await new Promise((r) => setTimeout(r, 1000));
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(`⚠️ Error searching for ${searchTitle}:`, msg);
			}
		}
	}

	if (missingCount === 0) {
		console.log("✅ All entries already have a valid MAL ID. Nothing to resolve!");
	} else {
		console.log(`\n✅ Resolved ${resolvedCount} out of ${missingCount} missing entries.`);
	}
}
export async function runReview() {
	const repo = new FileMappingRepository("./migrations/mappings.json");
	const malPlatform = new MALPlatform();

	// Dynamically import the service
	const { InteractiveReviewService } = await import("../services/InteractiveReviewService.js");
	const reviewService = new InteractiveReviewService(repo, malPlatform);

	await reviewService.runFullReviewLoop();
}
export async function completeMALWatching() {}

export async function runFetchMALList() {
	console.log("--- Fetch Live MyAnimeList Database ---");
	const platform = new MALPlatform();
	const config = loadConfig();
	let username = process.env.MAL_USER || config.mal_user;

	if (!username) {
		username = await askQuestion("Enter your MyAnimeList Username: ");
		if (username) {
			config.mal_user = username;
			saveConfig(config);
		}
	}

	console.log(`Querying MyAnimeList /load.json API for user "${username}"...`);
	try {
		await platform.authenticate({ username: (username as string) || "" });
		const entries = await platform.fetchWatchlist();
		console.log(`\n✅ Successfully fetched ${entries.length} live entries from MyAnimeList.`);

		const repo = new FileMappingRepository("./migrations/mappings.json");
		let newCount = 0;

		for (const entry of entries) {
			const malId = Number(entry.platformId);
			const malTitle = entry.title;

			// Try to find if we already mapped this MAL ID to a platform
			let foundPlatform = "mal";
			let foundPlatformId = malId.toString();
			let existingEntry = null;

			const mappings = repo.loadMappings();
			for (const val of Object.values(mappings)) {
				if (Number(val.mal_id) === malId) {
					foundPlatform = val.platform || "mal";
					foundPlatformId = val.platform_id || malId.toString();
					existingEntry = val;
					break;
				}
			}

			if (!existingEntry) {
				// If it's completely new, just save it as a native 'mal' entry so we don't lose it
				repo.setMapping(foundPlatform, foundPlatformId, malId, malTitle, {
					title: malTitle,
					mal_status: entry.status,
					platform_status: entry.status,
					last_synced_episodes: entry.episodesWatched,
					last_synced_status: entry.status,
				});
				newCount++;
			} else {
				// Update the existing entry with live MAL data
				repo.setMapping(foundPlatform, foundPlatformId, malId, malTitle, {
					...existingEntry,
					mal_status: entry.status,
				});
			}
		}
		console.log(
			`✅ Synchronized MAL statuses. Discovered ${newCount} completely new, unmapped MAL entries.`,
		);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`❌ Failed to fetch MyAnimeList data:`, msg);
	}
}
