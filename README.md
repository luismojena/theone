# Anime Watchlist Migration & Sync Utility

A modular Node.js command-line utility to scrape, map, and synchronize your anime watchlist across **AnimeFLV**, **MyAnimeList (MAL)**, and **JKAnime**.

---

## Features

1. **AnimeFLV Profile Scraper**: Extracts followed anime titles, metadata, and covers from your profile.
2. **MyAnimeList Resolver**: Automatically maps AnimeFLV titles to MAL IDs using cheerio parsing (to prevent Jikan rate-limiting blocks) and features an interactive terminal reviewer for unmatched items.
3. **MyAnimeList XML Exporter**: Generates a standard MAL XML file ready to import at [https://myanimelist.net/import.php](https://myanimelist.net/import.php).
4. **JKAnime Status Synchronizer**: Authenticates your JKanime session and marks mapped titles as "Watching" (with **autoskip** support for unattended bulk operations).
5. **MAL List Completion Updater**: Decompresses your official MAL XML backup, queries Jikan API to find currently aired episodes for active/airing series, completes finished titles, and outputs an importable XML (with smart request caching).

---

## Installation & Setup

1. **Requirements**: Node.js v18+ is required.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Credentials Setup (`.env`)**:
   Create a `.env` file in the root directory (see `.env.example` template):
   ```env
   MAL_USER=your_mal_username
   JKANIME_USER=your_jkanime_username
   JKANIME_PASS=your_jkanime_password
   ```

All generated outputs, backups, and configuration states are stored in the `migrations/` directory. Secrets in `.env` are ignored by git via `.gitignore`.

---

## CLI Usage

The tool uses `theone.js` as the central entry-point command router.

```bash
node theone.js <command> [options]
```

### Commands

#### 1. Scrape AnimeFLV Profile
Extracts all tracked anime from your AnimeFLV following profile:
```bash
node theone.js scrape
```
* **Output**: `migrations/scraped.json`

#### 2. Resolve MyAnimeList IDs
Queries MAL to find database matches for all scraped titles:
```bash
node theone.js resolve
```
* **Output**: `migrations/resolved.json`

#### 3. Review Ambiguous Matches
Runs an interactive review terminal loop to manually assign MAL IDs for unmatched or low-confidence entries:
```bash
node theone.js review
```
* **Interactive options**: Select matching suggestions, search with custom queries, input manual MAL IDs, skip, or save and quit.

#### 4. Fetch JKanime Watchlist States
Logs into JKanime, fetches your saved watchlist cards and API lists, normalizes Spanish statuses (`Completado`, `Mirando`, etc.), and updates the persistent database:
```bash
node theone.js fetch-jkanime-list
```

#### 5. Synchronize Watchlist to JKanime
Logs into JKanime and synchronizes your mapped shows using your live MyAnimeList watch states (**Tag 2 `Completado`** for completed shows, **Tag 1 `Mirando`** for watching shows):
```bash
node theone.js sync-jkanime [--force] [--autoskip]
```
* **Zero-Prompt Bulk Mode**: Run `node theone.js sync-jkanime --force --autoskip` to automatically sync all shows hands-free using your `.env` credentials.

#### 6. Export to MyAnimeList XML with Live Diff
Queries your live MAL profile (`MAL_USER`), compares mapped titles against your live list, auto-resolves unmapped entries, and generates a MAL XML import file:
```bash
node theone.js export
```
* **Output**: `migrations/import.xml` (Upload this file at [https://myanimelist.net/import.php](https://myanimelist.net/import.php))

#### 7. Create Watchlist Backup Archive
Creates a timestamped snapshot backup of all platform watchlists, persistent mappings, and export files:
```bash
node theone.js backup
```
* **Output**: `migrations/backups/backup_<timestamp>/`

#### 8. Inspect Persistent Mappings Store
Inspects the permanent platform-to-MAL mappings database (`migrations/mappings.json`):
```bash
node theone.js mappings
```

#### 9. Complete MAL Watching List (Bulk Modification)
Completes all "Watching" anime in your MAL export backup:
```bash
node theone.js complete-watching
```


---

## Directory Structure

```
├── docs/                     # Documentation and Guides
│   └── ARCHITECTURE.md       # Architecture & Platform Extensibility Guide
├── migrations/               # All generated databases, cache indexes, and export files
│   ├── mappings.json         # Permanent platform-to-MAL mapping database
│   ├── scraped.json          # Raw scraped list from AnimeFLV
│   ├── resolved.json         # Title mappings and MAL IDs
│   ├── import.xml            # Generated MAL XML list import
│   ├── sync_jkanime.json     # JKanime sync progress status
│   └── mal_jikan_cache.json  # Aired episodes details cache (24h fresh check)
├── src/                      # Modular source code files
│   ├── utils.js              # Helpers (sleep, normalizer, season extractors, prompts)
│   ├── mapping.js            # Persistent platform-to-MAL mapping & diff engine
│   ├── animeflv.js           # Scraper logic
│   ├── mal.js                # MAL search, resolving, exports, and bulk list completion
│   └── jkanime.js            # JKanime login, searching, detail scraping, and list sync
├── tests/                    # Testing files
│   ├── mapping.test.js       # Persistent mapping unit tests
│   ├── integration.test.js   # HTTP fetch-mocked integration tests
│   └── migration.test.js     # Normalizers, match scoring, and season parser unit tests
├── tasks/                    # Task trackers
│   ├── todo.md               # Feature checklist and status review
│   └── lessons.md            # Self-improvement loop logs
├── theone.js                # Main unified CLI router
└── complete_watching.js      # Wrapper entrypoint for list completion
```


---

## Testing

Unit tests are written using Node.js's built-in test runner:
```bash
npm test
```
