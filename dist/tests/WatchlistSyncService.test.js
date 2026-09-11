import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { WatchlistSyncService } from '../src/services/WatchlistSyncService.js';
import { FileMappingRepository } from '../src/repositories/FileMappingRepository.js';
import { WatchlistEntry, WatchStatus } from '../src/core/domain.js';
test('WatchlistSyncService diffs incoming entries correctly', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'));
    const repo = new FileMappingRepository(path.join(tmpDir, 'mappings.json'));
    // Seed repo with one existing entry that is out of date, and one that is up to date
    repo.setMapping('jkanime', 'naruto', 20, 'Naruto', { last_synced_episodes: 10, mal_status: WatchStatus.WATCHING });
    repo.setMapping('jkanime', 'bleach', 269, 'Bleach', { last_synced_episodes: 50, mal_status: WatchStatus.COMPLETED });
    const syncService = new WatchlistSyncService(repo);
    const incoming = [
        // New entry
        new WatchlistEntry('jkanime', 'one-piece', 'One Piece', WatchStatus.WATCHING, 5),
        // Modified entry (progressed from 10 to 12)
        new WatchlistEntry('jkanime', 'naruto', 'Naruto', WatchStatus.WATCHING, 12),
        // Unchanged entry
        new WatchlistEntry('jkanime', 'bleach', 'Bleach', WatchStatus.COMPLETED, 50)
    ];
    const diff = syncService.computeIncrementalDiff(incoming);
    assert.strictEqual(diff.newEntries.length, 1);
    assert.strictEqual(diff.newEntries[0].platformId, 'one-piece');
    assert.strictEqual(diff.modifiedEntries.length, 1);
    assert.strictEqual(diff.modifiedEntries[0].entry.platformId, 'naruto');
    assert.strictEqual(diff.modifiedEntries[0].previous_episodes, 10);
    assert.strictEqual(diff.unchangedEntries.length, 1);
    assert.strictEqual(diff.unchangedEntries[0].platformId, 'bleach');
});
