import * as cheerio from "cheerio";
import { type SearchResult, WatchlistEntry, WatchStatus } from "../core/domain.js";
import { HttpClient } from "../core/HttpClient.js";
import type { IAnimePlatform } from "../core/interfaces.js";

export class JKAnimePlatform implements IAnimePlatform {
	public httpClient = new HttpClient();
	cookies: string | null = null;
	username: string | null = null;

	get platformName() {
		return "jkanime";
	}

	async authenticate(credentials: Record<string, string>) {
		if (!credentials.username || !credentials.password) {
			throw new Error("JKAnime requires username and password");
		}

		const payload = new URLSearchParams({
			usuario: credentials.username,
			password: credentials.password,
		});

		const res = await this.httpClient.request("https://login.jkanime.net/api/login", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Referer: "https://jkanime.net/",
			},
			body: payload.toString(),
		});

		const data = await res.json();
		if (data.error) throw new Error(data.messaje || "Invalid credentials");

		const cookieArray = res.headers.getSetCookie();
		this.cookies = cookieArray.map((c) => c.split(";")[0]).join("; ");
		this.httpClient.defaultHeaders.Cookie = this.cookies; // Automatically append to all future requests
		this.username = credentials.username;
	}

	async fetchWatchlist(options: Record<string, string> = {}) {
		if (!this.cookies || !this.username)
			throw new Error("Must authenticate before fetching watchlist");

		let uniqueItems = await this._fetchWatchlistAPI(options);

		if (uniqueItems.length === 0) {
			uniqueItems = await this._fetchWatchlistHTML();
		}

		return uniqueItems.map(
			(item) =>
				new WatchlistEntry(
					this.platformName,
					item.slug,
					item.title,
					this._mapStatus(item.mal_status),
					item.episodesWatched || 0,
				),
		);
	}

	async _fetchWatchlistAPI(options: Record<string, string> = {}) {
		const items = [];
		const tagMap = {
			"1": { mal_status: "Watching" },
			"2": { mal_status: "Completed" },
			"3": { mal_status: "Watching" },
			"4": { mal_status: "Plan to Watch" },
			"5": { mal_status: "On-Hold" },
			"6": { mal_status: "Dropped" },
		};

		for (const [tagId, statusInfo] of Object.entries(tagMap)) {
			let page = 1;
			let lastPage = 1;
			do {
				const { parsedItems, totalPages } = await this.fetchWatchlistPage(
					tagId,
					page,
					statusInfo.mal_status,
				);
				items.push(...parsedItems);
				lastPage = totalPages;
				page++;

				const sleepMs = this.calculateJitterDelay(options.delay, options.jitter);
				if (sleepMs > 0) {
					console.log(`[Delay] Sleeping for ${sleepMs}ms`);
					await new Promise((resolve) => setTimeout(resolve, sleepMs));
				}
			} while (page <= lastPage);
		}
		return items;
	}

	private async fetchWatchlistPage(tagId: string, page: number, malStatus: string) {
		const url = `https://login.jkanime.net/api/animes?tag=${tagId}&orden=none&filtro=fecha&p=${page}`;
		const res = await this.httpClient.request(url, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ user: this.username as string }).toString(),
		});
		const json = await res.json();
		const lastPage = json.last_page || 1;
		const itemsReturned = json.data && Array.isArray(json.data) ? json.data.length : 0;
		console.log(
			`[JKAnime API] POST api/animes?tag=${tagId}&p=${page} | Status: ${res.status} | Items: ${itemsReturned} | Total Pages: ${lastPage}`,
		);

		const parsedItems = [];
		if (json.data && Array.isArray(json.data)) {
			for (const rawItem of json.data) {
				const info =
					typeof rawItem.info === "string" ? JSON.parse(rawItem.info) : rawItem.info || {};
				const rawUrl = info.url || rawItem.url || "";
				const slug = rawUrl.replace(/^https?:\/\/jkanime\.net\//, "").replace(/\//g, "");
				if (slug) {
					let title = info.title || rawItem.title || slug;
					if (title.length <= 15 && !title.includes(" ")) {
						title = slug.replace(/-/g, " ");
					}
					parsedItems.push({ title, slug, mal_status: malStatus, episodesWatched: 0 });
				}
			}
		}
		return { parsedItems, totalPages: lastPage };
	}

	public calculateJitterDelay(
		delayStr: string | undefined = "200",
		jitterStr: string | undefined,
	): number {
		const delayMs = parseInt(delayStr, 10);
		if (Number.isNaN(delayMs)) return 0;
		let jitterLow = 0;
		let jitterHigh = 100;
		if (jitterStr) {
			const parts = jitterStr.split("-");
			if (parts.length === 2) {
				jitterLow = parseInt(parts[0], 10);
				jitterHigh = parseInt(parts[1], 10);
			}
		}
		const jitterAmount = Math.floor(Math.random() * (jitterHigh - jitterLow + 1)) + jitterLow;
		return delayMs + jitterAmount;
	}

	async _fetchWatchlistHTML() {
		return []; // Fallback stub
	}

	async updateEntryStatus(entry: WatchlistEntry) {
		if (!this.cookies) throw new Error("Must authenticate before updating status");

		// Fetch details
		const href = `https://jkanime.net/${entry.platformId}/`;
		const res = await this.httpClient.request(href);
		const html = await res.text();
		const $ = cheerio.load(html);

		const animeId = $("#guardar-anime").attr("data-anime");
		if (!animeId) throw new Error("Could not find data-anime attribute");

		let tagId = 2; // Completado
		if (entry.status === WatchStatus.WATCHING) tagId = 1;
		else if (entry.status === WatchStatus.ON_HOLD) tagId = 5;
		else if (entry.status === WatchStatus.DROPPED) tagId = 6;
		else if (entry.status === WatchStatus.PLAN_TO_WATCH) tagId = 4;

		const payload = new URLSearchParams({
			ainfo: JSON.stringify({
				status: tagId === 2 ? "ti-check" : "ti-eye",
				title: entry.title,
				url: new URL(href).pathname,
				date: new Date().toLocaleString(),
			}),
			id: animeId,
			tag: tagId.toString(),
		});

		const updateRes = await this.httpClient.request("https://login.jkanime.net/api/guardar_anime", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: payload.toString(),
		});

		const data = await updateRes.json();
		if (data === "token") throw new Error("Session expired");
	}

	async searchAnime(query: string) {
		const url = `https://jkanime.net/buscar?q=${encodeURIComponent(query)}`;
		const res = await this.httpClient.request(url);
		const html = await res.text();
		const $ = cheerio.load(html);
		const results: SearchResult[] = [];

		$(".anime__item").each((_idx, el) => {
			const a = $(el).find("a").first();
			const href = a.attr("href");
			if (!href) return;
			const title = $(el).find(".anime__item__text h5 a").text().trim() || a.text().trim();
			results.push({ platform_id: href || "", title, url: href });
		});

		return results;
	}

	_mapStatus(malStatusString: string) {
		const map: Record<string, string> = {
			Watching: WatchStatus.WATCHING,
			Completed: WatchStatus.COMPLETED,
			"On-Hold": WatchStatus.ON_HOLD,
			Dropped: WatchStatus.DROPPED,
			"Plan to Watch": WatchStatus.PLAN_TO_WATCH,
		};
		return map[malStatusString] || WatchStatus.WATCHING;
	}

	async fetchAnimeDetails(platformId: string): Promise<{ title: string } | null> {
		const res = await this.httpClient.request(`https://jkanime.net/${platformId}/`);
		const html = await res.text();
		const $ = cheerio.load(html);

		// Try to find the exact title among the H3 tags (ignoring the search history header)
		let scrapedTitle = "";
		$("h3").each((_, el) => {
			const text = $(el).text().trim();
			if (text && text !== "Buscado recientemente:" && text !== "Temporadas y relacionados") {
				if (!scrapedTitle) scrapedTitle = text;
			}
		});

		if (scrapedTitle) {
			return { title: scrapedTitle };
		}
		return null;
	}
}
