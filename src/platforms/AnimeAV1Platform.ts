import { IAnimePlatform } from '../core/IAnimePlatform.js';
import { WatchlistEntry, WatchStatus } from '../core/domain.js';
import * as cheerio from 'cheerio';

export class AnimeAV1Platform extends IAnimePlatform {
  private profileId: string | null = null;
  private token: string | null = null;

  constructor() {
    super();
  }

  get platformName(): string {
    return 'animeav1';
  }

  async authenticate(credentials: any): Promise<void> {
    if (!credentials.session) {
      throw new Error('AnimeAV1 requires a session cookie (e.g. "x9QmL2-...")');
    }
    
    // Set the cookie for all future requests using the base class pattern!
    this.defaultHeaders['Cookie'] = `session=${credentials.session}`;
    this.defaultHeaders['User-Agent'] = 'Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0';
  }

  async fetchWatchlist(): Promise<WatchlistEntry[]> {
    if (!this.defaultHeaders['Cookie']) throw new Error("Must authenticate first");

    const entries: WatchlistEntry[] = [];
    const baseUrl = `https://animeav1.com/cuenta/listas`;

    const res = await this.request(baseUrl);
    const html = await res.text();

    // We extract mediaId, status, episode, slug, title
    const objectRegex = /\{userId:\d+,mediaId:(\d+),status:(\d+),episode:(\d+).*?slug:"([^"]+)",status:\d+,title:"([^"]+)"/g;
    
    let match;
    while ((match = objectRegex.exec(html)) !== null) {
      const mediaId = match[1]!;
      const statusNum = parseInt(match[2]!, 10);
      const epsWatched = parseInt(match[3]!, 10);
      const slug = match[4]!;
      const title = match[5]!;

      // Escape unicode or hex escapes if any
      const cleanTitle = title.replace(/\\\\u[\dA-F]{4}/gi, (m) => 
         String.fromCharCode(parseInt(m.replace(/\\\\u/g, ''), 16))
      );

      const status = this._mapStatusNumber(statusNum);

      entries.push(new WatchlistEntry(
        this.platformName,
        mediaId, // We use mediaId as the platformId so we can sync back easily
        cleanTitle,
        status,
        epsWatched
      ));
    }

    return entries;
  }

  private _mapStatusNumber(statusNum: number): string {
    const map: Record<number, string> = {
      0: WatchStatus.WATCHING,
      1: WatchStatus.PLAN_TO_WATCH,
      2: WatchStatus.COMPLETED,
      3: WatchStatus.ON_HOLD,
      4: WatchStatus.DROPPED
    };
    return map[statusNum] || WatchStatus.WATCHING;
  }

  private _mapStatusToNumber(statusStr: string): number {
    switch (statusStr) {
      case WatchStatus.WATCHING: return 0;
      case WatchStatus.PLAN_TO_WATCH: return 1;
      case WatchStatus.COMPLETED: return 2;
      case WatchStatus.ON_HOLD: return 3;
      case WatchStatus.DROPPED: return 4;
      default: return 0;
    }
  }

  async updateEntryStatus(entry: WatchlistEntry): Promise<void> {
    if (!this.defaultHeaders['Cookie']) throw new Error("Must authenticate first");
    
    const url = `https://animeav1.com/api/user/library`;
    
    // The API payload seen from browser: {"mediaId":4382,"episode":11}
    // We can also try injecting "status" into the JSON payload in case the backend supports it.
    const payload = {
      mediaId: parseInt(entry.platformId, 10),
      episode: entry.episodesWatched,
      status: this._mapStatusToNumber(entry.status)
    };

    const res = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://animeav1.com'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to update ${entry.title} on AnimeAV1. HTTP ${res.status}`);
    }
  }

  async searchAnime(query: string): Promise<any[]> {
    if (!this.defaultHeaders['Cookie']) throw new Error("Must authenticate first");

    const url = `https://animeav1.com/catalogo?search=${encodeURIComponent(query)}`;
    const res = await this.request(url);
    const html = await res.text();
    const results: any[] = [];

    // The data is hydrated in the HTML inside a JSON block. We extract id, title, and slug.
    const searchRegex = /\{id:"?(\d+)"?,title:"([^"]+)"[^\}]*slug:"([^"]+)"/g;
    
    let match;
    const seenIds = new Set<string>(); // Prevent duplicates
    
    while ((match = searchRegex.exec(html)) !== null) {
      const mediaId = match[1]!;
      const title = match[2]!;
      const slug = match[3]!;

      // Escape unicode or hex escapes if any
      const cleanTitle = title.replace(/\\\\u[\dA-F]{4}/gi, (m) => 
         String.fromCharCode(parseInt(m.replace(/\\\\u/g, ''), 16))
      );

      if (!seenIds.has(mediaId)) {
        seenIds.add(mediaId);
        results.push({
          platform_id: mediaId,
          title: cleanTitle,
          url: `https://animeav1.com/media/${slug}`
        });
      }
    }

    return results;
  }

  private _mapStatus(statusStr: string): string {
    if (statusStr.includes('watching') || statusStr.includes('viendo')) return WatchStatus.WATCHING;
    if (statusStr.includes('completed') || statusStr.includes('completado')) return WatchStatus.COMPLETED;
    if (statusStr.includes('hold') || statusStr.includes('espera')) return WatchStatus.ON_HOLD;
    if (statusStr.includes('dropped') || statusStr.includes('abandonado')) return WatchStatus.DROPPED;
    if (statusStr.includes('plan') || statusStr.includes('planeo')) return WatchStatus.PLAN_TO_WATCH;
    return WatchStatus.WATCHING;
  }
}
