import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { WatchlistEntry } from "../src/core/domain.js";
import { IAnimePlatform } from "../src/core/IAnimePlatform.js";
import { FileMappingRepository } from "../src/repositories/FileMappingRepository.js";
import { PlatformImporterService } from "../src/services/PlatformImporterService.js";

class MockTargetPlatform extends IAnimePlatform {
	get platformName() {
		return "mock_target";
	}
	async authenticate() {}
	async fetchWatchlist(): Promise<WatchlistEntry[]> {
		return [];
	}
	async updateEntryStatus() {}
	async searchAnime(query: string) {
		if (query === "Naruto") return [{ platform_id: "999", title: "Naruto Match", url: "/naruto" }];
		return [];
	}
}

test("PlatformImporterService maps missing entries", async () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "importer-test-"));
	const repo = new FileMappingRepository(path.join(tmpDir, "mappings.json"));

	// Create some existing MAL mappings for OTHER platforms
	repo.setMapping("jkanime", "naruto-slug", 10, "Naruto", {
		mal_status: "Watching",
	});
	repo.setMapping("jkanime", "bleach-slug", 20, "Bleach", {
		mal_status: "Completed",
	});

	// Also create one mapping that is ALREADY on mock_target (so it shouldn't be mapped again)
	repo.setMapping("mock_target", "bleach-mock", 20, "Bleach", {
		mal_status: "Completed",
	});

	const platform = new MockTargetPlatform();
	const importer = new PlatformImporterService(repo, platform);

	const mappedCount = await importer.mapMissingEntries();

	assert.strictEqual(mappedCount, 1);

	// Verify it mapped Naruto, but not Bleach
	const narutoMapping = repo.getMapping("mock_target", "999");
	assert.ok(narutoMapping);
	assert.strictEqual(narutoMapping.mal_id, 10);
	assert.strictEqual(narutoMapping.title, "Naruto Match");
});
