import fs from 'fs';
import * as cheerio from 'cheerio';
import {
  sleep,
  normalize,
  extractSeason,
  cleanBaseTitle,
  askQuestion,
  normalizeJKAnimeStatus,
  RESOLVED_FILE,
  SYNC_JKANIME_FILE,
  ensureDataDir
} from '../utils.js';
import { setMapping, getMapping, getMappingByMalId, loadMappings } from './mapping.js';
import { fetchLiveMALWatchlist } from './mal.js';





// Helper for JKanime login
export async function loginJKAnime(username, password) {
  const payload = new URLSearchParams({
    usuario: username,
    password: password
  });

  const res = await fetch('https://login.jkanime.net/api/login', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://jkanime.net/',
      'Origin': 'https://jkanime.net'
    },
    body: payload.toString()
  });

  if (!res.ok) {
    throw new Error(`Login request failed with status ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.messaje || 'Invalid credentials');
  }

  const cookieArray = res.headers.getSetCookie();
  const cookies = cookieArray.map(c => c.split(';')[0]).join('; ');

  return {
    cookies,
    jkauth: data.jkauth
  };
}

// Search anime on JKanime
export async function searchJKAnime(query) {
  const url = `https://jkanime.net/buscar?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      console.error(`[JKAnime] Search failed with status ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];

    $('.anime__item').each((idx, el) => {
      const a = $(el).find('a').first();
      const href = a.attr('href');
      if (!href) return;

      const title = $(el).find('.anime__item__text h5 a').text().trim() || a.text().trim();
      const coverImg = $(el).find('.anime__item__pic').attr('data-setbg') || '';
      const tipo = $(el).find('.anime__item__text ul li.anime').text().trim() || 'Serie';

      results.push({
        title,
        href,
        coverImg,
        tipo
      });
    });

    return results;
  } catch (err) {
    console.error(`[JKAnime] Error searching for "${query}":`, err.message);
    return [];
  }
}

// Fetch details for JKanime anime to extract ID and metadata
export async function getJKAnimeDetails(href) {
  try {
    const res = await fetch(href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      console.error(`[JKAnime] Fetch details failed with status ${res.status}`);
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const animeId = $('#guardar-anime').attr('data-anime');
    if (!animeId) {
      console.error('[JKAnime] Could not find data-anime attribute on page.');
      return null;
    }

    const title = $('.anime_info h3').text().trim();
    const coverImg = $('.anime_pic img').attr('src') || '';
    const thumb = coverImg
      .replace('https://cdn.jkdesa.com', '')
      .replace('https://jkanime.net', '');
    const synopsis = $('p[rel="sinopsis"]').text().trim();
    
    let tipo = 'Serie';
    const tipoEl = $('li[rel="tipo"]');
    if (tipoEl.length) {
      const parts = tipoEl.html().split(' ');
      if (parts.length > 1) {
        tipo = parts[1].replace(/<\/?[^>]+(>|$)/g, ""); // Strip any HTML tags
      }
    }

    return {
      animeId,
      title,
      thumb,
      synopsis,
      tipo,
      href
    };
  } catch (err) {
    console.error(`[JKAnime] Error fetching details for ${href}:`, err.message);
    return null;
  }
}

// Save anime to JKanime list
export async function saveAnimeJKAnime(details, tag, cookies) {
  const statusIcon = (tag === 2 || tag === '2') ? 'ti-check' : 'ti-eye';
  const ginfo = {
    status: statusIcon,
    title: details.title,
    thumb: details.thumb,
    synopsis: details.synopsis,
    url: new URL(details.href).pathname,
    date: new Date().toLocaleString(),
    tipo: details.tipo
  };

  const payload = new URLSearchParams({
    ainfo: JSON.stringify(ginfo),
    id: details.animeId,
    tag: tag.toString()
  });

  const res = await fetch('https://login.jkanime.net/api/guardar_anime', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
      'Referer': 'https://jkanime.net/',
      'Origin': 'https://jkanime.net'
    },
    body: payload.toString()
  });

  if (!res.ok) {
    throw new Error(`Status update failed with status ${res.status}`);
  }

  const data = await res.json();
  if (data === 'token') {
    throw new Error('Session expired or token invalid');
  }

  return data;
}


export function scoreMatchSimple(originalTitle, candidateTitle) {
  const origNorm = normalize(originalTitle);
  const candNorm = normalize(candidateTitle);
  if (candNorm === origNorm) return 100;
  
  const origSeason = extractSeason(originalTitle);
  const origBase = cleanBaseTitle(originalTitle);
  const origBaseNorm = normalize(origBase);
  
  const candSeason = extractSeason(candidateTitle);
  const candBase = cleanBaseTitle(candidateTitle);
  const candBaseNorm = normalize(candBase);
  
  if (candBaseNorm === origBaseNorm && candSeason === origSeason) {
    return 95;
  } else if (candNorm.includes(origBaseNorm) && candSeason === origSeason) {
    return 90;
  } else if (candNorm.includes(origBaseNorm)) {
    return 60;
  }
  return 0;
}

export async function runSyncJKAnime() {
  ensureDataDir();
  console.log('\n--- JKanime Watchlist Synchronization ---');
  
  const mappings = loadMappings();
  const matchedMap = new Map();

  if (fs.existsSync(RESOLVED_FILE)) {
    const resolvedList = JSON.parse(fs.readFileSync(RESOLVED_FILE, 'utf8'));
    for (const item of resolvedList) {
      if (item.status === 'matched' && item.match && item.match.mal_id) {
        matchedMap.set(Number(item.match.mal_id), {
          title: item.title,
          slug: item.slug || item.title,
          match: item.match
        });
      }
    }
  }

  for (const entry of Object.values(mappings)) {
    if (entry.mal_id && Number(entry.mal_id) > 0) {
      matchedMap.set(Number(entry.mal_id), {
        title: entry.title || entry.mal_title,
        slug: entry.platform_id,
        match: {
          mal_id: Number(entry.mal_id),
          title: entry.mal_title || entry.title
        }
      });
    }
  }

  const matchedList = Array.from(matchedMap.values());

  if (matchedList.length === 0) {
    console.warn('No matched entries found to sync.');
    return;
  }


  let syncState = {};
  if (fs.existsSync(SYNC_JKANIME_FILE)) {
    syncState = JSON.parse(fs.readFileSync(SYNC_JKANIME_FILE, 'utf8'));
    console.log(`Loaded existing sync state with ${Object.keys(syncState).length} entries.`);
  }

  // Check for command line flags or prompt for autoskip
  let autoskip = process.argv.includes('--autoskip');
  if (!autoskip) {
    const ans = await askQuestion('Enable autoskip for low-confidence matches? (y/n): ');
    autoskip = ans.toLowerCase() === 'y';
  }
  console.log(`Autoskip mode: ${autoskip ? 'ENABLED' : 'DISABLED'}`);

  // 1. Credentials
  let username = process.env.JKANIME_USER;
  let password = process.env.JKANIME_PASS;

  if (!username) {
    username = await askQuestion('JKAnime Username or Email: ');
  }
  if (!password) {
    password = await askQuestion('JKAnime Password: ');
  }

  console.log(`Logging in to JKanime as "${username}"...`);

  let loginResult;
  try {
    loginResult = await loginJKAnime(username, password);
    console.log('✅ Logged in successfully!');
  } catch (err) {
    console.error('❌ Login failed:', err.message);
    return;
  }

  const { cookies } = loginResult;

  // 2. Select Sync mode
  let option = '1';
  if (!process.argv.includes('--force') && !process.argv.includes('--all') && !process.argv.includes('-y')) {
    console.log('\nSync options:');
    console.log('  1 - Sync all matched entries in resolved.json');
    console.log('  2 - Sync entries matching a specific query');
    console.log('  3 - Cancel');
    option = await askQuestion('Select option (1-3): ');
  }

  let itemsToSync = [];
  if (option === '1') {
    itemsToSync = matchedList;
  } else if (option === '2') {
    const filterQuery = await askQuestion('Enter query to match titles (case-insensitive): ');
    const normalizedFilter = filterQuery.toLowerCase();
    itemsToSync = matchedList.filter(item => item.title.toLowerCase().includes(normalizedFilter));
  } else {
    console.log('Sync cancelled.');
    return;
  }

  const malUser = process.env.MAL_USER || 'prow007';
  console.log(`Fetching live MAL watchlist for user "${malUser}"...`);
  let liveMalMap = new Map();
  try {
    liveMalMap = await fetchLiveMALWatchlist(malUser);
    console.log(`✅ Fetched ${liveMalMap.size} live entries from MyAnimeList.`);
  } catch (err) {
    console.warn(`Could not fetch live MAL list: ${err.message}`);
  }

  // Filter out already synced unless --force or status changed
  const forceSync = process.argv.includes('--force');
  itemsToSync = itemsToSync.filter(item => {
    if (forceSync) return true;
    const malId = item.match ? Number(item.match.mal_id) : 0;
    const liveEntry = malId ? liveMalMap.get(malId) : null;
    const storedMapping = malId ? getMappingByMalId(malId) : null;
    const targetStatus = (liveEntry && liveEntry.status) || (storedMapping && (storedMapping.mal_status || storedMapping.last_synced_status)) || 'Completed';
    const state = syncState[item.slug];
    if (!state || state.status !== 'synced') return true;
    if (state.synced_status !== targetStatus) return true;
    return false;
  });

  if (itemsToSync.length === 0) {
    console.log('All selected entries are already synced to JKanime with up-to-date statuses!');
    return;
  }

  console.log(`\nReady to sync ${itemsToSync.length} entries to JKanime. Let\'s proceed...`);

  for (let i = 0; i < itemsToSync.length; i++) {
    const item = itemsToSync[i];
    const progress = `[${i + 1}/${itemsToSync.length}]`;
    console.log(`\n========================================`);
    console.log(`${progress} Syncing: "${item.title}"...`);

    const malId = item.match ? Number(item.match.mal_id) : 0;
    const storedMapping = malId ? getMappingByMalId(malId) : null;
    const cachedState = syncState[item.slug];

    let selectedMatch = null;

    // Check if we already have a saved JKanime match from previous interactive/sync runs
    if (cachedState && cachedState.jkanime_url && cachedState.jkanime_id) {
      selectedMatch = {
        title: cachedState.jkanime_title || item.title,
        href: cachedState.jkanime_url,
        animeId: cachedState.jkanime_id
      };
      console.log(`  Reusing saved JKanime match: "${selectedMatch.title}"`);
    } else if (storedMapping && storedMapping.jkanime_id) {
      const jkSlug = storedMapping.platform === 'jkanime' ? storedMapping.platform_id : item.slug;
      selectedMatch = {
        title: storedMapping.title || storedMapping.mal_title,
        href: `https://jkanime.net/${jkSlug}/`,
        animeId: storedMapping.jkanime_id
      };
      console.log(`  Reusing saved JKanime mapping: "${selectedMatch.title}"`);
    }

    if (!selectedMatch) {
      // Step 1: Search JKanime
      const searchResults = await searchJKAnime(item.title);
      await sleep(1000); // Be gentle

      if (searchResults.length > 0) {
        const topMatch = searchResults[0];
        const matchScore = scoreMatchSimple(item.title, topMatch.title);

        if (matchScore >= 80) {
          console.log(`  Auto-matched high confidence [${matchScore}%]: "${topMatch.title}"`);
          selectedMatch = topMatch;
        } else if (autoskip) {
          console.log(`  Autoskip active. Low-confidence match [${matchScore}%] for "${topMatch.title}". Skipping.`);
          syncState[item.slug] = {
            title: item.title,
            status: 'skipped',
            reason: 'low_confidence',
            topMatch: topMatch.title,
            score: matchScore,
            date: new Date().toISOString()
          };
          fs.writeFileSync(SYNC_JKANIME_FILE, JSON.stringify(syncState, null, 2));
          continue;
        }
      }

      if (!selectedMatch) {
        if (autoskip) {
          console.log(`  Autoskip active. No results for "${item.title}". Skipping.`);
          syncState[item.slug] = {
            title: item.title,
            status: 'skipped',
            reason: 'no_results',
            date: new Date().toISOString()
          };
          fs.writeFileSync(SYNC_JKANIME_FILE, JSON.stringify(syncState, null, 2));
          continue;
        }

        console.log(`  No exact match found for: "${item.title}"`);
        if (searchResults.length > 0) {
          console.log('  Candidates:');
          searchResults.slice(0, 5).forEach((cand, idx) => {
            console.log(`    [${idx + 1}] "${cand.title}" (${cand.tipo})`);
          });
        }

        console.log('  Options: [1-N] Choose match | [s] Skip | [s <query>] Custom search');
        let resolved = false;
        while (!resolved) {
          const userInput = await askQuestion('  Choice: ');
          if (userInput.toLowerCase() === 's') {
            console.log('  Skipped.');
            syncState[item.slug] = {
              title: item.title,
              status: 'skipped',
              reason: 'manual_skip',
              date: new Date().toISOString()
            };
            resolved = true;
            fs.writeFileSync(SYNC_JKANIME_FILE, JSON.stringify(syncState, null, 2));
          } else if (userInput.startsWith('s ')) {
            const customQuery = userInput.substring(2).trim();
            console.log(`  Searching custom query "${customQuery}"...`);
            const customResults = await searchJKAnime(customQuery);
            await sleep(1000);
            if (customResults.length === 0) {
              console.log('  No results found.');
            } else {
              console.log('  Custom Search Results:');
              customResults.slice(0, 5).forEach((cand, idx) => {
                console.log(`    [${idx + 1}] "${cand.title}" (${cand.tipo})`);
              });
              const selection = await askQuestion('  Select index to map (or Enter to search again): ');
              const selIdx = parseInt(selection, 10) - 1;
              if (selIdx >= 0 && selIdx < customResults.length) {
                selectedMatch = customResults[selIdx];
                resolved = true;
              }
            }
          } else {
            const selIdx = parseInt(userInput, 10) - 1;
            if (selIdx >= 0 && selIdx < searchResults.length) {
              selectedMatch = searchResults[selIdx];
              resolved = true;
            } else {
              console.log('  Invalid input.');
            }
          }
        }
      }
    }


    if (selectedMatch) {
      console.log(`  Fetching details for: "${selectedMatch.title}"...`);
      const details = await getJKAnimeDetails(selectedMatch.href);
      await sleep(1000);

      if (details) {
        const malId = item.match ? Number(item.match.mal_id) : 0;
        const liveEntry = malId ? liveMalMap.get(malId) : null;
        const storedMapping = malId ? getMappingByMalId(malId) : null;
        const statusName = (liveEntry && liveEntry.status) || (storedMapping && (storedMapping.mal_status || storedMapping.last_synced_status)) || 'Completed';

        let tagId = 2;
        let tagLabel = 'Completado';
        if (statusName === 'Watching') {
          tagId = 1;
          tagLabel = 'Mirando';
        } else if (statusName === 'Completed') {
          tagId = 2;
          tagLabel = 'Completado';
        } else if (statusName === 'On-Hold') {
          tagId = 5;
          tagLabel = 'Pausado';
        } else if (statusName === 'Dropped') {
          tagId = 6;
          tagLabel = 'Abandonado';
        } else if (statusName === 'Plan to Watch') {
          tagId = 4;
          tagLabel = 'Deseado';
        }

        console.log(`  Marking as "${tagLabel}" (ID: ${details.animeId}, Tag: ${tagId})...`);
        try {
          await saveAnimeJKAnime(details, tagId, cookies);
          console.log(`  ✅ SYNCED: "${item.title}" -> "${selectedMatch.title}" as ${tagLabel} on JKanime`);
          
          if (item.match && item.match.mal_id) {
            const jkSlug = selectedMatch.href ? selectedMatch.href.replace(/^https?:\/\/jkanime\.net\//, '').replace(/\//g, '') : item.slug;
            setMapping('jkanime', jkSlug, item.match.mal_id, item.match.title, {
              jkanime_id: details.animeId,
              title: selectedMatch.title,
              platform_status: tagLabel,
              mal_status: statusName,
              last_synced_status: statusName
            });
          }


          syncState[item.slug] = {
            title: item.title,
            jkanime_title: selectedMatch.title,
            jkanime_id: details.animeId,
            jkanime_url: selectedMatch.href,
            status: 'synced',
            synced_status: statusName,
            date: new Date().toISOString()
          };

        } catch (err) {

          console.error(`  ❌ Failed to update status:`, err.message);
          syncState[item.slug] = {
            title: item.title,
            status: 'failed',
            error: err.message,
            date: new Date().toISOString()
          };
        }
      } else {
        console.error(`  ❌ Failed to fetch JKanime details.`);
        syncState[item.slug] = {
          title: item.title,
          status: 'failed',
          error: 'Failed to fetch details page',
          date: new Date().toISOString()
        };
      }
      fs.writeFileSync(SYNC_JKANIME_FILE, JSON.stringify(syncState, null, 2));
    }
  }

  console.log('\n=== Synchronization Complete! ===');
  let syncedBatch = 0;
  let skippedBatch = 0;
  let failedBatch = 0;

  for (const item of itemsToSync) {
    const st = syncState[item.slug];
    if (st && st.status === 'synced') syncedBatch++;
    else if (st && st.status === 'skipped') skippedBatch++;
    else if (st && st.status === 'failed') failedBatch++;
  }

  console.log(`Summary (${itemsToSync.length} items):`);
  console.log(`- Synced: ${syncedBatch}`);
  console.log(`- Skipped: ${skippedBatch}`);
  console.log(`- Failed: ${failedBatch}`);

}

export function parseJKAnimeProfileHTML(html) {
  const $ = cheerio.load(html);
  const items = [];
  const seenSlugs = new Set();

  $('.p-3.d-flex, div:has(.card-body-home), .anime__item, tr.anime-row, .profile-anime-card').each((_, el) => {
    const titleLink = $(el).find('.card-title a, h5 a, a[href*="jkanime.net/"]').first();
    const href = titleLink.attr('href') || $(el).find('a').first().attr('href');
    if (!href) return;

    const slug = href.replace(/^https?:\/\/jkanime\.net\//, '').replace(/\//g, '');
    if (!slug || seenSlugs.has(slug)) return;
    if (['guardado', 'historial', 'notificaciones', 'directorio', 'horario', 'comunidad', 'aplicacion', 'estrenos', 'top', 'dash', 'usuario'].includes(slug) || slug.includes('$')) return;

    const title = titleLink.text().trim() || $(el).find('.card-title, h5').text().trim() || slug;
    seenSlugs.add(slug);

    const statusBadge = $(el).find('.card-info .badge, .anime__item__text ul li, .status-badge, .badge, .state').first().text().trim();
    const malStatus = normalizeJKAnimeStatus(statusBadge);

    const epText = $(el).find('.card-text.ep, .ep-count, .episodes, .anime__item__pic .ep').text().trim();
    let episodesWatched = 0;
    const epMatch = epText.match(/ep(?:isodio)?\s*(\d+)/i) || epText.match(/(\d+)/);
    if (epMatch) {
      episodesWatched = parseInt(epMatch[1], 10);
    }

    items.push({
      title,
      href,
      slug,
      platform_status: statusBadge || 'Mirando',
      mal_status: malStatus,
      episodesWatched
    });
  });

  return items;
}

export async function fetchJKAnimeUserWatchlistAPI(cookies, username) {
  const items = [];
  const tagMap = {
    '1': { mal_status: 'Watching', platform_status: 'Mirando' },
    '2': { mal_status: 'Completed', platform_status: 'Completado' },
    '3': { mal_status: 'Watching', platform_status: 'Siguiendo' },
    '4': { mal_status: 'Plan to Watch', platform_status: 'Deseado' },
    '5': { mal_status: 'On-Hold', platform_status: 'Pausado' },
    '6': { mal_status: 'Dropped', platform_status: 'Abandonado' }
  };

  for (const [tagId, statusInfo] of Object.entries(tagMap)) {
    let page = 1;
    let lastPage = 1;

    do {
      try {
        const url = `https://login.jkanime.net/api/animes?tag=${tagId}&orden=none&filtro=fecha&p=${page}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://jkanime.net/',
            'Cookie': cookies,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({ user: username }).toString()
        });

        if (!res.ok) break;

        const json = await res.json();
        lastPage = json.last_page || 1;

        if (json.data && Array.isArray(json.data)) {
          for (const rawItem of json.data) {
            let info = {};
            if (typeof rawItem.info === 'string') {
              try { info = JSON.parse(rawItem.info); } catch (e) {}
            } else if (typeof rawItem.info === 'object') {
              info = rawItem.info || {};
            }

            const rawUrl = info.url || rawItem.url || '';
            const slug = rawUrl.replace(/^https?:\/\/jkanime\.net\//, '').replace(/\//g, '');
            if (!slug) continue;

            const title = info.title || rawItem.title || slug;

            items.push({
              title,
              slug,
              jkanime_id: String(rawItem.anime_id || ''),
              platform_status: statusInfo.platform_status,
              mal_status: statusInfo.mal_status,
              episodesWatched: 0
            });
          }
        }
      } catch (err) {
        console.warn(`Error fetching JKanime API tag ${tagId} page ${page}:`, err.message);
      }
      page++;
    } while (page <= lastPage);
  }

  return items;
}

export async function runFetchJKAnimeList() {
  console.log('--- Fetch JKanime Profile Watchlist States ---');
  let username = process.env.JKANIME_USER;
  let password = process.env.JKANIME_PASS;

  if (!username) {
    username = await askQuestion('Enter JKanime Username: ');
  }
  if (!password) {
    password = await askQuestion('Enter JKanime Password: ');
  }

  console.log('Logging into JKanime...');
  let loginResult;
  try {
    loginResult = await loginJKAnime(username, password);
    console.log('✅ Logged in successfully!');
  } catch (err) {
    console.error('❌ Login failed:', err.message);
    return;
  }

  const { cookies } = loginResult;
  console.log(`Querying JKanime Watchlist API for user "${username}"...`);

  let uniqueItems = await fetchJKAnimeUserWatchlistAPI(cookies, username);

  if (uniqueItems.length === 0) {
    console.log('API returned 0 items. Falling back to HTML scraping...');
    const targetUrls = [
      'https://jkanime.net/guardado',
      `https://jkanime.net/usuario/${encodeURIComponent(username)}/`
    ];

    let totalItems = [];
    for (const url of targetUrls) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': cookies
          }
        });

        if (res.ok) {
          const html = await res.text();
          const items = parseJKAnimeProfileHTML(html);
          totalItems.push(...items);
        }
      } catch (e) {
        console.warn(`Could not fetch ${url}: ${e.message}`);
      }
    }

    const uniqueItemsMap = new Map();
    for (const item of totalItems) {
      if (!uniqueItemsMap.has(item.slug)) {
        uniqueItemsMap.set(item.slug, item);
      }
    }
    uniqueItems = Array.from(uniqueItemsMap.values());
  }

  console.log(`\nProcessing ${uniqueItems.length} unique watchlist entries...`);

  let updatedCount = 0;
  for (const item of uniqueItems) {
    const existingMapping = getMapping('jkanime', item.slug);
    const malId = existingMapping ? existingMapping.mal_id : 0;
    const malTitle = existingMapping ? existingMapping.mal_title : item.title;

    setMapping('jkanime', item.slug, malId, malTitle, {
      title: item.title,
      jkanime_id: item.jkanime_id || (existingMapping ? existingMapping.jkanime_id : undefined),
      platform_status: item.platform_status,
      mal_status: item.mal_status,
      last_synced_episodes: item.episodesWatched,
      last_synced_status: item.mal_status
    });
    updatedCount++;
  }

  console.log(`✅ Updated state for ${updatedCount} entries in migrations/mappings.json.`);
}



