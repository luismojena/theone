import fs from 'fs';
import { MAPPINGS_FILE, RESOLVED_FILE, SYNC_JKANIME_FILE, ensureDataDir } from '../utils.js';


export function loadMappings() {
  ensureDataDir();
  if (fs.existsSync(MAPPINGS_FILE)) {
    try {
      const data = fs.readFileSync(MAPPINGS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.warn(`[Mapping] Error reading ${MAPPINGS_FILE}, initializing empty dictionary.`);
    }
  }

  // Auto-seed from resolved.json if mappings.json does not exist yet
  return seedMappingsFromResolved();
}

export function saveMappings(mappings) {
  ensureDataDir();
  fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2), 'utf8');
}

export function buildMappingKey(platform, platformId) {
  return `${platform}:${platformId}`;
}

export function getMapping(platform, platformId, mappings = null) {
  const mapData = mappings || loadMappings();
  const key = buildMappingKey(platform, platformId);
  return mapData[key] || null;
}

export function getMappingByMalId(malId, mappings = null) {
  const mapData = mappings || loadMappings();
  const numId = Number(malId);
  if (!numId) return null;

  let bestEntry = null;

  for (const entry of Object.values(mapData)) {
    if (entry.mal_id === numId && (entry.mal_status || entry.last_synced_status)) {
      if (!bestEntry) {
        bestEntry = entry;
      } else {
        const dateNew = new Date(entry.updated_at || 0).getTime();
        const dateCur = new Date(bestEntry.updated_at || 0).getTime();
        if (dateNew > dateCur) {
          bestEntry = entry;
        }
      }
    }
  }
  return bestEntry;
}



export function setMapping(platform, platformId, malId, malTitle, extraData = {}, mappings = null) {
  const currentMappings = mappings || loadMappings();
  const key = buildMappingKey(platform, platformId);

  currentMappings[key] = {
    platform,
    platform_id: platformId,
    title: extraData.title || platformId,
    mal_id: Number(malId),
    mal_title: malTitle,
    last_synced_episodes: extraData.last_synced_episodes ?? 0,
    last_synced_status: extraData.last_synced_status || 'Watching',
    updated_at: new Date().toISOString(),
    ...extraData
  };

  if (!mappings) {
    saveMappings(currentMappings);
  }

  return currentMappings[key];
}

export function seedMappingsFromResolved() {
  ensureDataDir();
  const mappings = {};

  const resolvedMap = new Map();

  if (fs.existsSync(RESOLVED_FILE)) {
    try {
      const resolvedData = JSON.parse(fs.readFileSync(RESOLVED_FILE, 'utf8'));
      for (const item of resolvedData) {
        if (item.match && item.match.mal_id) {
          const slug = item.slug || item.title;
          resolvedMap.set(slug, item);

          const key = buildMappingKey('animeflv', slug);
          mappings[key] = {
            platform: 'animeflv',
            platform_id: slug,
            title: item.title,
            mal_id: Number(item.match.mal_id),
            mal_title: item.match.title,
            last_synced_episodes: 0,
            last_synced_status: 'Watching',
            updated_at: new Date().toISOString()
          };
        }
      }
    } catch (e) {
      console.warn(`[Mapping] Could not seed from ${RESOLVED_FILE}: ${e.message}`);
    }
  }

  // Seed JKanime mappings from sync_jkanime.json
  if (fs.existsSync(SYNC_JKANIME_FILE)) {
    try {
      const syncData = JSON.parse(fs.readFileSync(SYNC_JKANIME_FILE, 'utf8'));
      let jkCount = 0;

      for (const [slug, entry] of Object.entries(syncData)) {
        if (entry.status === 'synced' && entry.jkanime_url) {
          const resolvedItem = resolvedMap.get(slug);
          if (resolvedItem && resolvedItem.match && resolvedItem.match.mal_id) {
            const jkSlug = entry.jkanime_url.replace(/^https?:\/\/jkanime\.net\//, '').replace(/\//g, '') || slug;
            const jkKey = buildMappingKey('jkanime', jkSlug);

            mappings[jkKey] = {
              platform: 'jkanime',
              platform_id: jkSlug,
              jkanime_id: entry.jkanime_id,
              title: entry.jkanime_title || entry.title,
              mal_id: Number(resolvedItem.match.mal_id),
              mal_title: resolvedItem.match.title,
              last_synced_episodes: 0,
              last_synced_status: 'Watching',
              updated_at: new Date().toISOString()
            };
            jkCount++;
          }
        }
      }
      console.log(`[Mapping] Seeded ${jkCount} JKanime entries into persistent mappings.`);
    } catch (e) {
      console.warn(`[Mapping] Could not seed JKanime mappings: ${e.message}`);
    }
  }

  saveMappings(mappings);
  console.log(`[Mapping] Total mappings stored: ${Object.keys(mappings).length} entries in ${MAPPINGS_FILE}.`);
  return mappings;
}


export function computeIncrementalDiff(incomingEntries, platform = 'jkanime', mappings = null) {
  const activeMappings = mappings || loadMappings();

  const newEntries = [];
  const modifiedEntries = [];
  const unchangedEntries = [];

  for (const item of incomingEntries) {
    const platformId = item.slug || item.platform_id || item.title;
    const key = buildMappingKey(platform, platformId);
    const existing = activeMappings[key];

    if (!existing || !existing.mal_id) {
      newEntries.push(item);
    } else {
      const episodesChanged = item.episodesWatched !== undefined && item.episodesWatched !== existing.last_synced_episodes;
      const statusChanged = item.status !== undefined && item.status !== existing.last_synced_status;

      if (episodesChanged || statusChanged) {
        modifiedEntries.push({
          ...item,
          mal_id: existing.mal_id,
          mal_title: existing.mal_title,
          previous_episodes: existing.last_synced_episodes,
          previous_status: existing.last_synced_status
        });
      } else {
        unchangedEntries.push({
          ...item,
          mal_id: existing.mal_id,
          mal_title: existing.mal_title
        });
      }
    }
  }

  return { newEntries, modifiedEntries, unchangedEntries };
}
