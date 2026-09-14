import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { JKAnimePlatform } from "../src/platforms/JKAnimePlatform.js";
import { MALPlatform } from "../src/platforms/MALPlatform.js";
import { FileMappingRepository } from "../src/repositories/FileMappingRepository.js";
import {
	InteractiveReviewService,
	ReviewResult,
} from "../src/services/InteractiveReviewService.js";
import { PlatformImporterService } from "../src/services/PlatformImporterService.js";

test("MALPlatform authenticates and sets session context", async () => {
	const mal = new MALPlatform();
	await mal.authenticate({ username: "testuser" });
	assert.strictEqual(mal.username, "testuser");
});

test("JKAnimePlatform authenticates and extracts cookies into HttpClient", async () => {
	const jk = new JKAnimePlatform();

	const originalFetch = global.fetch;
	global.fetch = async (_url: unknown, _options: unknown) => {
		return {
			ok: true,
			json: async () => ({ error: 0 }),
			headers: {
				getSetCookie: () => ["test_cookie=123; path=/"],
			},
		} as unknown as Response;
	};

	try {
		await jk.authenticate({ username: "test_user", password: "test_password" });
		assert.strictEqual(jk.username, "test_user");
		assert.strictEqual(jk.cookies, "test_cookie=123");
		assert.strictEqual(jk.httpClient.defaultHeaders.Cookie, "test_cookie=123");
	} finally {
		global.fetch = originalFetch;
	}
});

test("InteractiveReviewService uses IAnimeDetailsProvider (Composition E2E)", async () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-test-"));
	const repo = new FileMappingRepository(path.join(tmpDir, "mappings.json"));

	repo.setMapping("jkanime", "some-slug", 0, "Unknown Title", {
		platform: "jkanime",
		platform_id: "some-slug",
		title: "Unknown Title",
	});

	const mal = new MALPlatform();

	// Mock fetch to simulate MAL HTML response
	const originalFetch = global.fetch;
	global.fetch = async (url: unknown, _options: unknown) => {
		if (typeof url === "string" && url.includes("/anime/12345")) {
			return {
				ok: true,
				text: async () =>
					`<html><body><h1 class="title-name"><strong>Mocked MAL Title</strong></h1></body></html>`,
			} as unknown as Response;
		}
		throw new Error("Unexpected fetch url");
	};

	try {
		let _callCount = 0;
		// Mock the prompt so it automatically types 'id 12345'
		const mockPrompt = async (_q: string) => {
			_callCount++;
			return "id 12345";
		};

		const service = new InteractiveReviewService(repo, mal, mockPrompt);

		const entry = repo.getMapping("jkanime", "some-slug");
		assert.ok(entry);

		const result = await service.reviewSingleEntry(entry);
		assert.strictEqual(result, ReviewResult.RESOLVED);

		// Verify the repo was updated correctly
		const updated = repo.getMapping("jkanime", "some-slug");
		assert.strictEqual(updated?.mal_id, 12345);
		assert.strictEqual(updated?.mal_title, "Mocked MAL Title");
	} finally {
		global.fetch = originalFetch;
	}
});

test("PlatformImporterService uses IAnimeSearcher (Composition E2E)", async () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "importer-e2e-"));
	const repo = new FileMappingRepository(path.join(tmpDir, "mappings.json"));

	repo.setMapping("jkanime", "naruto-slug", 10, "Naruto", {
		platform: "jkanime",
	});

	const mal = new MALPlatform();

	// Mock fetch to simulate MAL Search HTML response
	const originalFetch = global.fetch;
	global.fetch = async (url: unknown, _options: unknown) => {
		if (typeof url === "string" && url.includes("/anime.php?q=Naruto")) {
			return {
				ok: true,
				text: async () => `
				<html>
					<body>
						<table>
							<tr>
								<td>
									<a class="hoverinfo_trigger fw-b" href="/anime/999/Naruto_Match">
										<strong>Naruto Match</strong>
									</a>
								</td>
							</tr>
						</table>
					</body>
				</html>`,
			} as unknown as Response;
		}
		throw new Error("Unexpected fetch url");
	};

	try {
		const service = new PlatformImporterService(repo, mal);
		const mappedCount = await service.mapMissingEntries();

		assert.strictEqual(mappedCount, 1);

		const updated = repo.getMapping("mal", "999");
		assert.strictEqual(updated?.mal_id, 10);
		assert.strictEqual(updated?.title, "Naruto Match");
	} finally {
		global.fetch = originalFetch;
	}
});
