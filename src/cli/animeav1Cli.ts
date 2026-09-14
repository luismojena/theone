import { type MappingEntry, WatchlistEntry } from "../core/domain.js";
import { isError } from "../core/typeGuards.js";
import { PlatformFactory } from "../platforms/PlatformFactory.js";
import { FileMappingRepository } from "../repositories/FileMappingRepository.js";
import { PlatformImporterService } from "../services/PlatformImporterService.js";

const PLATFORM_NAME = "animeav1";

export async function runFetchAnimeAV1List() {
	console.log(`--- Fetch ${PLATFORM_NAME} Profile Watchlist States ---`);
	const platform = PlatformFactory.getPlatform(PLATFORM_NAME);

	const session = process.env.ANIMEAV1_SESSION;
	if (!session) {
		console.error("❌ ANIMEAV1_SESSION environment variable is required");
		return;
	}

	console.log("Authenticating with AnimeAV1 session...");
	try {
		await platform.authenticate({ session });
		console.log("✅ Session validated!");
	} catch (err: unknown) {
		console.error("❌ Authentication failed:", isError(err) ? err.message : String(err));
		return;
	}

	console.log(`Fetching AnimeAV1 Watchlist...`);
	const entries = await platform.fetchWatchlist();
	console.log(`\nProcessing ${entries.length} unique watchlist entries...`);

	const repo = new FileMappingRepository("./migrations/mappings.json");
	let updatedCount = 0;
	for (const item of entries) {
		const existingMapping = repo.getMapping(item.platform, item.platformId);
		const malId = existingMapping ? existingMapping.mal_id : null;
		const malTitle = existingMapping ? existingMapping.mal_title : item.title;

		repo.setMapping(item.platform, item.platformId, malId || 0, malTitle || item.title, {
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

export async function runSyncAnimeAV1() {
	console.log("\n--- AnimeAV1 Watchlist Synchronization ---");
	const platform = PlatformFactory.getPlatform(PLATFORM_NAME);

	const session = process.env.ANIMEAV1_SESSION;
	if (!session) {
		console.error("❌ ANIMEAV1_SESSION environment variable is required");
		return;
	}

	try {
		await platform.authenticate({ session });
	} catch (err: unknown) {
		console.error("❌ Authentication failed:", isError(err) ? err.message : String(err));
		return;
	}

	const repo = new FileMappingRepository("./migrations/mappings.json");
	const allMappings = repo.loadMappings();

	console.log("Fetching remote AnimeAV1 watchlist...");
	const remoteEntries = await platform.fetchWatchlist();
	const remoteMap = new Map(remoteEntries.map((e: WatchlistEntry) => [e.platformId.toString(), e]));

	const toUpdate = [];

	for (const key of Object.keys(allMappings)) {
		const mapping = allMappings[key] as MappingEntry;
		if (mapping.platform === platform.platformName) {
			const remote = remoteMap.get(mapping.platform_id || "");

			// If not on remote, or local status differs from remote (sync logic)
			if (
				!remote ||
				remote.status !== (mapping.mal_status || "Plan to Watch") ||
				remote.episodesWatched !== (mapping.last_synced_episodes || 0)
			) {
				// Construct entry to push
				toUpdate.push(
					new WatchlistEntry(
						platform.platformName,
						mapping.platform_id || "",
						mapping.title || "",
						mapping.mal_status || "Plan to Watch",
						mapping.last_synced_episodes || 0,
						mapping.mal_id || null,
					),
				);
			}
		}
	}

	console.log(`\n--- Synchronization Plan ---`);
	console.log(`Entries to push to AnimeAV1: ${toUpdate.length}`);

	if (toUpdate.length === 0) {
		console.log("\nEverything is up to date! Nothing to sync.");
		return;
	}

	console.log("\nExecuting sync (pushing local to remote)...");
	for (const entry of toUpdate) {
		try {
			console.log(`Syncing ${entry.title}...`);
			await platform.updateEntryStatus(entry);
		} catch (err: unknown) {
			console.error(
				`❌ Failed to sync ${entry.title}: ${isError(err) ? err.message : String(err)}`,
			);
		}
	}

	console.log("\nSync complete!");
}

export async function runImportAnimeAV1() {
	console.log("\n--- AnimeAV1 Automated Importer ---");
	const platform = PlatformFactory.getPlatform(PLATFORM_NAME);

	const session = process.env.ANIMEAV1_SESSION;
	if (!session) {
		console.error("❌ ANIMEAV1_SESSION environment variable is required");
		return;
	}

	try {
		await platform.authenticate({ session });
	} catch (err: unknown) {
		console.error("❌ Authentication failed:", isError(err) ? err.message : String(err));
		return;
	}

	const repo = new FileMappingRepository("./migrations/mappings.json");

	const importer = new PlatformImporterService(repo, platform);
	const mapped = await importer.mapMissingEntries();

	console.log(`\n🎉 Successfully mapped ${mapped} new entries to AnimeAV1!`);
	console.log(`Run 'theone animeav1 sync' to push these new entries to the cloud.`);
}
