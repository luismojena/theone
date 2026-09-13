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
export async function runReview() {}
export async function completeMALWatching() {}
