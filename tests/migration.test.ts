import assert from "node:assert";
import { test, mock } from "node:test";
import { FileMappingRepository } from "../src/repositories/FileMappingRepository.js";
import { MALPlatform } from "../src/platforms/MALPlatform.js";
import { runResolve } from "../src/cli/malCli.js";

test("runResolve automatically finds and updates missing MAL IDs via MALPlatform", async () => {
	// 1. Mock the repository to return an entry with a missing MAL ID
	const loadMappingsMock = mock.method(FileMappingRepository.prototype, "loadMappings", () => {
		return {
			"jkanime:naruto-slug": {
				title: "Naruto",
				platform: "jkanime",
				platform_id: "naruto-slug",
				mal_id: 0,
			},
		};
	});

	// 2. Spy on setMapping to ensure the database gets updated
	const setMappingMock = mock.method(FileMappingRepository.prototype, "setMapping", () => {});

	// 3. Mock the MALPlatform API call so it doesn't actually hit the network
	const searchAnimeMock = mock.method(
		MALPlatform.prototype,
		"searchAnime",
		async (title: string) => {
			if (title === "Naruto") {
				return [
					{
						platform_id: "20",
						title: "Naruto (Resolved)",
						url: "https://myanimelist.net/anime/20",
					},
				];
			}
			return [];
		},
	);

	// Run the resolved function
	await runResolve();

	// 4. Assertions
	assert.strictEqual(
		searchAnimeMock.mock.callCount(),
		1,
		"searchAnime should have been called once",
	);

	assert.strictEqual(setMappingMock.mock.callCount(), 1, "setMapping should have been called once");

	const callArgs = setMappingMock.mock.calls[0].arguments;
	assert.strictEqual(callArgs[0], "jkanime");
	assert.strictEqual(callArgs[1], "naruto-slug");
	assert.strictEqual(callArgs[2], 20); // The resolved MAL ID
	assert.strictEqual(callArgs[3], "Naruto (Resolved)"); // The resolved MAL Title

	// Restore mocks
	loadMappingsMock.mock.restore();
	setMappingMock.mock.restore();
	searchAnimeMock.mock.restore();
});
