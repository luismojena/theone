import { test } from 'node:test';
import assert from 'node:assert';
import { normalize, extractSeason, cleanBaseTitle, normalizeJKAnimeStatus } from '../src/utils.js';
test('normalize strings correctly', () => {
    assert.strictEqual(normalize('Attack on Titan: Season 2!'), 'attackontitanseason2');
    assert.strictEqual(normalize(''), '');
});
test('extractSeason parses title formats', () => {
    assert.strictEqual(extractSeason('Boku no Hero Academia 2nd Season'), 2);
    assert.strictEqual(extractSeason('Attack on Titan Season 3'), 3);
    assert.strictEqual(extractSeason('One Punch Man'), 1);
});
test('cleanBaseTitle strips extra qualifiers', () => {
    assert.strictEqual(cleanBaseTitle('Boku no Hero Academia 2nd Season'), 'Boku no Hero Academia');
    assert.strictEqual(cleanBaseTitle('Spy x Family Part 2'), 'Spy x Family');
    assert.strictEqual(cleanBaseTitle('Bleach - Sennen Kessen-hen'), 'Bleach');
    assert.strictEqual(cleanBaseTitle('Naruto: Shippuden'), 'Naruto');
});
test('normalizeJKAnimeStatus maps Spanish statuses to standard statuses', () => {
    assert.strictEqual(normalizeJKAnimeStatus('Viendo'), 'Watching');
    assert.strictEqual(normalizeJKAnimeStatus('Completado'), 'Completed');
    assert.strictEqual(normalizeJKAnimeStatus('En Espera'), 'On-Hold');
    assert.strictEqual(normalizeJKAnimeStatus('Abandonado'), 'Dropped');
    assert.strictEqual(normalizeJKAnimeStatus('Lo Planeo Ver'), 'Plan to Watch');
    assert.strictEqual(normalizeJKAnimeStatus('Unknown'), 'Watching'); // Fallback
});
