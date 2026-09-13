import assert from "node:assert";
import { test } from "node:test";
import { JKAnimePlatform } from "../src/platforms/JKAnimePlatform.js";
import { MALPlatform } from "../src/platforms/MALPlatform.js";

test("MALPlatform authenticates and sets session context", async () => {
	const mal = new MALPlatform();
	await mal.authenticate({ username: "testuser" });
	assert.strictEqual(mal.username, "testuser");
});

test("JKAnimePlatform authenticates and extracts cookies", async () => {
	const jk = new JKAnimePlatform();

	// Mock global fetch for this specific test
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
		assert.strictEqual(jk.defaultHeaders.Cookie, "test_cookie=123");
	} finally {
		global.fetch = originalFetch;
	}
});
