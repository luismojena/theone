import { AnimeAV1Platform } from '../platforms/AnimeAV1Platform.js';
import { FileMappingRepository } from '../repositories/FileMappingRepository.js';
import { WatchlistSyncService } from '../services/WatchlistSyncService.js';
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
    const syncService = new WatchlistSyncService(repo);
    console.log('Fetching remote AnimeAV1 watchlist...');
    const entries = await platform.fetchWatchlist();
    const diff = syncService.computeIncrementalDiff(entries);
    console.log(`\n--- Synchronization Plan ---`);
    console.log(`New Entries: ${diff.newEntries.length}`);
    console.log(`Modified Entries: ${diff.modifiedEntries.length}`);
    console.log(`Unchanged Entries: ${diff.unchangedEntries.length}`);
    // Actually execute the updates
    const toUpdate = [...diff.newEntries, ...diff.modifiedEntries.map(m => m.entry)];
    if (toUpdate.length === 0) {
        console.log('\nEverything is up to date! Nothing to sync.');
        return;
    }
    console.log('\nExecuting sync...');
    for (const entry of toUpdate) {
        try {
            console.log(`Syncing ${entry.title}...`);
            await platform.updateEntryStatus(entry);
            console.log(`✅ Synced ${entry.title}`);
        }
        catch (err) {
            console.error(`❌ Failed to sync ${entry.title}: ${err.message}`);
        }
    }
    console.log('\nSync complete!');
}
