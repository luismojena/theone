import assert from "node:assert";
import fs from "node:fs";
import { mock, test } from "node:test";
import { runFetchAnimeAV1List, runSyncAnimeAV1 } from "../../src/cli/animeav1Cli.js";
import { runFetchJKAnimeList } from "../../src/cli/jkanimeCli.js";
import { runExport } from "../../src/cli/malCli.js";
import { WatchlistEntry, WatchStatus } from "../../src/core/domain.js";
import { AnimeAV1Platform } from "../../src/platforms/AnimeAV1Platform.js";
import { JKAnimePlatform } from "../../src/platforms/JKAnimePlatform.js";
import { MALPlatform } from "../../src/platforms/MALPlatform.js";
import { FileMappingRepository } from "../../src/repositories/FileMappingRepository.js";

test("CLI Action: runFetchAnimeAV1List authenticates and fetches entries", async () => {
	process.env.ANIMEAV1_SESSION = "mock-session";
	const authenticateMock = mock.method(AnimeAV1Platform.prototype, "authenticate", async () => {});
	const fetchMock = mock.method(AnimeAV1Platform.prototype, "fetchWatchlist", async () => {
		return [new WatchlistEntry("animeav1", "slug1", "Naruto", WatchStatus.WATCHING, 12, null)];
	});
	const setMappingMock = mock.method(FileMappingRepository.prototype, "setMapping", () => {});
	const getMappingMock = mock.method(FileMappingRepository.prototype, "getMapping", () => null);

	await runFetchAnimeAV1List();

	assert.strictEqual(authenticateMock.mock.callCount(), 1);
	assert.strictEqual(fetchMock.mock.callCount(), 1);
	assert.strictEqual(setMappingMock.mock.callCount(), 1);

	authenticateMock.mock.restore();
	fetchMock.mock.restore();
	setMappingMock.mock.restore();
	getMappingMock.mock.restore();
});

test("CLI Action: runSyncAnimeAV1 pushes updates to remote", async () => {
	process.env.ANIMEAV1_SESSION = "mock-session";
	const authenticateMock = mock.method(AnimeAV1Platform.prototype, "authenticate", async () => {});
	const fetchMock = mock.method(AnimeAV1Platform.prototype, "fetchWatchlist", async () => {
		// Remote is empty, meaning local has 1 to push
		return [];
	});
	const updateMock = mock.method(AnimeAV1Platform.prototype, "updateEntryStatus", async () => {});

	const loadMappingsMock = mock.method(FileMappingRepository.prototype, "loadMappings", () => {
		return {
			"animeav1:slug1": {
				platform: "animeav1",
				platform_id: "slug1",
				title: "Bleach",
				mal_status: "Watching",
				last_synced_episodes: 5,
			},
		};
	});

	await runSyncAnimeAV1();

	assert.strictEqual(authenticateMock.mock.callCount(), 1);
	assert.strictEqual(fetchMock.mock.callCount(), 1);
	assert.strictEqual(updateMock.mock.callCount(), 1); // Should push the missing entry!

	authenticateMock.mock.restore();
	fetchMock.mock.restore();
	updateMock.mock.restore();
	loadMappingsMock.mock.restore();
});

test("CLI Action: runFetchJKAnimeList fetches and sets mappings", async () => {
	process.env.JKANIME_USER = "mock";
	process.env.JKANIME_PASS = "mock";

	const authenticateMock = mock.method(JKAnimePlatform.prototype, "authenticate", async () => {});
	const fetchMock = mock.method(JKAnimePlatform.prototype, "fetchWatchlist", async () => {
		return [new WatchlistEntry("jkanime", "slug2", "One Piece", WatchStatus.COMPLETED, 1000, null)];
	});
	const setMappingMock = mock.method(FileMappingRepository.prototype, "setMapping", () => {});
	const getMappingMock = mock.method(FileMappingRepository.prototype, "getMapping", () => null);

	await runFetchJKAnimeList();

	assert.strictEqual(authenticateMock.mock.callCount(), 1);
	assert.strictEqual(fetchMock.mock.callCount(), 1);
	assert.strictEqual(setMappingMock.mock.callCount(), 1);

	authenticateMock.mock.restore();
	fetchMock.mock.restore();
	setMappingMock.mock.restore();
	getMappingMock.mock.restore();
});

test("CLI Action: runExport outputs XML file based on mapped items", async () => {
	process.env.MAL_USER = "mock-user";

	const authenticateMock = mock.method(MALPlatform.prototype, "authenticate", async () => {});
	const fetchMock = mock.method(MALPlatform.prototype, "fetchWatchlist", async () => {
		return [];
	});
	const loadMappingsMock = mock.method(FileMappingRepository.prototype, "loadMappings", () => {
		return {
			"jkanime:slug": {
				mal_id: 123,
				mal_title: "Test",
				mal_status: "Watching",
				last_synced_episodes: 5,
			},
		};
	});
	const writeFileSyncMock = mock.method(fs, "writeFileSync", () => {});

	await runExport();

	assert.strictEqual(authenticateMock.mock.callCount(), 1);
	assert.strictEqual(fetchMock.mock.callCount(), 1);
	assert.strictEqual(loadMappingsMock.mock.callCount(), 1);
	assert.strictEqual(writeFileSyncMock.mock.callCount(), 1);

	// Check if the exported XML contains the ID
	const xmlContent = writeFileSyncMock.mock.calls[0].arguments[1] as string;
	assert.ok(xmlContent.includes("<series_animedb_id>123</series_animedb_id>"));

	authenticateMock.mock.restore();
	fetchMock.mock.restore();
	loadMappingsMock.mock.restore();
	writeFileSyncMock.mock.restore();
});
