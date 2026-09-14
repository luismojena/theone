import type { IAnimePlatform } from "../core/IAnimePlatform.js";
import { AnimeAV1Platform } from "./AnimeAV1Platform.js";
import { AnimeFLVPlatform } from "./AnimeFLVPlatform.js";
import { JKAnimePlatform } from "./JKAnimePlatform.js";
import { MALPlatform } from "./MALPlatform.js";

export const PlatformFactory = {
	getPlatform(platformName: string): IAnimePlatform {
		switch (platformName.toLowerCase()) {
			case "jkanime":
				return new JKAnimePlatform();
			case "animeav1":
				return new AnimeAV1Platform();
			case "animeflv":
				return new AnimeFLVPlatform();
			case "mal":
				return new MALPlatform();
			default:
				throw new Error(
					`Platform '${platformName}' is not supported or not implemented in the factory.`,
				);
		}
	},
};
