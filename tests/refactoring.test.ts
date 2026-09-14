import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { WatchStatus } from "../src/core/domain.js";
import { AnimeFLVPlatform } from "../src/platforms/AnimeFLVPlatform.js";
import { JKAnimePlatform } from "../src/platforms/JKAnimePlatform.js";
import { MALPlatform } from "../src/platforms/MALPlatform.js";
import { FileMappingRepository } from "../src/repositories/FileMappingRepository.js";
import { MalResolutionService } from "../src/services/MalResolutionService.js";
import { MyAnimeListExportService } from "../src/services/MyAnimeListExportService.js";
import { PlatformImporterService } from "../src/services/PlatformImporterService.js";

test("MyAnimeListExportService generates correct XML", () => {
	const service = new MyAnimeListExportService();
	const matched = [
		{
			mal_id: 10,
			mal_title: "Naruto",
			mal_status: WatchStatus.WATCHING,
			last_synced_episodes: 5,
		},
		{
			mal_id: 21,
			mal_title: "One Piece",
			mal_status: WatchStatus.COMPLETED,
			last_synced_episodes: 1000,
		},
	];

	const xml = service.generateMyAnimeListXml(matched);
	assert.ok(xml.includes("<series_animedb_id>10</series_animedb_id>"));
	assert.ok(xml.includes("<series_title><![CDATA[Naruto]]></series_title>"));
	assert.ok(xml.includes("<my_watched_episodes>5</my_watched_episodes>"));
	assert.ok(xml.includes(`<my_status>${WatchStatus.WATCHING}</my_status>`));

	assert.ok(xml.includes("<series_animedb_id>21</series_animedb_id>"));
	assert.ok(xml.includes("<series_title><![CDATA[One Piece]]></series_title>"));
	assert.ok(xml.includes("<my_watched_episodes>1000</my_watched_episodes>"));
	assert.ok(xml.includes(`<my_status>${WatchStatus.COMPLETED}</my_status>`));
});

test("PlatformImporterService extracts unmapped mal items correctly", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "importer-extract-"));
	const repo = new FileMappingRepository(path.join(tmpDir, "mappings.json"));
	const platform = new MALPlatform();
	const service = new PlatformImporterService(repo, platform);

	const allMappings = {
		"mal:10": { mal_id: 10, mal_title: "Naruto", platform: "mal", platform_id: "10" },
		"jkanime:naruto": {
			mal_id: 10,
			mal_title: "Naruto",
			platform: "jkanime",
			platform_id: "naruto",
		},
		"mal:20": { mal_id: 20, mal_title: "Bleach", platform: "mal", platform_id: "20" },
	};

	const unmappedForJKAnime = service.extractUnmappedMalItems(allMappings, "jkanime");
	assert.strictEqual(unmappedForJKAnime.length, 1);
	assert.strictEqual(unmappedForJKAnime[0][0], 20); // Bleach is missing from jkanime

	const unmappedForAnimeFLV = service.extractUnmappedMalItems(allMappings, "animeflv");
	assert.strictEqual(unmappedForAnimeFLV.length, 2); // Both Naruto and Bleach missing from animeflv
});

test("MalResolutionService triggers fallback logic", async () => {
	const malPlatform = new MALPlatform();

	// Mock the search Anime to fail on first attempt and succeed on stripped attempt
	const originalSearch = malPlatform.searchAnime.bind(malPlatform);
	let callCount = 0;
	malPlatform.searchAnime = async (query: string) => {
		callCount++;
		if (query === "Bleach: Thousand-Year Blood War") return []; // fail on exact
		if (query === "Bleach Thousand Year Blood War")
			return [{ platform_id: "123", title: "Bleach", url: "" }]; // succeed on stripped
		return [];
	};

	try {
		const service = new MalResolutionService(malPlatform);
		const results = await service.searchAnimeWithFallbacks(
			"Bleach: Thousand-Year Blood War",
			"bleach-tybw",
		);
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].platform_id, "123");
		assert.strictEqual(callCount, 2);
	} finally {
		malPlatform.searchAnime = originalSearch;
	}
});

test("JKAnimePlatform calculates jitter delay correctly", () => {
	const platform = new JKAnimePlatform();

	const delay1 = platform.calculateJitterDelay(undefined, undefined);
	assert.ok(delay1 >= 200 && delay1 <= 300); // Default delay is 200, default jitter is 0-100

	const delay2 = platform.calculateJitterDelay("500", "0-0");
	assert.strictEqual(delay2, 500);

	const delay3 = platform.calculateJitterDelay("1000", "500-500");
	assert.strictEqual(delay3, 1500);
});

test("AnimeFLVPlatform parses HTML correctly", () => {
	const platform = new AnimeFLVPlatform();
	const html = `
		<ul class="ListAnimes">
			<li><h3 class="Title"><a href="/anime/naruto">Naruto</a></h3></li>
			<li><h3 class="Title"><a href="/anime/bleach">Bleach</a></h3></li>
		</ul>
	`;

	const entries = platform.parseWatchlistPageHtml(html);
	assert.ok(entries);
	assert.strictEqual(entries.length, 2);
	assert.strictEqual(entries[0].platformId, "naruto");
	assert.strictEqual(entries[0].title, "Naruto");
	assert.strictEqual(entries[1].platformId, "bleach");
	assert.strictEqual(entries[1].title, "Bleach");
});

test("AnimeFLVPlatform parsing handles empty html", () => {
	const platform = new AnimeFLVPlatform();
	const html = `<ul class="ListAnimes"></ul>`;

	const entries = platform.parseWatchlistPageHtml(html);
	assert.strictEqual(entries, null);
});
