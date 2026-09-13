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
