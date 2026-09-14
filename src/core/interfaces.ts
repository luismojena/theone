import type { SearchResult, WatchlistEntry } from "./domain.js";

export interface IPlatformInfo {
	get platformName(): string;
}

export interface IAuthenticator {
	authenticate(credentials: Record<string, string>): Promise<void>;
}

export interface IWatchlistProvider {
	fetchWatchlist(options?: Record<string, string>): Promise<WatchlistEntry[]>;
}

export interface IWatchlistManager {
	updateEntryStatus(entry: WatchlistEntry): Promise<void>;
}

export interface IAnimeSearcher {
	searchAnime(query: string): Promise<SearchResult[]>;
}

export interface IAnimeDetailsProvider {
	fetchAnimeDetails(platformId: string): Promise<{ title: string } | null>;
}

export interface IAnimePlatform
	extends IPlatformInfo,
		IAuthenticator,
		IWatchlistProvider,
		IWatchlistManager,
		IAnimeSearcher,
		IAnimeDetailsProvider {}
