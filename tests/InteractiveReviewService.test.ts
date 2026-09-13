import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { MALPlatform } from "../src/platforms/MALPlatform.js";
import { FileMappingRepository } from "../src/repositories/FileMappingRepository.js";
import {
	InteractiveReviewService,
	ReviewResult,
} from "../src/services/InteractiveReviewService.js";

test("InteractiveReviewService preserves database integrity when manually assigning MAL ID", async () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-test-"));
	const repo = new FileMappingRepository(path.join(tmpDir, "mappings.json"));
	const malPlatform = new MALPlatform();

	// Dependency Injection: Pass the mocked prompter directly into the service
	const mockPrompter = async (_prompt: string) => "id 21";
	const service = new InteractiveReviewService(repo, malPlatform, mockPrompter);

	// Setup initial ghost entry
	repo.setMapping("jkanime", "one-piece", 0, "Detalles", {
		title: "One Piece",
		last_synced_episodes: 26,
	});

	const originalFetch = global.fetch;

	try {
		// Mock MAL fetch for ID 21
		global.fetch = async (url: unknown) => {
			if (String(url).includes("myanimelist.net/anime/21")) {
				return {
					ok: true,
					text: async () => `<h1 class="title-name h1_bold_none"><strong>One Piece</strong></h1>`,
				} as unknown as Response;
			}
			throw new Error("Unexpected URL in test");
		};

		const existing = repo.getMapping("jkanime", "one-piece");
		assert.ok(existing !== null);

		const result = await service.reviewSingleEntry(existing);

		assert.strictEqual(result, ReviewResult.RESOLVED);

		// Assert that the repository was correctly updated and the race condition didn't trigger
		const updated = repo.getMapping("jkanime", "one-piece");
		assert.ok(updated !== null);
		assert.strictEqual(updated.mal_id, 21);
		assert.strictEqual(updated.mal_title, "One Piece");
		assert.strictEqual(updated.last_synced_episodes, 26, "Episodes should be strictly preserved");
	} finally {
		global.fetch = originalFetch;
	}
});
