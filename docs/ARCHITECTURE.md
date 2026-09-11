# Architecture & Platform Extensibility Guide

This document outlines the architecture, data models, and extension patterns for the **Anime Watchlist Migration & Sync Utility**.

---

## 1. Design Philosophy

The core principle of this project is **decoupled multi-platform synchronization with MyAnimeList (MAL) as the single source of truth**.

### Key Architectural Concepts:
- **MAL as Universal Anchor**: External sites (AnimeFLV, JKanime, Crunchyroll, etc.) have varying title formats, season naming conventions, and internal IDs. Rather than attempting $N \times N$ direct site-to-site mappings, **every site entry maps to a canonical MyAnimeList ID**.
- **Namespaced Persistent Storage**: Mappings are stored permanently in a single flat database (`migrations/mappings.json`) keyed by composite namespaces (`<platform>:<identifier>`).
- **Incremental Reconciliation**: Synchronization actions operate on a delta diff model, updating only entries whose episode progress or status has changed since the last sync.

---

## 2. MAL ID Pivot Model

```
 ┌───────────────────────┐
 │   AnimeFLV Profile    │
 │ (slug: animeflv-slug) │
 └───────────┬───────────┘
             │
             ▼
 ┌───────────────────────┐         ┌────────────────────────┐
 │   MyAnimeList (MAL)   │◄────────┤   JKanime.net Account  │
 │  (Canonical MAL ID)   │         │  (slug: jkanime-slug)  │
 └───────────▲───────────┘         └────────────────────────┘
             │
             │ (Future Integrations)
 ┌───────────┴───────────┐
 │ Crunchyroll / Others  │
 └───────────────────────┘
```

If two entries across different platforms map to the **same MAL ID**, they represent the exact same anime title or season.

---

## 3. Persistent Mapping Database Schema

Location: `migrations/mappings.json`

Entries are keyed by `${platform}:${platform_id}`.

### Schema Definition:
```json
{
  "jkanime:aishiteru-game-wo-owarasetai": {
    "platform": "jkanime",
    "platform_id": "aishiteru-game-wo-owarasetai",
    "jkanime_id": "4656",
    "title": "Aishiteru Game wo Owarasetai",
    "mal_id": 61839,
    "mal_title": "Aishiteru Game wo Owarasetai",
    "last_synced_episodes": 0,
    "last_synced_status": "Watching",
    "updated_at": "2026-07-19T11:00:00.000Z"
  },
  "animeflv:aishiteru-game-wo-owarasetai": {
    "platform": "animeflv",
    "platform_id": "aishiteru-game-wo-owarasetai",
    "title": "Aishiteru Game wo Owarasetai",
    "mal_id": 61839,
    "mal_title": "Aishiteru Game wo Owarasetai",
    "last_synced_episodes": 0,
    "last_synced_status": "Watching",
    "updated_at": "2026-07-19T11:00:00.000Z"
  }
}
```

---

## 4. Incremental Reconciliation Engine

The reconciliation engine is provided by `src/mapping.js` via the `computeIncrementalDiff(incomingEntries, platform)` helper.

### Diff Calculation Flow:
1. **`newEntries`**: Items present in the incoming platform list but not yet mapped in `mappings.json`.
2. **`modifiedEntries`**: Mapped items where current `episodesWatched` or `status` differs from `last_synced_episodes` or `last_synced_status`.
3. **`unchangedEntries`**: Mapped items with identical progress. Skipped during exports/syncs to save time and API quota.

---

## 5. Step-by-Step Guide: Adding a New Site

To integrate a new platform (e.g. `crunchyroll`):

### Step 1: Create Scraper/API Module
Create `src/crunchyroll.js` (or `src/newsite.js`):
```javascript
import { getMapping, setMapping, computeIncrementalDiff } from './mapping.js';
import { searchMAL, scoreMatch } from './mal.js';

export async function scrapeNewSiteWatchlist() {
  // Scrape or fetch user's watchlist from the new site
  return [
    { slug: 'example-anime-slug', title: 'Example Anime', episodesWatched: 5, status: 'Watching' }
  ];
}
```

### Step 2: Resolve MAL IDs & Save Mappings
Check `getMapping('crunchyroll', item.slug)` first. If missing, resolve via MAL search and store in `mappings.json`:
```javascript
import { setMapping, getMapping } from './mapping.js';

export async function resolveNewSiteList(watchlist) {
  for (const item of watchlist) {
    let mapping = getMapping('crunchyroll', item.slug);
    if (!mapping) {
      const candidates = await searchMAL(item.title);
      const bestMatch = candidates[0]; // Or fuzzy match scoring
      if (bestMatch) {
        mapping = setMapping('crunchyroll', item.slug, bestMatch.mal_id, bestMatch.title, {
          title: item.title,
          last_synced_episodes: item.episodesWatched,
          last_synced_status: item.status
        });
      }
    }
  }
}
```

### Step 3: Register Commands in `theone.js`
In `theone.js`, add a CLI command case:
```javascript
case 'sync-crunchyroll':
  await runSyncCrunchyroll();
  break;
```

---

## 6. Future Edge Case Considerations

- **Multi-Season Flattening**: Some sites group multiple seasons under one page, while MAL splits each season into its own ID. Use the season parser helpers in `src/utils.js` (`extractSeason` and `cleanBaseTitle`) to disambiguate.
- **Rewatching / Dropped Status**: Track status transitions in `mappings.json` to avoid accidentally overwriting a completed show status on MAL when rewatching on a third-party streaming site.
