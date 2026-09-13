import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { FileMappingRepository } from "../src/repositories/FileMappingRepository.js";

test("Load Mappings returns object dictionary", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mapping-test-"));
	const repo = new FileMappingRepository(path.join(tmpDir, "mappings.json"));
	const mappings = repo.loadMappings();
	assert.strictEqual(typeof mappings, "object");
	assert.ok(mappings !== null);
});

test("Set and Get Mapping in Memory", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mapping-test-"));
	const repo = new FileMappingRepository(path.join(tmpDir, "mappings.json"));

	repo.setMapping("jkanime", "dummy-slug", 12345, "Dummy Title", {
		last_synced_episodes: 5,
		last_synced_status: "Watching",
	});

	const retrieved = repo.getMapping("jkanime", "dummy-slug");
	assert.ok(retrieved !== null);
	assert.strictEqual(retrieved.mal_id, 12345);
	assert.strictEqual(retrieved.mal_title, "Dummy Title");
	assert.strictEqual(retrieved.last_synced_episodes, 5);
	assert.strictEqual(retrieved.last_synced_status, "Watching");
});

test("setMapping explicit arguments strictly override extraData (Anti-Race Condition)", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mapping-test-"));
	const repo = new FileMappingRepository(path.join(tmpDir, "mappings.json"));

	// Act: Pass old corrupted data inside extraData to try and trick the repository
	const extraData = {
		mal_id: 0,
		mal_title: "Detalles",
		title: "Old Local Title",
	};

	repo.setMapping("jkanime", "one-piece", 21, "One Piece", extraData);

	// Assert: The explicit arguments MUST win, but the non-conflicting fields MUST be preserved
	const retrieved = repo.getMapping("jkanime", "one-piece");
	assert.ok(retrieved !== null);
	assert.strictEqual(retrieved.mal_id, 21);
	assert.strictEqual(retrieved.mal_title, "One Piece");
	assert.strictEqual(retrieved.title, "Old Local Title"); // The non-conflicting field should be perfectly merged
});
