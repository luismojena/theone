import { describe, it } from "node:test";
import assert from "node:assert";
import { PlatformFactory } from "../src/platforms/PlatformFactory.js";
import { JKAnimePlatform } from "../src/platforms/JKAnimePlatform.js";
import { AnimeAV1Platform } from "../src/platforms/AnimeAV1Platform.js";
import { AnimeFLVPlatform } from "../src/platforms/AnimeFLVPlatform.js";
import { MALPlatform } from "../src/platforms/MALPlatform.js";

describe("PlatformFactory", () => {
	it("returns correct platform instances", () => {
		assert.ok(PlatformFactory.getPlatform("jkanime") instanceof JKAnimePlatform);
		assert.ok(PlatformFactory.getPlatform("animeav1") instanceof AnimeAV1Platform);
		assert.ok(PlatformFactory.getPlatform("animeflv") instanceof AnimeFLVPlatform);
		assert.ok(PlatformFactory.getPlatform("mal") instanceof MALPlatform);
	});

	it("throws error for unsupported platforms", () => {
		assert.throws(() => {
			PlatformFactory.getPlatform("unknown_platform");
		}, /not supported or not implemented/);
	});

	it("handles case-insensitivity", () => {
		assert.ok(PlatformFactory.getPlatform("JkAnime") instanceof JKAnimePlatform);
		assert.ok(PlatformFactory.getPlatform("MAL") instanceof MALPlatform);
	});
});
