# The One 💍

*Three sites for the Pirates under the sky,*
*Seven for the Weebs in their halls of stone,*
*Nine for Mortal Men doomed to die,*
*One for the Dark Lord on his dark throne,*
*In the Land of Node.js where the Anime lie.*

**One Script to rule them all, One Script to find them,**
**One Script to bring them all, and in the darkness bind them.**

Welcome to **The One** (`theone.ts`), the ridiculously over-engineered, strictly-typed, Domain-Driven Design (DDD) TypeScript command-line utility forged in the fires of Mount Doom (my code editor) to seamlessly synchronize your anime watchlists across **AnimeFLV**, **MyAnimeList (MAL)**, **JKAnime**, and **AnimeAV1**.

---

## 🌟 The Fellowship of Features

1. **Multi-Platform Support**: Pluggable strategy architecture supporting AnimeFLV, MyAnimeList, JKanime, and AnimeAV1. Bring your platforms, the script will bind them.
2. **Canonical Mapping Engine**: Resolves and permanently maps chaotic, lawless platform slugs to a single, canonical MyAnimeList (MAL) ID. The One True ID.
3. **Smart Differential Sync**: Computes incremental state diffs (episodes watched, watch status) and synchronizes states *only* where they differ. We save API requests like Elrond saves grudges.
4. **Self-Healing Type Guards**: Leverages strict TypeScript type guards to safely parse persistent JSON datasets and gracefully recover from runtime errors. Balrogs shall not pass `unknown` types.
5. **AnimeAV1 Mass Importer**: Reverse-engineers AnimeAV1 SvelteKit payloads to automatically map hundreds of titles autonomously. It's practically magic.

---

## 🛠️ Forging the Script (Installation)

1. **Requirements**: Node.js v18+ is required.
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

#### 1. Fetch AnimeAV1 Watchlist
Summons and displays your live AnimeAV1 watchlist using the session cookie.
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

### 📜 Legacy Platform Commands

* **`scrape`**: Extracts your AnimeFLV watchlist.
* **`resolve`**: Maps AnimeFLV titles to MAL IDs.
* **`review`**: Interactive CLI to manually resolve ambiguous mapping matches (for when the AI is acting like a foolish Took).
* **`fetch-jkanime-list`**: Fetches current JKanime states.
* **`sync-jkanime [--force] [--autoskip]`**: Pushes local states up to JKanime.
* **`export`**: Dumps an importable MyAnimeList XML file.
* **`complete-watching`**: Automatically marks finished/aired series as Completed on MAL.

---

## 🏗️ The Architecture of Gondor

```text
├── docs/                     # Ancient texts and Extensibility Guide
│   └── ARCHITECTURE.md       # Read this before writing a PR
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
