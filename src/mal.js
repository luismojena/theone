import fs from 'fs';
import zlib from 'zlib';
import * as cheerio from 'cheerio';
import {
  sleep,
  normalize,
  extractSeason,
  cleanBaseTitle,
  askQuestion,
  loadConfig,
  saveConfig,

  SCRAPED_FILE,
  RESOLVED_FILE,
  EXPORT_FILE,
  DATA_DIR,
  ensureDataDir
} from './utils.js';
import { loadMappings, setMapping, getMapping, getMappingByMalId, saveMappings, computeIncrementalDiff } from './mapping.js';



export function scoreMatch(originalTitle, candidate) {
  const origNorm = normalize(originalTitle);
  const candTitles = [
    candidate.title,
    ...(candidate.titles || []).map(t => t.title)
  ].filter(Boolean);

  let bestScore = 0;

  const origSeason = extractSeason(originalTitle);
  const origBase = cleanBaseTitle(originalTitle);
  const origBaseNorm = normalize(origBase);

  for (const candTitle of candTitles) {
    const candNorm = normalize(candTitle);
    
    // 1. Exact match
    if (candNorm === origNorm) {
      return 100;
    }

    const candSeason = extractSeason(candTitle);
    const candBase = cleanBaseTitle(candTitle);
    const candBaseNorm = normalize(candBase);

    // 2. Exact match of base title and matching season
    if (candBaseNorm === origBaseNorm && candSeason === origSeason) {
      bestScore = Math.max(bestScore, 95);
    } else if (candNorm.includes(origBaseNorm) && candSeason === origSeason) {
      bestScore = Math.max(bestScore, 90);
    } else if (candNorm.includes(origBaseNorm)) {
      bestScore = Math.max(bestScore, 60);
    }
  }

  return bestScore;
}

export async function searchMAL(query) {
  const url = `https://myanimelist.net/anime.php?q=${encodeURIComponent(query)}&cat=anime`;
  let attempt = 0;
  
  while (attempt < 5) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      
      if (res.status === 429 || res.status === 403) {
        const waitTime = (attempt + 1) * 5000;
        console.log(`[MAL] Rate limited or blocked (${res.status}). Retrying in ${waitTime / 1000}s...`);
        await sleep(waitTime);
        attempt++;
        continue;
      }
      
      if (!res.ok) {
        console.error(`[MAL] Search failed with status ${res.status}`);
        return [];
      }
      
      const html = await res.text();
      const $ = cheerio.load(html);
      const results = [];

      $('table tr').each((idx, el) => {
        const titleLink = $(el).find('div.title a.hoverinfo_trigger');
        if (titleLink.length === 0) return;

        const title = titleLink.find('strong').text().trim() || titleLink.text().trim();
        const href = titleLink.attr('href');
        if (!href) return;

        const malIdMatch = href.match(/\/anime\/(\d+)/);
        if (!malIdMatch) return;
        const mal_id = parseInt(malIdMatch[1], 10);

        const tds = $(el).find('td');
        const type = $(tds[2]).text().trim();
        const episodes = parseInt($(tds[3]).text().trim(), 10) || 0;
        const score = parseFloat($(tds[4]).text().trim()) || 0;

        results.push({
          mal_id,
          title,
          url: href,
          type,
          episodes,
          score
        });
      });

      return results;
    } catch (err) {
      console.error(`[MAL] Network error searching for "${query}":`, err.message);
      await sleep(3000);
      attempt++;
    }
  }
  return [];
}

export async function runResolve() {
  ensureDataDir();
  console.log('Resolving AnimeFLV titles to MyAnimeList IDs...');
  
  if (!fs.existsSync(SCRAPED_FILE)) {
    console.error(`Scraped file ${SCRAPED_FILE} not found. Run "scrape" command first.`);
    return;
  }
  
  const scrapedList = JSON.parse(fs.readFileSync(SCRAPED_FILE, 'utf8'));
  let resolvedList = [];
  
  if (fs.existsSync(RESOLVED_FILE)) {
    resolvedList = JSON.parse(fs.readFileSync(RESOLVED_FILE, 'utf8'));
    console.log(`Resuming using existing resolved.json with ${resolvedList.length} resolved entries.`);
  }

  const resolvedMap = new Map(resolvedList.map(item => [item.slug, item]));

  let matchedCount = 0;
  let unresolvedCount = 0;

  for (let i = 0; i < scrapedList.length; i++) {
    const item = scrapedList[i];
    const progress = `[${i + 1}/${scrapedList.length}]`;
    
    if (resolvedMap.has(item.slug)) {
      const existing = resolvedMap.get(item.slug);
      if (existing.status === 'matched') {
        matchedCount++;
        continue;
      }
    }

    const storedMapping = getMapping('animeflv', item.slug || item.title);
    if (storedMapping && storedMapping.mal_id) {
      const resolvedEntry = {
        ...item,
        status: 'matched',
        confidence: 'high',
        match: {
          mal_id: storedMapping.mal_id,
          title: storedMapping.mal_title,
          url: `https://myanimelist.net/anime/${storedMapping.mal_id}`,
          score: 100
        }
      };
      matchedCount++;
      const existingIndex = resolvedList.findIndex(x => x.slug === item.slug);
      if (existingIndex !== -1) {
        resolvedList[existingIndex] = resolvedEntry;
      } else {
        resolvedList.push(resolvedEntry);
      }
      resolvedMap.set(item.slug, resolvedEntry);
      console.log(`${progress} ⚡ INSTANT MAPPED (from mappings.json): "${item.title}" -> "${storedMapping.mal_title}" (ID: ${storedMapping.mal_id})`);
      continue;
    }

    console.log(`${progress} Resolving "${item.title}"...`);
    
    let candidates = await searchMAL(item.title);
    await sleep(1500); 

    let bestMatch = null;
    let bestScore = 0;

    for (const cand of candidates) {
      const score = scoreMatch(item.title, cand);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = cand;
      }
    }

    if (bestScore < 85) {
      const baseTitle = cleanBaseTitle(item.title);
      if (baseTitle && baseTitle !== item.title) {
        console.log(`  Low score (${bestScore}) for full title. Retrying base title: "${baseTitle}"...`);
        const fallbackCandidates = await searchMAL(baseTitle);
        await sleep(1500);

        for (const cand of fallbackCandidates) {
          const score = scoreMatch(item.title, cand);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = cand;
          }
        }
      }
    }

    let status = 'unmatched';
    let confidence = 'none';
    
    if (bestMatch && bestScore >= 85) {
      status = 'matched';
      confidence = 'high';
      matchedCount++;
      setMapping('animeflv', item.slug || item.title, bestMatch.mal_id, bestMatch.title, { title: item.title });
      console.log(`  ✅ MATCHED: "${item.title}" -> "${bestMatch.title}" (ID: ${bestMatch.mal_id}, Score: ${bestScore})`);
    } else if (bestMatch && bestScore >= 50) {
      status = 'low_confidence';
      confidence = 'low';
      unresolvedCount++;
      console.log(`  ⚠️ LOW CONFIDENCE: "${item.title}" -> "${bestMatch.title}" (ID: ${bestMatch.mal_id}, Score: ${bestScore})`);
    } else {
      unresolvedCount++;
      console.log(`  ❌ UNMATCHED: "${item.title}" (No good match found)`);
    }

    const resolvedEntry = {
      ...item,
      status,
      confidence,
      match: bestMatch ? {
        mal_id: bestMatch.mal_id,
        title: bestMatch.title,
        url: bestMatch.url,
        score: bestScore
      } : null
    };

    const existingIndex = resolvedList.findIndex(x => x.slug === item.slug);
    if (existingIndex !== -1) {
      resolvedList[existingIndex] = resolvedEntry;
    } else {
      resolvedList.push(resolvedEntry);
    }
    resolvedMap.set(item.slug, resolvedEntry);

    fs.writeFileSync(RESOLVED_FILE, JSON.stringify(resolvedList, null, 2));
  }

  console.log('\nResolution complete summary:');
  console.log(`- Matched entries: ${matchedCount}`);
  console.log(`- Unresolved/low-confidence entries: ${unresolvedCount}`);
  console.log(`Saved resolved results to ${RESOLVED_FILE}`);

}

export async function fetchMALDetails(malId) {
  const url = `https://myanimelist.net/anime/${malId}`;
  let attempt = 0;
  
  while (attempt < 5) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      
      if (res.status === 429 || res.status === 403) {
        const waitTime = (attempt + 1) * 5000;
        console.log(`[MAL] Rate limited or blocked (${res.status}). Retrying in ${waitTime / 1000}s...`);
        await sleep(waitTime);
        attempt++;
        continue;
      }
      
      if (!res.ok) {
        console.error(`[MAL] Fetch anime ID ${malId} failed with status ${res.status}`);
        return null;
      }
      
      const html = await res.text();
      const $ = cheerio.load(html);
      const title = $('h1.title-name strong').text().trim() || $('h1').first().text().trim();
      
      return {
        mal_id: malId,
        title: title || `Anime #${malId}`,
        url: url
      };
    } catch (err) {
      console.error(`[MAL] Network error fetching ID ${malId}:`, err.message);
      await sleep(3000);
      attempt++;
    }
  }
  return null;
}

export async function runReview() {
  ensureDataDir();
  if (!fs.existsSync(RESOLVED_FILE)) {
    console.error(`Resolved file ${RESOLVED_FILE} not found. Run "resolve" command first.`);
    return;
  }

  const resolvedList = JSON.parse(fs.readFileSync(RESOLVED_FILE, 'utf8'));
  const pending = resolvedList.filter(item => item.status !== 'matched');

  if (pending.length === 0) {
    console.log('All anime entries are matched! Nothing to review.');
    return;
  }

  console.log(`\nStarting interactive review. There are ${pending.length} pending unmatched or low-confidence entries.`);
  console.log('Commands:');
  console.log('  [number] - Accept suggestion number (if available)');
  console.log('  s <query> - Search Jikan for a custom title');
  console.log('  id <number> - Manually set a MyAnimeList ID');
  console.log('  k - Keep unmatched / skip');
  console.log('  q - Save and quit');

  for (let i = 0; i < resolvedList.length; i++) {
    const item = resolvedList[i];
    if (item.status === 'matched') continue;

    console.log(`\n========================================`);
    console.log(`AnimeFLV Title: "${item.title}" (${item.type})`);
    console.log(`Description: ${item.description ? item.description.substring(0, 150) + '...' : 'None'}`);
    
    const suggestions = [];
    if (item.match) {
      suggestions.push(item.match);
      console.log(`Suggestion [1]: "${item.match.title}" (ID: ${item.match.mal_id}, Score: ${item.match.score})`);
      console.log(`   Link: ${item.match.url}`);
    }

    let resolved = false;
    while (!resolved) {
      const input = await askQuestion(`Choose action (1${item.match ? '' : ''}/s <query>/id <val>/k/q): `);
      
      if (input.toLowerCase() === 'q') {
        console.log('Exiting review and saving progress.');
        fs.writeFileSync(RESOLVED_FILE, JSON.stringify(resolvedList, null, 2));
        return;
      }
      
      if (input.toLowerCase() === 'k') {
        console.log('Skipping...');
        resolved = true;
        continue;
      }

      if (input === '1' && suggestions.length > 0) {
        const choice = suggestions[0];
        item.status = 'matched';
        item.confidence = 'manual';
        item.match = choice;
        setMapping('animeflv', item.slug || item.title, choice.mal_id, choice.title, { title: item.title });
        console.log(`Accepted suggestion: "${choice.title}" (ID: ${choice.mal_id})`);
        resolved = true;
        fs.writeFileSync(RESOLVED_FILE, JSON.stringify(resolvedList, null, 2));
      } else if (input.startsWith('id ')) {
        const malId = parseInt(input.substring(3).trim(), 10);
        if (isNaN(malId)) {
          console.log('Invalid MAL ID.');
          continue;
        }
        console.log(`Fetching info for MAL ID: ${malId}...`);
        const malDetails = await fetchMALDetails(malId);
        if (malDetails) {
          item.status = 'matched';
          item.confidence = 'manual';
          item.match = {
            mal_id: malDetails.mal_id,
            title: malDetails.title,
            url: malDetails.url,
            score: 100
          };
          setMapping('animeflv', item.slug || item.title, malDetails.mal_id, malDetails.title, { title: item.title });
          console.log(`Assigned: "${malDetails.title}" (ID: ${malDetails.mal_id})`);
          resolved = true;
          fs.writeFileSync(RESOLVED_FILE, JSON.stringify(resolvedList, null, 2));
        } else {
          console.log('Failed to fetch details for this MAL ID. Please verify the ID.');
        }
      } else if (input.startsWith('s ')) {
        const query = input.substring(2).trim();
        console.log(`Searching Jikan for "${query}"...`);
        const searchResults = await searchMAL(query);
        await sleep(1500);
        
        if (searchResults.length === 0) {
          console.log('No results found.');
          continue;
        }
        
        console.log('\nSearch Results:');
        searchResults.slice(0, 5).forEach((cand, idx) => {
          console.log(`  [${idx + 1}] "${cand.title}" (${cand.type}) - ID: ${cand.mal_id}`);
          console.log(`      Link: ${cand.url}`);
        });

        const choiceInput = await askQuestion('Select result number to assign (or press Enter to search again): ');
        const choiceIdx = parseInt(choiceInput, 10) - 1;
        if (choiceIdx >= 0 && choiceIdx < searchResults.length) {
          const selected = searchResults[choiceIdx];
          item.status = 'matched';
          item.confidence = 'manual';
          item.match = {
            mal_id: selected.mal_id,
            title: selected.title,
            url: selected.url,
            score: 100
          };
          setMapping('animeflv', item.slug || item.title, selected.mal_id, selected.title, { title: item.title });
          console.log(`Assigned: "${selected.title}" (ID: ${selected.mal_id})`);
          resolved = true;
          fs.writeFileSync(RESOLVED_FILE, JSON.stringify(resolvedList, null, 2));
        }
      } else {
        console.log('Invalid input. Enter a choice or one of the commands.');
      }

    }
  }

  console.log('\nAll pending items reviewed!');
  fs.writeFileSync(RESOLVED_FILE, JSON.stringify(resolvedList, null, 2));
}

export async function fetchLiveMALWatchlist(username) {

  const malMap = new Map();
  let offset = 0;
  let hasMore = true;

  const statusNumMap = {
    1: 'Watching',
    2: 'Completed',
    3: 'On-Hold',
    4: 'Dropped',
    6: 'Plan to Watch'
  };

  while (hasMore) {
    try {
      const url = `https://myanimelist.net/animelist/${encodeURIComponent(username)}/load.json?offset=${offset}&status=7`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        console.warn(`⚠️ Could not fetch live MAL list for "${username}" (HTTP ${res.status}).`);
        break;
      }

      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of items) {
        if (item.anime_id) {
          malMap.set(Number(item.anime_id), {
            mal_id: Number(item.anime_id),
            title: item.anime_title,
            num_watched_episodes: item.num_watched_episodes || 0,
            status_num: item.status,
            status: statusNumMap[item.status] || 'Watching',
            score: item.score || 0
          });
        }
      }

      if (items.length < 300) {
        hasMore = false;
      } else {
        offset += 300;
        await sleep(500);
      }
    } catch (err) {
      console.warn(`⚠️ Error fetching live MAL list for "${username}": ${err.message}`);
      break;
    }
  }

  return malMap;
}

export async function resolveUnmappedMappings() {
  const mappings = loadMappings();
  const unmappedKeys = Object.keys(mappings).filter(k => (!mappings[k].mal_id || mappings[k].mal_id === 0) && mappings[k].title && !mappings[k].title.includes('Detalles'));

  if (unmappedKeys.length === 0) {
    return 0;
  }

  console.log(`Resolving ${unmappedKeys.length} unmapped entries in mappings.json...`);
  let resolvedCount = 0;

  for (const key of unmappedKeys) {
    const entry = mappings[key];
    const cleanTitle = cleanBaseTitle(entry.title || entry.platform_id);
    if (!cleanTitle || cleanTitle.length < 3) continue;

    try {
      const candidates = await searchMAL(cleanTitle);
      await sleep(1000);

      if (candidates && candidates.length > 0) {
        let bestCandidate = null;
        let bestScore = 0;

        for (const cand of candidates) {
          const sc = scoreMatch(cleanTitle, cand);
          if (sc > bestScore) {
            bestScore = sc;
            bestCandidate = cand;
          }
        }

        if (bestCandidate && bestScore >= 70) {
          console.log(`  ✅ Resolved [${bestScore}%]: "${cleanTitle}" -> "${bestCandidate.title}" (ID: ${bestCandidate.mal_id})`);
          setMapping(entry.platform, entry.platform_id, bestCandidate.mal_id, bestCandidate.title, {
            title: entry.title,
            platform_status: entry.platform_status,
            mal_status: entry.mal_status || entry.last_synced_status,
            last_synced_episodes: entry.last_synced_episodes,
            last_synced_status: entry.mal_status || entry.last_synced_status
          });
          resolvedCount++;
        }
      }
    } catch (e) {
      console.warn(`Could not resolve "${cleanTitle}": ${e.message}`);
    }
  }

  if (resolvedCount > 0) {
    console.log(`✅ Auto-resolved ${resolvedCount} unmapped entries in mappings.json.`);
  }
  return resolvedCount;
}

export async function runExport() {
  ensureDataDir();
  console.log('--- Exporting resolved matches to MyAnimeList XML ---');

  const config = loadConfig();
  let username = process.env.MAL_USER || config.mal_user;

  if (!username) {
    username = await askQuestion('Enter your MyAnimeList Username (press Enter to skip live diff): ');
    if (username) {
      config.mal_user = username;
      saveConfig(config);
    }
  }

  let liveMalMap = new Map();
  if (username) {
    console.log(`Fetching live MyAnimeList watchlist for user "${username}"...`);
    liveMalMap = await fetchLiveMALWatchlist(username);
    if (liveMalMap.size > 0) {
      console.log(`✅ Successfully fetched ${liveMalMap.size} live entries from MyAnimeList.`);
    }
  }

  // Auto-resolve any unmapped entries from JKanime/other platforms
  await resolveUnmappedMappings();

  const mappings = loadMappings();
  const matchedMap = new Map();

  if (fs.existsSync(RESOLVED_FILE)) {
    const resolvedList = JSON.parse(fs.readFileSync(RESOLVED_FILE, 'utf8'));
    for (const item of resolvedList) {
      if (item.status === 'matched' && item.match && item.match.mal_id) {
        matchedMap.set(Number(item.match.mal_id), {
          match: item.match,
          slug: item.slug || item.title
        });
      }
    }
  }

  for (const entry of Object.values(mappings)) {
    if (entry.mal_id && Number(entry.mal_id) > 0) {
      matchedMap.set(Number(entry.mal_id), {
        match: { mal_id: Number(entry.mal_id), title: entry.mal_title || entry.title },
        slug: entry.platform_id
      });
    }
  }

  const matched = Array.from(matchedMap.values());


  if (matched.length === 0) {
    console.warn('No matched entries found in resolved.json. Nothing to export.');
    return;
  }

  const newEntries = [];
  const statusChanges = [];
  const episodeChanges = [];
  const unchangedEntries = [];
  const statusCounts = { Completed: 0, Watching: 0, 'Plan to Watch': 0, 'On-Hold': 0, Dropped: 0 };

  for (const item of matched) {
    const malId = Number(item.match.mal_id);
    const storedMapping = getMappingByMalId(malId) || getMapping('jkanime', item.slug || item.title) || getMapping('animeflv', item.slug || item.title);
    const targetStatus = (storedMapping && (storedMapping.mal_status || storedMapping.last_synced_status)) || 'Watching';
    const targetEpisodes = (storedMapping && storedMapping.last_synced_episodes) || 0;

    statusCounts[targetStatus] = (statusCounts[targetStatus] || 0) + 1;

    if (liveMalMap.size > 0) {
      const liveEntry = liveMalMap.get(malId);
      if (!liveEntry) {
        newEntries.push({ malId, title: item.match.title, status: targetStatus });
      } else {
        const statusDiff = liveEntry.status !== targetStatus;
        const epDiff = liveEntry.num_watched_episodes !== targetEpisodes;

        if (statusDiff || epDiff) {
          if (statusDiff) {
            statusChanges.push({
              malId,
              title: item.match.title,
              oldStatus: liveEntry.status,
              newStatus: targetStatus
            });
          }
          if (epDiff) {
            episodeChanges.push({
              malId,
              title: item.match.title,
              oldEp: liveEntry.num_watched_episodes,
              newEp: targetEpisodes
            });
          }
        } else {
          unchangedEntries.push({ malId, title: item.match.title });
        }
      }
    }
  }

  console.log('\n================ EXPORT & DIFF BREAKDOWN ================');
  console.log(`Total Mapped Titles to Export: ${matched.length}`);

  if (liveMalMap.size > 0) {
    console.log(`Live MAL List Entries: ${liveMalMap.size}`);
    console.log(`\n🆕 New Series to be Added to MAL: ${newEntries.length}`);
    if (newEntries.length > 0) {
      newEntries.slice(0, 5).forEach(e => console.log(`   + [${e.malId}] ${e.title} (${e.status})`));
      if (newEntries.length > 5) console.log(`   ... and ${newEntries.length - 5} more.`);
    }

    console.log(`\n🔄 Status Changes vs Live MAL: ${statusChanges.length}`);
    if (statusChanges.length > 0) {
      statusChanges.slice(0, 10).forEach(c => console.log(`   ~ [${c.malId}] ${c.title}: "${c.oldStatus}" -> "${c.newStatus}"`));
      if (statusChanges.length > 10) console.log(`   ... and ${statusChanges.length - 10} more.`);
    }

    console.log(`\n⏩ Unchanged Series: ${unchangedEntries.length}`);
  } else {
    console.log('\nStatus Breakdown in Export:');
    Object.entries(statusCounts).forEach(([st, cnt]) => {
      if (cnt > 0) console.log(`- ${st}: ${cnt}`);
    });
  }

  console.log('=========================================================\n');

  let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<!--
Created by AnimeFLV / JKanime to MyAnimeList Migration Tool
-->
<myanimelist>
  <myinfo>
    <user_export_type>1</user_export_type>
  </myinfo>\n`;

  for (const item of matched) {
    const malId = item.match.mal_id;
    const malTitle = item.match.title;
    
    const storedMapping = getMappingByMalId(malId) || getMapping('jkanime', item.slug || item.title) || getMapping('animeflv', item.slug || item.title);
    const itemStatus = (storedMapping && (storedMapping.mal_status || storedMapping.last_synced_status)) || 'Watching';
    const itemEpisodes = (storedMapping && storedMapping.last_synced_episodes) || 0;

    xml += `  <anime>
    <series_animedb_id>${malId}</series_animedb_id>
    <series_title><![CDATA[${malTitle}]]></series_title>
    <my_id>0</my_id>
    <my_watched_episodes>${itemEpisodes}</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>0</my_score>
    <my_status>${itemStatus}</my_status>
    <my_rewatching>0</my_rewatching>
    <my_rewatching_ep>0</my_rewatching_ep>
    <my_last_updated>0</my_last_updated>
    <my_tags><![CDATA[]]></my_tags>
    <update_on_import>1</update_on_import>
  </anime>\n`;
  }

  xml += `</myanimelist>\n`;

  fs.writeFileSync(EXPORT_FILE, xml, 'utf8');

  console.log(`Export complete:`);
  console.log(`- Successfully exported ${matched.length} entries.`);
  console.log(`- Final import file saved to: ${EXPORT_FILE}`);
  console.log(`\nYou can now upload this file to MyAnimeList here: https://myanimelist.net/import.php\n`);
}

// ================= LIST COMPLETION LOGIC =================
const MAL_JIKAN_CACHE_FILE = `${DATA_DIR}/mal_jikan_cache.json`;
const COMPLETED_OUTPUT_FILE = `${DATA_DIR}/animelist_completed_import.xml`;

function loadJikanCache() {
  if (fs.existsSync(MAL_JIKAN_CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(MAL_JIKAN_CACHE_FILE, 'utf8'));
    } catch (err) {
      console.warn('Could not parse MAL Jikan cache file, starting fresh.');
    }
  }
  return {};
}

function saveJikanCache(cache) {
  fs.writeFileSync(MAL_JIKAN_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function isCacheFresh(entry) {
  if (!entry || !entry.last_updated) return false;
  const lastUpdated = new Date(entry.last_updated);
  const diffTime = Math.abs(new Date() - lastUpdated);
  const diffHours = diffTime / (1000 * 60 * 60);
  return diffHours < 24;
}

async function fetchCurrentSeasonAiring() {
  const airingMap = new Map();
  let page = 1;
  console.log('Fetching currently airing season list from Jikan to optimize requests...');
  
  while (true) {
    const url = `https://api.jikan.moe/v4/seasons/now?page=${page}`;
    let attempt = 0;
    let pageData = null;

    while (attempt < 5) {
      try {
        console.log(`  [Jikan] Fetching season page ${page}...`);
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        if (res.status === 429 || res.status === 403) {
          const waitTime = (attempt + 1) * 3000;
          console.warn(`  [Jikan] Rate limited on page ${page}. Waiting ${waitTime / 1000}s...`);
          await sleep(waitTime);
          attempt++;
          continue;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        pageData = await res.json();
        break;
      } catch (err) {
        console.error(`  [Jikan] Error on page ${page} (attempt ${attempt + 1}):`, err.message);
        await sleep(2000);
        attempt++;
      }
    }

    if (!pageData || !pageData.data || pageData.data.length === 0) {
      break;
    }

    for (const anime of pageData.data) {
      if (anime.mal_id) {
        airingMap.set(anime.mal_id.toString(), {
          status: anime.status,
          total_episodes: anime.episodes || 0
        });
      }
    }

    if (!pageData.pagination || !pageData.pagination.has_next_page) {
      break;
    }

    page++;
    await sleep(1500);
  }

  console.log(`[Jikan] Finished season fetch. Found ${airingMap.size} currently airing anime.`);
  return airingMap;
}

async function fetchJikanStatusFallback(animeId, cache) {
  if (cache[animeId] && isCacheFresh(cache[animeId])) {
    return cache[animeId];
  }

  const url = `https://api.jikan.moe/v4/anime/${animeId}`;
  let attempt = 0;
  
  while (attempt < 5) {
    try {
      console.log(`  [Jikan] Fetching status for Anime ID ${animeId}...`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (res.status === 429 || res.status === 403) {
        const waitTime = (attempt + 1) * 3000;
        console.warn(`  [Jikan] Rate limited (Status ${res.status}). Waiting ${waitTime / 1000}s...`);
        await sleep(waitTime);
        attempt++;
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const body = await res.json();
      const animeData = body.data;
      if (!animeData) {
        throw new Error('No data field in response');
      }

      const status = animeData.status;
      const totalEpisodes = animeData.episodes || 0;

      const cacheEntry = {
        status,
        total_episodes: totalEpisodes,
        aired_count: null,
        last_updated: new Date().toISOString()
      };

      cache[animeId] = cacheEntry;
      saveJikanCache(cache);
      return cacheEntry;
    } catch (err) {
      console.error(`  [Jikan] Error fetching ID ${animeId} status (attempt ${attempt + 1}):`, err.message);
      await sleep(2000);
      attempt++;
    }
  }

  return null;
}

async function fetchAiredEpisodesCount(animeId, cacheEntry, cache) {
  if (cacheEntry.aired_count !== null && isCacheFresh(cacheEntry)) {
    return cacheEntry.aired_count;
  }

  const url = `https://api.jikan.moe/v4/anime/${animeId}/episodes`;
  let attempt = 0;

  while (attempt < 5) {
    try {
      console.log(`  [Jikan] Fetching episode list for currently airing Anime ID ${animeId}...`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (res.status === 429 || res.status === 403) {
        const waitTime = (attempt + 1) * 3000;
        console.warn(`  [Jikan] Rate limited (Status ${res.status}). Waiting ${waitTime / 1000}s...`);
        await sleep(waitTime);
        attempt++;
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const body = await res.json();
      const episodes = body.data || [];
      
      const now = new Date();
      const airedEpisodes = episodes.filter(ep => {
        if (!ep.aired) return false;
        const airDate = new Date(ep.aired);
        return airDate <= now;
      });

      const count = airedEpisodes.length;
      cacheEntry.aired_count = count;
      cacheEntry.last_updated = new Date().toISOString();
      cache[animeId] = cacheEntry;
      saveJikanCache(cache);
      return count;
    } catch (err) {
      console.error(`  [Jikan] Error fetching ID ${animeId} episodes (attempt ${attempt + 1}):`, err.message);
      await sleep(2000);
      attempt++;
    }
  }

  return 0;
}

export async function completeMALWatching() {
  ensureDataDir();
  console.log('--- MyAnimeList Export "Watching" to "Completed" Updater ---');

  let exportFile = null;
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR);
    const found = files.find(f => f.startsWith('animelist_') && (f.endsWith('.xml') || f.endsWith('.xml.gz')));
    if (found) {
      exportFile = `${DATA_DIR}/${found}`;
    }
  }

  if (!exportFile) {
    const files = fs.readdirSync('./');
    const found = files.find(f => f.startsWith('animelist_') && (f.endsWith('.xml') || f.endsWith('.xml.gz')));
    if (found) {
      exportFile = `./${found}`;
    }
  }

  if (!exportFile) {
    console.error(`❌ Could not find MyAnimeList export file (animelist_*.xml or animelist_*.xml.gz) in the current directory or ${DATA_DIR}.`);
    return;
  }

  console.log(`Found MyAnimeList export file: ${exportFile}`);

  let xmlContent;
  const fileBuffer = fs.readFileSync(exportFile);

  if (exportFile.endsWith('.gz')) {
    console.log('Decompressing gzip export file...');
    xmlContent = zlib.gunzipSync(fileBuffer).toString('utf8');
  } else {
    xmlContent = fileBuffer.toString('utf8');
  }

  const $ = cheerio.load(xmlContent, { xmlMode: true });
  const animeNodes = $('anime');

  console.log(`Total anime entries in file: ${animeNodes.length}`);

  const watchingEntries = [];
  animeNodes.each((idx, el) => {
    const status = $(el).find('my_status').text().trim();
    if (status.toLowerCase() === 'watching') {
      watchingEntries.push(el);
    }
  });

  console.log(`Currently watching entries found: ${watchingEntries.length}`);

  if (watchingEntries.length === 0) {
    console.log('No "Watching" entries to complete. Exiting.');
    return;
  }

  const cache = loadJikanCache();
  const currentSeasonAiring = await fetchCurrentSeasonAiring();

  let completedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < watchingEntries.length; i++) {
    const el = watchingEntries[i];
    const animeId = $(el).find('series_animedb_id').text().trim();
    const title = $(el).find('series_title').text().trim();
    const currentProgress = parseInt($(el).find('my_watched_episodes').text().trim(), 10) || 0;
    const progressNode = $(el).find('my_watched_episodes');
    const statusNode = $(el).find('my_status');
    const updateNode = $(el).find('update_on_import');
    const seriesEpisodesNode = $(el).find('series_episodes');
    const totalEpisodes = parseInt(seriesEpisodesNode.text().trim(), 10) || 0;

    const progressMsg = `[${i + 1}/${watchingEntries.length}]`;
    console.log(`\n--------------------------------------------------`);
    console.log(`${progressMsg} Analyzing: "${title}" (ID: ${animeId})`);

    if (totalEpisodes > 0 && !currentSeasonAiring.has(animeId)) {
      console.log(`  (Optimized: Determined Finished Airing without API call)`);
      console.log(`  Status: Finished Airing (Total episodes: ${totalEpisodes})`);
      console.log(`  Updating: ${currentProgress}/${totalEpisodes} -> ${totalEpisodes}/${totalEpisodes}. Marking as Completed.`);
      
      progressNode.text(totalEpisodes.toString());
      statusNode.text('Completed');

      if (updateNode.length) {
        updateNode.text('1');
      } else {
        $(el).append('    <update_on_import>1</update_on_import>\n  ');
      }
      completedCount++;
      continue;
    }

    let result = cache[animeId];
    
    if (currentSeasonAiring.has(animeId)) {
      const airingDetails = currentSeasonAiring.get(animeId);
      result = {
        status: airingDetails.status,
        total_episodes: airingDetails.total_episodes,
        aired_count: result ? result.aired_count : null,
        last_updated: new Date().toISOString()
      };
      cache[animeId] = result;
      saveJikanCache(cache);
    }

    if (!result) {
      result = await fetchJikanStatusFallback(animeId, cache);
      await sleep(1500);
    }

    if (!result) {
      console.error(`  ❌ Failed to fetch info from Jikan API for "${title}". Skipping.`);
      errorCount++;
      continue;
    }

    if (result.status === 'Currently Airing') {
      console.log(`  Status: Currently Airing`);
      const airedCount = await fetchAiredEpisodesCount(animeId, result, cache);
      await sleep(1500);

      if (airedCount > 0) {
        console.log(`  Updating: ${currentProgress} watched -> ${airedCount} aired. Marking as Completed.`);
        progressNode.text(airedCount.toString());
        statusNode.text('Completed');
        
        if (updateNode.length) {
          updateNode.text('1');
        } else {
          $(el).append('    <update_on_import>1</update_on_import>\n  ');
        }
        completedCount++;
      } else {
        console.log(`  ⚠️ Skipped: 0 episodes have aired yet.`);
        skippedCount++;
      }
    } else if (result.status === 'Finished Airing') {
      const totalEp = result.total_episodes || totalEpisodes;
      console.log(`  Status: Finished Airing (Total episodes: ${totalEp})`);
      
      if (totalEp > 0) {
        console.log(`  Updating: ${currentProgress}/${totalEp} -> ${totalEp}/${totalEp}. Marking as Completed.`);
        progressNode.text(totalEp.toString());
        statusNode.text('Completed');
        seriesEpisodesNode.text(totalEp.toString());

        if (updateNode.length) {
          updateNode.text('1');
        } else {
          $(el).append('    <update_on_import>1</update_on_import>\n  ');
        }
        completedCount++;
      } else {
        console.warn(`  ⚠️ Skipped: Finished airing but total episodes count is unknown (0).`);
        skippedCount++;
      }
    } else {
      console.log(`  ⚠️ Skipped: Anime status is "${result.status}" (Not airing/finished).`);
      skippedCount++;
    }
  }

  const updatedXml = $.xml();
  fs.writeFileSync(COMPLETED_OUTPUT_FILE, updatedXml, 'utf8');

  console.log(`\n==================================================`);
  console.log('Update process complete!');
  console.log(`- Saved updated import file to: ${COMPLETED_OUTPUT_FILE}`);
  console.log(`Summary:`);
  console.log(`  - Marked Completed: ${completedCount}`);
  console.log(`  - Skipped (Airing with 0 eps/Not yet aired): ${skippedCount}`);
  console.log(`  - Errors/Failed to fetch: ${errorCount}`);
  console.log(`\nYou can now upload ${COMPLETED_OUTPUT_FILE} to MyAnimeList here: https://myanimelist.net/import.php`);
}
