import { isError } from "../core/typeGuards.js";
import { JKAnimePlatform } from "../platforms/JKAnimePlatform.js";
import { FileMappingRepository } from "../repositories/FileMappingRepository.js";
import { askQuestion } from "../utils.js";

export async function runFetchJKAnimeList(options: Record<string, string | boolean> = {}) {
	console.log("--- Fetch JKanime Profile Watchlist States ---");

	if (options.force) {
		console.log(
			"\n⚠️  WARNING: You are about to forcefully overwrite JKanime titles in your database.",
		);
		console.log("It is highly recommended to run 'theone db backup' before proceeding.");
		const answer = await askQuestion("Are you sure you want to proceed? (y/N): ");
		if (answer.toLowerCase() !== "y") {
			console.log("Aborted.");
			return;
		}
	}

	const platform = new JKAnimePlatform();
	let username = process.env.JKANIME_USER;
	let password = process.env.JKANIME_PASS;

	if (!username) username = await askQuestion("Enter JKanime Username: ");
	if (!password) password = await askQuestion("Enter JKanime Password: ");

	console.log("Logging into JKanime...");
	try {
		await platform.authenticate({ username, password });
		console.log("✅ Logged in successfully!");
	} catch (err: unknown) {
		console.error("❌ Login failed:", isError(err) ? err.message : String(err));
		return;
	}

	console.log(`Querying JKanime Watchlist API for user "${username}"...`);
	const entries = await platform.fetchWatchlist(options as Record<string, string>);
	console.log(`\nProcessing ${entries.length} unique watchlist entries...`);

	const repo = new FileMappingRepository("./migrations/mappings.json");
	let updatedCount = 0;

	for (const item of entries) {
		const existingMapping = repo.getMapping(item.platform, item.platformId);
		const malId = existingMapping ? existingMapping.mal_id : 0;
		const malTitle = existingMapping ? existingMapping.mal_title : item.title;

		if (!options.force && existingMapping) {
			// Safe merge: Keep existing title and other fields, only update statuses
			repo.setMapping(item.platform, item.platformId, Number(malId), malTitle || "", {
				...existingMapping,
				platform_status: item.status,
				mal_status: item.status,
				last_synced_episodes: item.episodesWatched,
				last_synced_status: item.status,
			});
			updatedCount++;
			continue;
		}

		if (options.force && existingMapping) {
			// Log destructive changes
			const changes = [];
			if (existingMapping.title !== item.title) {
				changes.push(`title: "${existingMapping.title}" -> "${item.title}"`);
			}
			if (changes.length > 0) {
				console.log(`[FORCE UPDATE] ${item.platformId}: ${changes.join(", ")}`);
			}
		}

		// Force or New Entry
		repo.setMapping(item.platform, item.platformId, Number(malId), malTitle || "", {
			...existingMapping, // Preserve other custom fields if they exist
			title: item.title,
			platform_status: item.status,
			mal_status: item.status,
			last_synced_episodes: item.episodesWatched,
			last_synced_status: item.status,
		});
		updatedCount++;
	}
	console.log(`✅ Updated state for ${updatedCount} entries in migrations/mappings.json.`);
}

export async function runSyncJKAnime(_options = {}) {
	console.log("\n--- JKanime Watchlist Synchronization ---");
}
