# Architecture & Platform Extensibility Guide

This document outlines the Domain-Driven Design (DDD) architecture, data models, and extension patterns for the **Anime Watchlist Migration & Sync Utility**.

---

## 1. Design Philosophy

The core principle of this project is **decoupled multi-platform synchronization with MyAnimeList (MAL) as the single source of truth**, built on a strict TypeScript foundation.

### Key Architectural Concepts

- **MAL as Universal Anchor**: External sites (AnimeFLV, JKanime, AnimeAV1, etc.) have varying title formats, season naming conventions, and internal IDs. Rather than attempting $N \times N$ direct site-to-site mappings, **every site entry maps to a canonical MyAnimeList ID**.
- **Domain-Driven Design (DDD)**: Business logic (Syncing, Importing) is completely isolated from Infrastructure (HTTP requests, HTML scraping) and Persistence (JSON file storage).
- **Strategy Pattern**: All platforms implement the `IAnimePlatform` interface, making adding new platforms trivial without modifying core sync logic.
- **Incremental Reconciliation**: Synchronization actions operate on a delta diff model, updating only entries whose episode progress or status has changed since the last sync.

---

## 2. DDD Directory Structure

- **`src/core/`**: Defines the structural backbone of the app. Includes `domain.ts` (Entities/Interfaces like `WatchlistEntry` and `MappingEntry`), `interfaces.ts` (Platform interfaces), `HttpClient.ts` (HTTP request abstraction), and `typeGuards.ts` (Zod-like JSON/Error runtime validators).
- **`src/repositories/`**: Handles persistence. `FileMappingRepository` abstracts away reading and writing to `migrations/mappings.json`.
- **`src/platforms/`**: The infrastructure layer. Contains concrete implementations of `IAnimePlatform` (e.g. `AnimeAV1Platform`, `JKAnimePlatform`).
- **`src/services/`**: The business logic layer.
  - `WatchlistSyncService`: Computes state differences between local truth and a remote platform.
  - `PlatformImporterService`: Automatically cross-references unmapped entries with a remote platform to build mapping bridges.
- **`src/cli/`**: The controller layer. Glues repositories, platforms, and services together in response to terminal commands.

---

## 3. Persistent Mapping Database Schema

Location: `migrations/mappings.json`

Entries are keyed by `${platform}:${platform_id}`.

### Schema Definition

```json
{
  "animeav1:4382": {
    "platform": "animeav1",
    "platform_id": "4382",
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

The reconciliation engine is provided by `src/services/WatchlistSyncService.ts` via the `computeIncrementalDiff(incomingEntries)` helper.

### Diff Calculation Flow

1. **`newEntries`**: Items present in the incoming platform list but not yet mapped in `mappings.json`.
2. **`modifiedEntries`**: Mapped items where current `episodesWatched` or `status` differs from `last_synced_episodes` or `last_synced_status`.
3. **`unchangedEntries`**: Mapped items with identical progress. Skipped during exports/syncs to save time and API quota.

---

## 5. Step-by-Step Guide: Adding a New Site

To integrate a new platform (e.g. `CrunchyrollPlatform`):

### Step 1: Create the Platform Class

Create `src/platforms/CrunchyrollPlatform.ts`:

```typescript
import type { IAnimePlatform } from "../core/interfaces.js";
import { HttpClient } from "../core/HttpClient.js";
import { WatchlistEntry, SearchResult } from "../core/domain.js";

export class CrunchyrollPlatform implements IAnimePlatform {
 public httpClient = new HttpClient();
 
 get platformName(): string {
  return "crunchyroll";
 }

 async authenticate(credentials: Record<string, string>): Promise<void> {
  this.httpClient.defaultHeaders.Authorization = `Bearer ${credentials.token}`;
 }

 async fetchAnimeDetails(platformId: string): Promise<{ title: string } | null> {
  return null;
 }

 async fetchWatchlist(): Promise<WatchlistEntry[]> {
  // Scrape/fetch watchlist
  return [];
 }

 async updateEntryStatus(entry: WatchlistEntry): Promise<void> {
  // POST API update
 }

 async searchAnime(query: string): Promise<SearchResult[]> {
  // Search the platform for MAL mapping
  return [];
 }
}
```

### Step 2: Create a CLI Handler

Create `src/cli/crunchyrollCli.ts` to wire up the new platform using the existing services (`WatchlistSyncService`, `PlatformImporterService`).

### Step 3: Register Command in `theone.ts`

In `theone.ts`, import your new CLI file and add it to the routing switch statement.

---

## 6. Type Guards and Error Handling

Do not blindly cast `any` or `unknown` API responses. Always use or extend `src/core/typeGuards.ts`.

- Use `isMappingRecord(data)` before reading from disk.
- Use `isError(err)` in `catch` blocks to safely extract `err.message` instead of throwing `undefined`.
