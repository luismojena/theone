import { IAnimePlatform } from '../core/IAnimePlatform.js';
import { WatchlistEntry, WatchStatus } from '../core/domain.js';
import * as cheerio from 'cheerio';
export class AnimeAV1Platform extends IAnimePlatform {
    profileId = null;
    token = null;
    constructor() {
        super();
    }
    get platformName() {
        return 'animeav1';
    }
    async authenticate(credentials) {
        if (!credentials.session) {
            throw new Error('AnimeAV1 requires a session cookie (e.g. "x9QmL2-...")');
        }
        // Set the cookie for all future requests using the base class pattern!
        this.defaultHeaders['Cookie'] = `session=${credentials.session}`;
        this.defaultHeaders['User-Agent'] = 'Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0';
    }
    async fetchWatchlist() {
        if (!this.defaultHeaders['Cookie'])
            throw new Error("Must authenticate first");
        const entries = [];
        const baseUrl = `https://animeav1.com/cuenta/listas`;
        const res = await this.request(baseUrl);
        const html = await res.text();
        // SvelteKit embeds state like: {userId:4990,mediaId:882,status:2,episode:12,...,media:{...,slug:"shiunji-ke...",title:"Shiunji-ke..."}}
        // We can extract these object literals using regex
        const objectRegex = /\{userId:\d+,mediaId:\d+,status:(\d+),episode:(\d+).*?slug:"([^"]+)",status:\d+,title:"([^"]+)"/g;
        let match;
        while ((match = objectRegex.exec(html)) !== null) {
            const statusNum = parseInt(match[1], 10);
            const epsWatched = parseInt(match[2], 10);
            const slug = match[3];
            const title = match[4];
            // Escape unicode or hex escapes if any
            const cleanTitle = title.replace(/\\\\u[\dA-F]{4}/gi, (m) => String.fromCharCode(parseInt(m.replace(/\\\\u/g, ''), 16)));
            const status = this._mapStatusNumber(statusNum);
            entries.push(new WatchlistEntry(this.platformName, slug, cleanTitle, status, epsWatched));
        }
        return entries;
    }
    _mapStatusNumber(statusNum) {
        const map = {
            0: WatchStatus.WATCHING,
            1: WatchStatus.PLAN_TO_WATCH,
            2: WatchStatus.COMPLETED,
            3: WatchStatus.ON_HOLD,
            4: WatchStatus.DROPPED
        };
        return map[statusNum] || WatchStatus.WATCHING;
    }
    async updateEntryStatus(entry) {
        if (!this.token)
            throw new Error("Must authenticate first");
        const url = `https://animeav1.com/api/update/${encodeURIComponent(entry.platformId)}`;
        const res = await this.request(url, {
            method: 'POST',
            body: JSON.stringify({
                status: entry.status,
                episodes: entry.episodesWatched
            }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        });
        if (!res.ok) {
            throw new Error(`Failed to update ${entry.title} on AnimeAV1`);
        }
    }
    async searchAnime(query) {
        const url = `https://animeav1.com/search?q=${encodeURIComponent(query)}`;
        const res = await this.request(url);
        const html = await res.text();
        const $ = cheerio.load(html);
        const results = [];
        $('.search-result').each((_, el) => {
            const title = $(el).find('.title').text().trim();
            const href = $(el).find('a').attr('href');
            if (title && href) {
                results.push({ title, url: href, platform_id: href.split('/').pop() });
            }
        });
        return results;
    }
    _mapStatus(statusStr) {
        if (statusStr.includes('watching') || statusStr.includes('viendo'))
            return WatchStatus.WATCHING;
        if (statusStr.includes('completed') || statusStr.includes('completado'))
            return WatchStatus.COMPLETED;
        if (statusStr.includes('hold') || statusStr.includes('espera'))
            return WatchStatus.ON_HOLD;
        if (statusStr.includes('dropped') || statusStr.includes('abandonado'))
            return WatchStatus.DROPPED;
        if (statusStr.includes('plan') || statusStr.includes('planeo'))
            return WatchStatus.PLAN_TO_WATCH;
        return WatchStatus.WATCHING;
    }
}
