import 'dotenv/config';
import { runScrape } from './src/animeflv.js';
import { runResolve, runReview, runExport, completeMALWatching } from './src/mal.js';
import { runSyncJKAnime, runFetchJKAnimeList } from './src/jkanime.js';
import { runBackup } from './src/backup.js';


async function main() {
  const command = process.argv[2];
  switch (command) {
    case 'scrape':
      await runScrape();
      break;
    case 'resolve':
      await runResolve();
      break;
    case 'review':
      await runReview();
      break;
    case 'export':
      await runExport();
      break;
    case 'backup':
      await runBackup();
      break;
    case 'mappings': {
      const { loadMappings } = await import('./src/mapping.js');
      const m = loadMappings();
      const count = Object.keys(m).length;
      console.log(`\nPersistent Mapping Store (${count} total entries mapped):`);
      console.log(`- File location: migrations/mappings.json`);
      console.log(`- Sample entries:`);
      Object.entries(m).slice(0, 5).forEach(([key, val]) => {
        console.log(`  * ${key} => MAL ID ${val.mal_id} ("${val.mal_title}")`);
      });
      break;
    }
    case 'sync-jkanime':
      await runSyncJKAnime();
      break;
    case 'fetch-jkanime-list':
      await runFetchJKAnimeList();
      break;
    case 'complete-watching':
      await completeMALWatching();
      break;


    default:
      console.log(`
MyAnimeList Migration Utility (Modular)

Usage:
  node migrate.js <command> [options]

Commands:
  scrape             - Scrape AnimeFLV profile pages to scraped.json
  resolve            - Resolve scraped titles to MyAnimeList IDs using Jikan API
  review             - Interactively review and manually resolve unmatched/ambiguous entries
  export             - Export resolved list to import.xml (for MAL import)
  backup             - Create a timestamped backup of all watchlist data and mapping stores
  mappings           - Inspect the persistent platform-to-MAL mappings store (mappings.json)
  sync-jkanime       - Sync watching status of matched resolved list to jkanime.net
                       Options:
                         --autoskip   Skip low-confidence matches automatically
  fetch-jkanime-list - Fetch tracked anime & watch statuses from JKanime user profile into mappings.json
  complete-watching  - Read your MAL export file, search Jikan, and complete currently watching entries

Examples:
  node migrate.js backup
  node migrate.js fetch-jkanime-list
  node migrate.js mappings

  node migrate.js sync-jkanime --autoskip
  node migrate.js complete-watching

      `);
  }
}


main().catch(err => {
  console.error('An unexpected error occurred:', err);
});
