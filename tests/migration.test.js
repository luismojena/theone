import { test } from 'node:test';
import assert from 'node:assert';
import { normalize, extractSeason, cleanBaseTitle, normalizeJKAnimeStatus } from '../src/utils.js';
import { scoreMatch } from '../src/mal.js';
import { scoreMatchSimple } from '../src/jkanime.js';

test('Title Normalization', () => {
  assert.strictEqual(normalize(''), '');
  assert.strictEqual(normalize('Hönzuki no Gekokujou!'), 'honzukinogekokujou');
  assert.strictEqual(normalize('Frieren: Beyond Journey\'s End'), 'frierenbeyondjourneysend');
  assert.strictEqual(normalize('Sousou no Frieren 2nd Season'), 'sousounofrieren2ndseason');
});

test('Season Extraction', () => {
  assert.strictEqual(extractSeason('Frieren 2nd Season'), 2);
  assert.strictEqual(extractSeason('Medalist Season 3'), 3);
  assert.strictEqual(extractSeason('Tensei Shitara Slime Datta Ken S2'), 2);
  assert.strictEqual(extractSeason('Honzuki no Gekokujou III'), 3);
  assert.strictEqual(extractSeason('Honzuki no Gekokujou IV'), 4);
  assert.strictEqual(extractSeason('Frieren'), 1); // default
});

test('Base Title Cleaning', () => {
  assert.strictEqual(cleanBaseTitle('Frieren 2nd Season'), 'Frieren');
  assert.strictEqual(cleanBaseTitle('Medalist Season 3'), 'Medalist');
  assert.strictEqual(cleanBaseTitle('Honzuki no Gekokujou III'), 'Honzuki no Gekokujou');
  assert.strictEqual(cleanBaseTitle('Tensei Shitara Slime Datta Ken s4'), 'Tensei Shitara Slime Datta Ken');
});

test('JKanime Simple Matching Scores', () => {
  // Exact match
  assert.strictEqual(scoreMatchSimple('Sousou no Frieren', 'Sousou no Frieren'), 100);
  
  // Matching base and season
  assert.strictEqual(scoreMatchSimple('Sousou no Frieren 2nd Season', 'Sousou no Frieren Season 2'), 95);
  
  // Partial match
  assert.ok(scoreMatchSimple('Frieren', 'Sousou no Frieren') >= 60);
  
  // Mismatch season
  assert.strictEqual(scoreMatchSimple('Frieren 2nd Season', 'Frieren'), 60); // Partial without season match
});

test('MAL Candidate Matching Scores', () => {
  const candidate1 = {
    title: 'Honzuki no Gekokujou: Shisho ni Naru Tame ni wa Shudan wo Erandeiraremasen 3rd Season',
    titles: [
      { type: 'English', title: 'Ascendance of a Bookworm Season 3' }
    ]
  };

  // Match full title (partial season match yields 90 which is high confidence)
  assert.strictEqual(scoreMatch('Honzuki no Gekokujou 3rd Season', candidate1), 90);
  
  // Match synonym title (exact match yields 100)
  assert.strictEqual(scoreMatch('Ascendance of a Bookworm Season 3', candidate1), 100);
});

test('JKanime Status Normalization', () => {
  assert.strictEqual(normalizeJKAnimeStatus('Mirando'), 'Watching');
  assert.strictEqual(normalizeJKAnimeStatus('Viendo'), 'Watching');
  assert.strictEqual(normalizeJKAnimeStatus('Completado'), 'Completed');
  assert.strictEqual(normalizeJKAnimeStatus('Pausado'), 'On-Hold');
  assert.strictEqual(normalizeJKAnimeStatus('Abandonado'), 'Dropped');
  assert.strictEqual(normalizeJKAnimeStatus('Deseados'), 'Plan to Watch');
});

test('Live MAL Watchlist API Fetching Mock', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.includes('load.json')) {
      return {
        ok: true,
        json: async () => [
          { anime_id: 60, anime_title: 'Chrno Crusade', status: 1, num_watched_episodes: 0 },
          { anime_id: 20, anime_title: 'Naruto', status: 2, num_watched_episodes: 220 }
        ]
      };
    }
    return originalFetch(url);
  };

  const { fetchLiveMALWatchlist } = await import('../src/mal.js');
  const malMap = await fetchLiveMALWatchlist('testuser');

  assert.strictEqual(malMap.size, 2);
  assert.strictEqual(malMap.get(60).title, 'Chrno Crusade');
  assert.strictEqual(malMap.get(60).status, 'Watching');
  assert.strictEqual(malMap.get(20).status, 'Completed');

  global.fetch = originalFetch;
});



