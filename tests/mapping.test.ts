import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FileMappingRepository } from '../src/repositories/FileMappingRepository.js';

test('Load Mappings returns object dictionary', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapping-test-'));
  const repo = new FileMappingRepository(path.join(tmpDir, 'mappings.json'));
  const mappings = repo.loadMappings();
  assert.strictEqual(typeof mappings, 'object');
  assert.ok(mappings !== null);
});

test('Set and Get Mapping in Memory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapping-test-'));
  const repo = new FileMappingRepository(path.join(tmpDir, 'mappings.json'));
  
  repo.setMapping('jkanime', 'dummy-slug', 12345, 'Dummy Title', { last_synced_episodes: 5, last_synced_status: 'Watching' });

  const retrieved = repo.getMapping('jkanime', 'dummy-slug');
  assert.ok(retrieved !== null);
  assert.strictEqual(retrieved.mal_id, 12345);
  assert.strictEqual(retrieved.mal_title, 'Dummy Title');
  assert.strictEqual(retrieved.last_synced_episodes, 5);
  assert.strictEqual(retrieved.last_synced_status, 'Watching');
});
