# Tasks

- [x] Implement AnimeFLV scraper command (`scrape`) and output to `scraped.json`
- [x] Implement MAL ID resolver with title sanitization/fuzzy matching (`resolve`) and output to `resolved.json`
- [x] Implement CLI review loop for manual resolution of unmatched/ambiguous entries (`review`)
- [x] Implement MAL XML exporter (`export`) and output to `import.xml`
- [x] Implement JKanime login API integration in `migrate.js` (`sync-jkanime` command)
- [x] Implement JKanime search/matching logic with interactive resolution CLI fallback
- [x] Implement JKanime status update API (`/api/guardar_anime`) integration with session/cookie handling
- [x] Implement incremental sync state saving to `sync_jkanime.json` to allow resuming
- [x] Refactor codebase to separate responsibilities into modular ES modules under `src/`
- [x] Implement `src/utils.js` for common helper utilities
- [x] Implement `src/animeflv.js` for AnimeFLV scraper logic
- [x] Implement `src/mal.js` for MyAnimeList search, resolve, XML export, and status completion logic
- [x] Implement `src/jkanime.js` for JKanime login, search, scraping, and list sync logic (including autoskip support)
- [x] Refactor `migrate.js` and `complete_watching.js` to act as clean entry-points
- [x] Add unit tests using Node.js built-in test runner under `tests/`
- [x] Add `npm test` script to `package.json` and verify all tests pass
- [x] Relocate all output databases, caches, and XML exports to `migrations/` folder
- [x] Create a comprehensive README.md documenting utility usage, options, and project structure
- [x] Add HTTP fetch-mocked integration tests for JKanime login/sync and MAL resolving/completion flow under `tests/`

## Persistent Mapping & Incremental Reconciliation

- [x] Design and implement persistent mapping repository (`src/mapping.js`) backed by `migrations/mappings.json`
- [x] Integrate existing resolved mappings (`migrations/resolved.json`) into `migrations/mappings.json`
- [x] Implement incremental sync / diff detector to update MAL XML exports with only new/modified entries
- [x] Integrate persistent mapping lookup into `migrate.js` CLI commands
- [x] Add unit tests for mapping persistence and incremental diff detection in `tests/`
- [x] Create comprehensive architecture & extensibility guide in `docs/ARCHITECTURE.md`

## JKanime Watchlist State Synchronization

- [x] Add JKanime profile watchlist scraper in `src/jkanime.js` to extract user tracked anime & status ("Mirando" / "Completado" / etc.)
- [x] Add status normalizer in `src/utils.js` mapping JKanime Spanish statuses to standard MAL XML statuses (`Watching`, `Completed`, `On-Hold`, `Dropped`, `Plan to Watch`)
- [x] Update `src/mapping.js` to persist `platform_status` and `mal_status` in `migrations/mappings.json`
- [x] Add `fetch-jkanime-list` command to `migrate.js` to pull JKanime profile states into `mappings.json`
- [x] Update MAL XML exporter (`export` command) to produce MAL XML imports reflecting the synced states
- [x] Add unit tests for JKanime status normalization and state persistence in `tests/`

## Multi-Platform Watchlist Backup Command

- [x] Implement `src/backup.js` module to scrape/snapshot all supported sites (AnimeFLV, JKanime) and local database files into a timestamped directory (`migrations/backups/backup_<timestamp>/`)
- [x] Add `backup` command to `migrate.js` CLI router
- [x] Document `node migrate.js backup` usage in `README.md` and `docs/ARCHITECTURE.md`
- [x] Add unit tests verifying backup creation and archive structure

## Automated Live MAL Watchlist Fetching & Export Diff Breakdown

- [x] Implement `fetchLiveMALWatchlist(username)` in `src/mal.js` to query live MAL watchlist JSON API (`load.json?offset=...`)
- [x] Integrate live MAL fetching and automatic diff breakdown into `runExport()` (`export` command)
- [x] Display process report during export showing new series to add, status changes (e.g. `Watching` -> `Completed`), and unchanged series
- [x] Save username config in `migrations/config.json` so user doesn't have to re-enter it
- [x] Add unit tests for live MAL watchlist parser and diff calculator in `tests/`

## Future Enhancements / Edge Cases (To Design & Implement Later)

- [ ] Handle platform edge cases in reconciliation: status synchronization when a show is dropped, paused/on-hold, or rewatched across platforms.

## Review

Automated Live MAL Watchlist Fetching & Export Diff Breakdown Implementation:

- **API Fetcher**: Added `fetchLiveMALWatchlist(username)` in [`src/mal.js`](file:///home/prow/myanimelist_migration/src/mal.js) querying `https://myanimelist.net/animelist/<username>/load.json?offset=...` (300 items per request).
- **Export & Diff Breakdown**: Updated `runExport()` in [`src/mal.js`](file:///home/prow/myanimelist_migration/src/mal.js) to automatically diff local mapped entries against live MAL state before writing [`migrations/import.xml`](file:///home/prow/myanimelist_migration/migrations/import.xml).
- **Process Indication**: Displays clear breakdown of 🆕 new series to add, 🔄 status changes (e.g. `Watching` -> `Completed`), and ⏩ unchanged series.
- **Config Storage**: Added `loadConfig()` / `saveConfig()` in [`src/utils.js`](file:///home/prow/myanimelist_migration/src/utils.js) saving `mal_user` in `migrations/config.json`.
- **Testing**: Added unit test `Live MAL Watchlist API Fetching Mock` in [`tests/migration.test.js`](file:///home/prow/myanimelist_migration/tests/migration.test.js). All 16 unit & integration tests pass cleanly.

## DDD Architectural Refactoring

- [ ] Define Core Domain Entities (`Anime`, `WatchlistEntry`, standard `WatchStatus` enum)
- [ ] Define Port Interfaces (`IAnimePlatform`, `MappingRepository`)
- [ ] Refactor File I/O into a concrete `FileMappingRepository`
- [ ] Refactor MyAnimeList logic into `MALPlatform` adapter
- [ ] Refactor JKanime logic into `JKAnimePlatform` adapter
- [ ] Refactor AnimeFLV logic into `AnimeFLVPlatform` adapter
- [ ] Implement `WatchlistSyncService` to orchestrate platform-to-platform syncing
- [ ] Refactor `migrate.js` CLI to initialize dependencies and use the new Services
- [ ] Verify existing tests pass and update tests for new class structures

## New Platform Integrations

- [ ] Implement `AnimeAV1Platform` adapter (login, fetch, sync)
- [ ] Register AnimeAV1 commands in CLI router
