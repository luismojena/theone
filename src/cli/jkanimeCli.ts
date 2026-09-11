import fs from 'fs';
import { JKAnimePlatform } from '../platforms/JKAnimePlatform.js';
import { FileMappingRepository } from '../repositories/FileMappingRepository.js';
import { askQuestion } from '../utils.js';

export async function runFetchJKAnimeList() {
  console.log('--- Fetch JKanime Profile Watchlist States ---');
  const platform = new JKAnimePlatform();
  let username = process.env.JKANIME_USER;
  let password = process.env.JKANIME_PASS;

  if (!username) username = await askQuestion('Enter JKanime Username: ');
  if (!password) password = await askQuestion('Enter JKanime Password: ');

  console.log('Logging into JKanime...');
  try {
    await platform.authenticate({ username, password });
    console.log('✅ Logged in successfully!');
  } catch (err: any) {
    console.error('❌ Login failed:', err.message);
    return;
  }

  console.log(`Querying JKanime Watchlist API for user "${username}"...`);
  const entries = await platform.fetchWatchlist();
  console.log(`\nProcessing ${entries.length} unique watchlist entries...`);

  const repo = new FileMappingRepository('./migrations/mappings.json');
  let updatedCount = 0;
  for (const item of entries) {
    const existingMapping = repo.getMapping(item.platform, item.platformId);
    const malId = existingMapping ? existingMapping.mal_id : 0;
    const malTitle = existingMapping ? existingMapping.mal_title : item.title;

    repo.setMapping(item.platform, item.platformId, malId, malTitle, {
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

export async function runSyncJKAnime(options = {}) {
  console.log('\n--- JKanime Watchlist Synchronization ---');
}
