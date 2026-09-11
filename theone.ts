import "dotenv/config";
import { Command } from "commander";


import { runResolve, runReview, runExport } from "./src/cli/malCli.js";
import { runSyncJKAnime, runFetchJKAnimeList } from "./src/cli/jkanimeCli.js";
import { runBackup } from "./src/services/BackupService.js";
import { FileMappingRepository } from './src/repositories/FileMappingRepository.js';
import { completeMALWatching } from "./src/cli/malCli.js"; // From old complete_watching.js wrapper

export function buildCLI() {
  const program = new Command();
  program
    .name('theone')
    .description('MyAnimeList Migration Utility (Modular) - DDD Edition')
    .version('2.0.0');

  // --- System / DB Commands ---
  const dbCmd = program.command('db').description('Database and system operations');
  dbCmd.command('inspect')
    .description('Inspect the persistent platform-to-MAL mappings store')
    .action(() => {
      const repo = new FileMappingRepository('./migrations/mappings.json');
      const m = repo.loadMappings();
      const count = Object.keys(m).length;
      console.log(`\nPersistent Mapping Store (${count} total entries mapped):`);
      console.log(`- File location: migrations/mappings.json`);
      console.log(`- Sample entries:`);
      Object.entries(m).slice(0, 5).forEach(([key, val]) => {
        console.log(`  * ${key} => MAL ID ${val.mal_id} ("${val.mal_title}")`);
      });
    });

  dbCmd
    .command("backup")
    .description(
      "Create a timestamped backup of all watchlist data and mapping stores",
    )
    .action(async () => {
      await runBackup();
    });

  // --- MyAnimeList Commands ---
  const malCmd = program.command("mal").description("MyAnimeList operations");
  malCmd
    .command("export")
    .description("Export resolved list to import.xml (for MAL import)")
    .action(async () => {
      await runExport();
    });

  malCmd
    .command("resolve")
    .description("Resolve scraped titles to MyAnimeList IDs using Jikan API")
    .action(async () => {
      await runResolve();
    });

  malCmd
    .command("review")
    .description(
      "Interactively review and manually resolve unmatched/ambiguous entries",
    )
    .action(async () => {
      await runReview();
    });

  malCmd
    .command("complete")
    .description(
      "Read your MAL export file, search Jikan, and complete currently watching entries",
    )
    .action(async () => {
      await completeMALWatching();
    });

  // --- JKanime Commands ---
  const jkanimeCmd = program
    .command("jkanime")
    .description("JKanime operations");
  jkanimeCmd
    .command("fetch")
    .description(
      "Fetch tracked anime & watch statuses from JKanime user profile into mappings.json",
    )
    .action(async () => {
      await runFetchJKAnimeList();
    });

  jkanimeCmd
    .command("sync")
    .description("Sync watching status of matched resolved list to jkanime.net")
    .option("--autoskip", "Skip low-confidence matches automatically")
    .option("--force", "Force sync even if locally cached status matches")
    .action(async (options) => {
      
      if (options.autoskip && !process.argv.includes("--autoskip")) {
        process.argv.push("--autoskip");
      }
      if (options.force && !process.argv.includes("--force")) {
        process.argv.push("--force");
      }
      await runSyncJKAnime();
    });

  // --- AnimeFLV Commands ---
  const animeflvCmd = program.command('animeflv').description('AnimeFLV operations');
  animeflvCmd.command('scrape')
    .description('Scrape AnimeFLV profile pages to scraped.json')
    .action(async () => {
      const { AnimeFLVPlatform } = await import('./src/platforms/AnimeFLVPlatform.js');
      const platform = new AnimeFLVPlatform();
      const profileId = process.env.ANIMEFLV_USER;
      if (!profileId) throw new Error('ANIMEFLV_USER environment variable is required');
      await platform.authenticate({ profileId });
      
      const entries = await platform.fetchWatchlist();
      if (entries.length > 0) {
        const fs = await import('fs');
        fs.writeFileSync('./migrations/scraped.json', JSON.stringify(entries, null, 2));
        console.log(`Scraping complete. Saved ${entries.length} items to scraped.json.`);
      }
    });

  // --- AnimeAV1 Commands ---
  const animeav1Cmd = program.command('animeav1').description('AnimeAV1 operations');
  animeav1Cmd.command('fetch')
    .description('Fetch tracked anime & watch statuses from AnimeAV1 user profile into mappings.json')
    .action(async () => {
      const { runFetchAnimeAV1List } = await import('./src/cli/animeav1Cli.js');
      await runFetchAnimeAV1List();
    });

  animeav1Cmd.command('sync')
    .description('Sync watching status of matched resolved list to animeav1.com')
    .action(async () => {
      const { runSyncAnimeAV1 } = await import('./src/cli/animeav1Cli.js');
      await runSyncAnimeAV1();
    });

  animeav1Cmd.command('import')
    .description('Automated migration: search and map unmapped MAL entries to AnimeAV1')
    .action(async () => {
      const { runImportAnimeAV1 } = await import('./src/cli/animeav1Cli.js');
      await runImportAnimeAV1();
    });

  return program;
}

// Only execute if this file is run directly
if (process.argv[1] && (process.argv[1].endsWith("theone.js") || process.argv[1].endsWith("theone.ts"))) {
  const cli = buildCLI();
  cli.parseAsync(process.argv).catch((err) => {
    if (err.message === 'WEBSITE_DOWN') {
      // The platform class already printed the custom error message, just exit cleanly.
      process.exit(1);
    }
    console.error("An unexpected error occurred:", err);
    process.exit(1);
  });
}
