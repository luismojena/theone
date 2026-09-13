# Anime Watchlist Migration & Sync Utility

A modular, strongly-typed TypeScript Domain-Driven Design (DDD) command-line utility to scrape, map, and synchronize your anime watchlist across **AnimeFLV**, **MyAnimeList (MAL)**, **JKAnime**, and **AnimeAV1**.

---

## Features

1. **Multi-Platform Support**: Pluggable architecture supporting AnimeFLV (scraper), MyAnimeList (MAL APIs & XML export), JKanime (sync), and AnimeAV1 (sync & reverse-import).
2. **Canonical Mapping Engine**: Resolves and permanently maps different platform slugs to a canonical MyAnimeList (MAL) ID.
3. **Smart Differential Sync**: Computes incremental state diffs (episodes watched, watch status) and synchronizes states specifically where they differ, saving API requests.
4. **Self-Healing Type Guards**: Leverages strict TypeScript type guards to safely parse persistent JSON datasets and gracefully recover from runtime errors.
5. **AnimeAV1 Mass Importer**: Reverse-engineers AnimeAV1 SvelteKit payloads to automatically map hundreds of titles autonomously.

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
   ANIMEAV1_SESSION=your_animeav1_session_cookie
   ```

All generated outputs, backups, and configuration states are stored in the `migrations/` directory.

---

## Development Commands

- `npm run build`: Compiles the strict TypeScript project to `dist/`.
- `npm run lint`: Runs Biome linter across the repository.
- `npm run format`: Auto-formats the codebase with Biome.

---

## CLI Usage

The tool uses `theone.ts` as the central entry-point command router. You can run it via `npx tsx theone.ts <command>` or build it and run `node dist/theone.js <command>`.

### AnimeAV1 Commands

#### 1. Fetch AnimeAV1 Watchlist
Fetches and displays your live AnimeAV1 watchlist using the session cookie.
```bash
npx tsx theone.ts animeav1 fetch
```

#### 2. Synchronize Watchlist to AnimeAV1
Pushes your local truth database to AnimeAV1. Updates entries where the local episode count or status is ahead of the remote server.
```bash
npx tsx theone.ts animeav1 sync
```

#### 3. Automated Import / Resolve
Iterates through all locally tracked MAL IDs, queries AnimeAV1 for exact matches, and auto-resolves mapping IDs seamlessly.
```bash
npx tsx theone.ts animeav1 import
```

### Legacy Platform Commands

* **`scrape`**: Extracts your AnimeFLV watchlist.
* **`resolve`**: Maps AnimeFLV titles to MAL IDs.
* **`review`**: Interactive CLI to manually resolve ambiguous anime mapping matches.
* **`fetch-jkanime-list`**: Fetches current JKanime states.
* **`sync-jkanime [--force] [--autoskip]`**: Pushes local states up to JKanime.
* **`export`**: Dumps an importable MyAnimeList XML file.
* **`complete-watching`**: Automatically marks finished/aired series as Completed on MAL.

---

## Directory Structure

```
├── docs/                     # Documentation and Guides
│   └── ARCHITECTURE.md       # Architecture, DDD patterns, & Extensibility Guide
├── migrations/               # All generated databases, cache indexes, and export files
│   ├── mappings.json         # Permanent platform-to-MAL mapping database
│   └── import.xml            # Generated MAL XML list import
├── src/                      # Modular, strongly-typed source code
│   ├── cli/                  # CLI interaction layer (controllers)
│   ├── core/                 # Abstract classes, decorators, domain entities, type guards
│   ├── platforms/            # Concrete platform scraper/API adapters (Strategy Pattern)
│   ├── repositories/         # Data persistence layer (FileMappingRepository)
│   ├── services/             # Core business logic (PlatformImporterService, WatchlistSyncService)
│   └── utils.ts              # Global helper functions
├── tests/                    # Unit and integration tests
└── theone.ts                 # Main CLI router
```

---

## Testing

Unit tests are written using Node.js's built-in test runner:
```bash
npm test
```
