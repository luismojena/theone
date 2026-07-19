import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import {
  loadMappings,
  saveMappings,
  getMapping,
  setMapping,
  computeIncrementalDiff,
  buildMappingKey
} from '../src/mapping.js';
import { MAPPINGS_FILE } from '../src/utils.js';

test('Build Mapping Key', () => {
  assert.strictEqual(buildMappingKey('jkanime', 'naruto-shippuden'), 'jkanime:naruto-shippuden');
  assert.strictEqual(buildMappingKey('animeflv', 'one-piece'), 'animeflv:one-piece');
});

test('Load Mappings returns object dictionary', () => {
  const mappings = loadMappings();
  assert.strictEqual(typeof mappings, 'object');
  assert.ok(mappings !== null);
});

test('Set and Get Mapping in Memory', () => {
  const dummyMappings = {};
  setMapping('jkanime', 'dummy-slug', 12345, 'Dummy Title', { last_synced_episodes: 5, last_synced_status: 'Watching' }, dummyMappings);

  const retrieved = getMapping('jkanime', 'dummy-slug', dummyMappings);
  assert.ok(retrieved !== null);
  assert.strictEqual(retrieved.mal_id, 12345);
  assert.strictEqual(retrieved.mal_title, 'Dummy Title');
  assert.strictEqual(retrieved.last_synced_episodes, 5);
  assert.strictEqual(retrieved.last_synced_status, 'Watching');
});

test('Compute Incremental Diff (New, Modified, Unchanged)', () => {
  const testMappings = {
    'jkanime:show-1': {
      platform: 'jkanime',
      platform_id: 'show-1',
      mal_id: 101,
      mal_title: 'Show One',
      last_synced_episodes: 10,
      last_synced_status: 'Watching'
    },
    'jkanime:show-2': {
      platform: 'jkanime',
      platform_id: 'show-2',
      mal_id: 102,
      mal_title: 'Show Two',
      last_synced_episodes: 12,
      last_synced_status: 'Completed'
    }
  };

  const incomingList = [
    { slug: 'show-1', title: 'Show One', episodesWatched: 12, status: 'Watching' }, // Modified episode count
    { slug: 'show-2', title: 'Show Two', episodesWatched: 12, status: 'Completed' }, // Unchanged
    { slug: 'show-3', title: 'Show Three', episodesWatched: 1, status: 'Watching' }   // New (unmapped)
  ];

  const diff = computeIncrementalDiff(incomingList, 'jkanime', testMappings);

  assert.strictEqual(diff.newEntries.length, 1);
  assert.strictEqual(diff.newEntries[0].slug, 'show-3');

  assert.strictEqual(diff.modifiedEntries.length, 1);
  assert.strictEqual(diff.modifiedEntries[0].slug, 'show-1');
  assert.strictEqual(diff.modifiedEntries[0].mal_id, 101);
  assert.strictEqual(diff.modifiedEntries[0].previous_episodes, 10);

  assert.strictEqual(diff.unchangedEntries.length, 1);
  assert.strictEqual(diff.unchangedEntries[0].slug, 'show-2');
});
