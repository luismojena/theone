import * as cheerio from "cheerio";
import { WatchlistEntry, WatchStatus } from "../core/domain.js";
import { IAnimePlatform } from "../core/IAnimePlatform.js";
import { sleep } from "../utils.js";

export class AnimeFLVPlatform extends IAnimePlatform {
	profileId: string | null = null;

	get platformName() {
		return "animeflv";
	}

	async authenticate(credentials: Record<string, string>) {
		if (!credentials.profileId) {
			throw new Error('AnimeFLV requires a profileId (e.g. "PROW")');
		}
		this.profileId = credentials.profileId;
	}

	async fetchWatchlist() {
		if (!this.profileId) throw new Error("Must authenticate with profileId first");

		let page = 1;
		const entries: WatchlistEntry[] = [];
		const baseUrl = `https://www4.animeflv.net/perfil/${encodeURIComponent(this.profileId)}/siguiendo`;

		while (true) {
			const url = `${baseUrl}?page=${page}`;
			console.log(`Fetching AnimeFLV page ${page}...`);

			let html = "";
			try {
				const res = await this.request(url, {});
				if (!res.ok) break;

				html = await res.text();
			} catch (err: unknown) {
				if (err instanceof Error && err.message === "WEBSITE_DOWN") {
					break; // Stop scraping, return what we have (if any) or bubble up.
				}
				throw err;
			}

			const $ = cheerio.load(html);
			const animeElements = $("ul.ListAnimes li");

			if (animeElements.length === 0) {
				break; // No more pages
			}

			animeElements.each((_i, el) => {
				const titleLink = $(el).find("h3.Title a");
				const title = titleLink.text().trim();
				const href = titleLink.attr("href");
				const slug = href ? href.replace(/^\/anime\//, "") : "";

				if (slug) {
					entries.push(new WatchlistEntry(this.platformName, slug, title, WatchStatus.WATCHING, 0));
				}
			});

			await sleep(1000);
			page++;
		}

		return entries;
	}

	async updateEntryStatus(_entry: import("../core/domain.js").WatchlistEntry) {
		throw new Error("AnimeFLV does not support automated status updates.");
	}

	async searchAnime(_query: string): Promise<import("../core/domain.js").SearchResult[]> {
		throw new Error("Search not implemented for AnimeFLV.");
	}

	async fetchAnimeDetails(platformId: string): Promise<{ title: string } | null> {
		throw new Error("Surgical fixing is not yet supported for AnimeFLV.");
	}
}
