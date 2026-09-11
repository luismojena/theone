import { AnimeAV1Platform } from '../platforms/AnimeAV1Platform.js';
import { FileMappingRepository } from '../repositories/FileMappingRepository.js';
export async function runFetchAnimeAV1List() {
    console.log('--- Fetch AnimeAV1 Profile Watchlist States ---');
    const platform = new AnimeAV1Platform();
    const session = process.env.ANIMEAV1_SESSION;
    if (!session) {
        console.error('❌ ANIMEAV1_SESSION environment variable is required');
        return;
    }
    console.log('Authenticating with AnimeAV1 session...');
    try {
        await platform.authenticate({ session });
        console.log('✅ Session validated!');
    }
    catch (err) {
        console.error('❌ Authentication failed:', err.message);
        return;
    }
    console.log(`Fetching AnimeAV1 Watchlist...`);
    const entries = await platform.fetchWatchlist();
    console.log(`\nProcessing ${entries.length} unique watchlist entries...`);
    const repo = new FileMappingRepository('./migrations/mappings.json');
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
            last_synced_status: item.status
        });
        updatedCount++;
    }
    console.log(`✅ Updated state for ${updatedCount} entries in migrations/mappings.json.`);
}
export async function runSyncAnimeAV1() {
    console.log('\n--- AnimeAV1 Watchlist Synchronization ---');
    const platform = new AnimeAV1Platform();
    const session = process.env.ANIMEAV1_SESSION;
    if (!session) {
        console.error('❌ ANIMEAV1_SESSION environment variable is required');
        return;
    }
    try {
        await platform.authenticate({ session });
    }
    catch (err) {
        console.error('❌ Authentication failed:', err.message);
        return;
    }
    const repo = new FileMappingRepository('./migrations/mappings.json');
    const allMappings = repo.loadMappings();
    console.log('Fetching remote AnimeAV1 watchlist...');
    const remoteEntries = await platform.fetchWatchlist();
    const remoteMap = new Map(remoteEntries.map(e => [e.platformId.toString(), e]));
    const toUpdate = [];
    for (const key of Object.keys(allMappings)) {
        const mapping = allMappings[key];
        if (mapping.platform === 'animeav1') {
            const remote = remoteMap.get(mapping.platform_id);
            // If not on remote, or local status differs from remote (sync logic)
            if (!remote || remote.status !== (mapping.mal_status || 'Plan to Watch') || remote.episodesWatched !== (mapping.last_synced_episodes || 0)) {
                // Construct entry to push
                toUpdate.push({
                    platformId: mapping.platform_id,
                    title: mapping.title,
                    episodesWatched: mapping.last_synced_episodes || 0,
                    status: mapping.mal_status || 'Plan to Watch'
                });
            }
        }
    }
    console.log(`\n--- Synchronization Plan ---`);
    console.log(`Entries to push to AnimeAV1: ${toUpdate.length}`);
    if (toUpdate.length === 0) {
        console.log('\nEverything is up to date! Nothing to sync.');
        return;
    }
    console.log('\nExecuting sync (pushing local to remote)...');
    for (const entry of toUpdate) {
        try {
            console.log(`Syncing ${entry.title}...`);
            await platform.updateEntryStatus(entry);
        }
        catch (err) {
            console.error(`❌ Failed to sync ${entry.title}: ${err.message}`);
        }
    }
    console.log('\nSync complete!');
}
export async function runImportAnimeAV1() {
    console.log('\n--- AnimeAV1 Automated Importer ---');
    const platform = new AnimeAV1Platform();
    const session = process.env.ANIMEAV1_SESSION;
    if (!session) {
        console.error('❌ ANIMEAV1_SESSION environment variable is required');
        return;
    }
    try {
        await platform.authenticate({ session });
    }
    catch (err) {
        console.error('❌ Authentication failed:', err.message);
        return;
    }
    const { PlatformImporterService } = await import('../services/PlatformImporterService.js');
    const repo = new FileMappingRepository('./migrations/mappings.json');
    const importer = new PlatformImporterService(repo, platform);
    const mapped = await importer.mapMissingEntries();
    console.log(`\n🎉 Successfully mapped ${mapped} new entries to AnimeAV1!`);
    console.log(`Run 'theone animeav1 sync' to push these new entries to the cloud.`);
}
