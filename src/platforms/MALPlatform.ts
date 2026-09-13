import * as cheerio from "cheerio";
import { WatchlistEntry, WatchStatus } from "../core/domain.js";
import { IAnimePlatform } from "../core/IAnimePlatform.js";
import { sleep } from "../utils.js";

export class MALPlatform extends IAnimePlatform {
	sessionCookie: string | null = null;
	username: string | null = null;

	get platformName() {
		return "mal";
	}

	async authenticate(credentials: Record<string, string>) {
		if (credentials.username) {
			this.username = credentials.username;
		}
		// Note: Official OAuth or cookie auth can be implemented here.
		return Promise.resolve();
	}

	async fetchWatchlist() {
		if (!this.username) throw new Error("Username required for MALPlatform");

		const entries = [];
		let offset = 0;
		let hasMore = true;

		const statusNumMap: Record<number, string> = {
			1: WatchStatus.WATCHING,
			2: WatchStatus.COMPLETED,
			3: WatchStatus.ON_HOLD,
			4: WatchStatus.DROPPED,
			6: WatchStatus.PLAN_TO_WATCH,
		};

		while (hasMore) {
			const url = `https://myanimelist.net/animelist/${encodeURIComponent(this.username)}/load.json?offset=${offset}&status=7`;

			const res = await this.request(url, {
				headers: {
					Accept: "application/json",
				},
			});

			const items = await res.json();
			if (!Array.isArray(items) || items.length === 0) {
				hasMore = false;
				break;
			}

			for (const item of items) {
				if (item.anime_id) {
					entries.push(
						new WatchlistEntry(
							this.platformName,
							item.anime_id.toString(),
							item.anime_title,
							statusNumMap[item.status] || WatchStatus.WATCHING,
							item.num_watched_episodes || 0,
							Number(item.anime_id),
						),
					);
				}
			}

			if (items.length < 300) {
				hasMore = false;
			} else {
				offset += 300;
				await sleep(500);
			}
		}
		return entries;
	}

	async updateEntryStatus(_entry: unknown) {
		// MAL currently uses XML export rather than direct API updates in this tool.
		// However, if we implemented official MAL OAuth, we'd do a PUT/PATCH here.
		throw new Error("MAL API update not directly implemented yet. Use XML export.");
	}

	async searchAnime(query: string) {
		const url = `https://myanimelist.net/anime.php?q=${encodeURIComponent(query)}&cat=anime`;

		const res = await this.request(url, {
			headers: {
				Accept: "text/html",
			},
		});

		const html = await res.text();
		const $ = cheerio.load(html);
		const results: import("../core/domain.js").SearchResult[] = [];

		$("table tr").each((_idx, el) => {
			const titleLink = $(el).find("div.title a.hoverinfo_trigger");
			if (titleLink.length === 0) return;
			const title = titleLink.find("strong").text().trim() || titleLink.text().trim();
			const href = titleLink.attr("href");
			if (!href) return;
			const malIdMatch = href.match(/\/anime\/(\d+)/);
			if (malIdMatch) {
				const mal_id = parseInt(malIdMatch[1] || "0", 10);
				results.push({ platform_id: String(mal_id), title, url: href });
			}
		});

		return results;
	}
}
