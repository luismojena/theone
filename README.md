# The One 💍

*Three sites for the Pirates under the sky,*
*Seven for the Weebs in their halls of stone,*
*Nine for Mortal Men doomed to die,*
*One for the Dark Lord on his dark throne,*
*In the Land of Node.js where the Anime lie.*

**One Script to rule them all, One Script to find them,**
**One Script to bring them all, and in the darkness bind them.**

Welcome to **The One** (`theone.ts`), the ridiculously over-engineered, strictly-typed, Domain-Driven Design (DDD) TypeScript command-line utility forged in the fires of Mount Doom (my code editor) to seamlessly synchronize your anime watchlists across **AnimeFLV**, **MyAnimeList (MAL)**, **JKAnime**, and **AnimeAV1**.

## 💍 Why Forge The One? (The Other Rings of Power)

There are already incredible tools in the anime ecosystem. **[MALSync](https://malsync.moe/)** is the undisputed king of tracking episodes in your browser as you watch them. **[Taiga](https://taiga.moe/)** effortlessly tracks local VLC/mpv video files. **[Trackma](https://github.com/z411/trackma)** offers great manual CLI list management.

So why forge another tool? 

Because the other rings are **reactive**—they only sync *as you watch*. **The One** is **proactive and stateful**. It is a bulk-migration and disaster recovery engine. If you have a 10-year-old AnimeFLV account with 500 watched shows, MALSync cannot easily port your entire history over to MyAnimeList or JKanime. *The One* scrapes, permanently maps, and diff-syncs your entire lifetime library across platforms in seconds.

I built this because I faced this exact problem and ended up vibe-coding my way into a solution that perfectly fits my needs. If you find yourself trapped in the same multi-platform syncing nightmare, feel free to wield this script!

---

## 🌟 The Fellowship of Features

1. **Multi-Platform Support**: Pluggable strategy architecture supporting AnimeFLV, MyAnimeList, JKanime, and AnimeAV1. Bring your platforms, the script will bind them.
2. **Canonical Mapping Engine**: Resolves and permanently maps chaotic, lawless platform slugs to a single, canonical MyAnimeList (MAL) ID. The One True ID.
3. **Smart Differential Sync**: Computes incremental state diffs (episodes watched, watch status) and synchronizes states *only* where they differ. We save API requests like Elrond saves grudges.
4. **Self-Healing Type Guards**: Leverages strict TypeScript type guards to safely parse persistent JSON datasets and gracefully recover from runtime errors. Balrogs shall not pass `unknown` types.
5. **AnimeAV1 Mass Importer**: Reverse-engineers AnimeAV1 SvelteKit payloads to automatically map hundreds of titles autonomously. It's practically magic.

---

## 🛠️ Forging the Script (Installation)

1. **Requirements**: Node.js v24+ (Latest LTS) is required.
2. **Install the dependencies**:
   ```bash
   npm install
   ```
3. **The Secret Runes (`.env`)**:
   Create a `.env` file in the root directory (see `.env.example`). Keep it secret, keep it safe:
   ```env
   MAL_USER=your_mal_username
   JKANIME_USER=your_jkanime_username
   JKANIME_PASS=your_jkanime_password
   ANIMEAV1_SESSION=your_animeav1_session_cookie
   ```

*All generated outputs, backups, and configuration states are safely hoarded in the `migrations/` directory like dragon treasure.*

---

## 🧙‍♂️ Wielding The One (CLI Usage)

The tool uses `theone.ts` as the central entry-point command router. You can cast your spells via `npx tsx theone.ts <command>` or build it and run `node dist/theone.js <command>`.

### ⚔️ AnimeAV1 Commands

#### Fetch AnimeAV1 Watchlist
Summons and displays your live AnimeAV1 watchlist using the session cookie.
```bash
npx tsx theone.ts animeav1 fetch
```

#### Synchronize Watchlist to AnimeAV1
Pushes your local truth database to AnimeAV1. Updates entries where the local episode count or status is ahead of the remote server.
```bash
npx tsx theone.ts animeav1 sync
```

#### Automated Import / Resolve
Iterates through all locally tracked MAL IDs, queries AnimeAV1 for exact matches, and auto-resolves mapping IDs seamlessly.
```bash
npx tsx theone.ts animeav1 import
```

### 🗡️ AnimeFLV Commands

#### Scrape AnimeFLV Watchlist
Plunders your AnimeFLV watchlist and saves it to local storage.
```bash
npx tsx theone.ts scrape
```

#### Resolve MAL IDs
Maps all previously scraped AnimeFLV titles to their canonical MAL IDs.
```bash
npx tsx theone.ts resolve
```

### 🥷 JKanime Commands

#### Fetch JKanime States
Stealthily fetches your current JKanime states and caches them.
```bash
npx tsx theone.ts fetch-jkanime-list
```

#### Synchronize Watchlist to JKanime
Pushes your local watchlist states up to your live JKanime account. Use `--autoskip` to let the script run hands-free.
```bash
npx tsx theone.ts sync-jkanime --force --autoskip
```

### 📖 MyAnimeList (MAL) Commands

#### Export MAL XML
Forges an importable XML file based on your mapped databases to upload directly to MAL.
```bash
npx tsx theone.ts export
```

#### Complete Airing Series
Queries the Jikan API to automatically mark any currently "Watching" series that have finished airing as "Completed" on MAL.
```bash
npx tsx theone.ts complete-watching
```

### 🧙‍♂️ Utility Commands

#### Interactive Match Review
Interactive CLI wizard to manually assign MAL IDs for ambiguous matches (for when the AI is acting like a foolish Took).
```bash
npx tsx theone.ts review
```


---

## 🏗️ The Architecture of Gondor

```text
├── docs/                     # Ancient texts and Extensibility Guide
│   └── [ARCHITECTURE.md](ARCHITECTURE.md)       # Read this before writing a PR
├── migrations/               # The Vault: Generated databases and exports
│   ├── mappings.json         # Permanent platform-to-MAL mapping database
│   └── import.xml            # Generated MAL XML list import
├── src/                      # The Forge: Modular, strongly-typed source code
│   ├── cli/                  # CLI interaction layer (The Mouth of Sauron)
│   ├── core/                 # Abstract classes, decorators, domain entities
│   ├── platforms/            # Concrete platform adapters (Strategy Pattern)
│   ├── repositories/         # Data persistence layer
│   ├── services/             # Core business logic (Diff Engines, Auto-Importers)
│   └── utils.ts              # Global helper spells
├── tests/                    # The Proving Grounds
└── theone.ts                 # Main CLI router (The One Script)
```

---

## 🛡️ Training the Troops

Unit tests are written using Node.js's built-in test runner. Test your code, lest you introduce bugs into the realm.
```bash
npm test
```

### Development Spells
- `npm run build`: Compiles the strict TypeScript project to `dist/`.
- `npm run lint`: Runs Biome linter across the repository.
- `npm run format`: Auto-formats the codebase with Biome.
