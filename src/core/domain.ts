export const WatchStatus = {
	WATCHING: "Watching",
	COMPLETED: "Completed",
	ON_HOLD: "On-Hold",
	DROPPED: "Dropped",
	PLAN_TO_WATCH: "Plan to Watch",
} as const;

export class Anime {
	constructor(
		public malId: number,
		public title: string,
	) {}
}

export class WatchlistEntry {
	constructor(
		public platform: string,
		public platformId: string,
		public title: string,
		public status: string,
		public episodesWatched: number,
		public malId: number | null = null,
	) {}
}

export interface SearchResult {
	platform_id: string;
	title: string;
	url?: string;
}

export interface MappingEntry {
	platform?: string;
	platform_id?: string;
	mal_id?: number;
	mal_title?: string;
	mal_status?: string;
	title?: string;
	last_synced_episodes?: number;
	last_synced_status?: string;
	updated_at?: string;
	[key: string]: unknown;
}
