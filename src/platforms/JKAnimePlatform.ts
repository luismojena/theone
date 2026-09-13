import * as cheerio from "cheerio";
import { WatchlistEntry, WatchStatus } from "../core/domain.js";
import { IAnimePlatform } from "../core/IAnimePlatform.js";

export class JKAnimePlatform extends IAnimePlatform {
	cookies: string | null = null;
	username: string | null = null;

	get platformName() {
		return "jkanime";
	}

	async authenticate(credentials: any) {
		if (!credentials.username || !credentials.password) {
			throw new Error("JKAnime requires username and password");
		}

		const payload = new URLSearchParams({
			usuario: credentials.username,
			password: credentials.password,
		});

		const res = await this.request("https://login.jkanime.net/api/login", {
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
		this.defaultHeaders.Cookie = this.cookies; // Automatically append to all future requests
		this.username = credentials.username;
	}

	async fetchWatchlist() {
		if (!this.cookies || !this.username)
			throw new Error("Must authenticate before fetching watchlist");

		let uniqueItems = await this._fetchWatchlistAPI();

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

	async _fetchWatchlistAPI() {
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
				const url = `https://login.jkanime.net/api/animes?tag=${tagId}&orden=none&filtro=fecha&p=${page}`;
				const res = await this.request(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: new URLSearchParams({
						user: this.username as string,
					}).toString(),
				});

				const json = await res.json();
				lastPage = json.last_page || 1;

				if (json.data && Array.isArray(json.data)) {
					for (const rawItem of json.data) {
						const info =
							typeof rawItem.info === "string"
								? JSON.parse(rawItem.info)
								: rawItem.info || {};
						const rawUrl = info.url || rawItem.url || "";
						const slug = rawUrl
							.replace(/^https?:\/\/jkanime\.net\//, "")
							.replace(/\//g, "");
						if (slug) {
							items.push({
								title: info.title || rawItem.title || slug,
								slug,
								mal_status: statusInfo.mal_status,
								episodesWatched: 0,
							});
						}
					}
				}
				page++;
			} while (page <= lastPage);
		}
		return items;
	}

	async _fetchWatchlistHTML() {
		return []; // Fallback stub
	}

	async updateEntryStatus(entry: any) {
		if (!this.cookies)
			throw new Error("Must authenticate before updating status");

		// Fetch details
		const href = `https://jkanime.net/${entry.platformId}/`;
		const res = await this.request(href);
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

		const updateRes = await this.request(
			"https://login.jkanime.net/api/guardar_anime",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: payload.toString(),
			},
		);

		const data = await updateRes.json();
		if (data === "token") throw new Error("Session expired");
	}

	async searchAnime(query: string) {
		const url = `https://jkanime.net/buscar?q=${encodeURIComponent(query)}`;
		const res = await this.request(url);
		const html = await res.text();
		const $ = cheerio.load(html);
		const results: any[] = [];

		$(".anime__item").each((_idx, el) => {
			const a = $(el).find("a").first();
			const href = a.attr("href");
			if (!href) return;
			const title =
				$(el).find(".anime__item__text h5 a").text().trim() || a.text().trim();
			results.push({ title, href });
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
}
