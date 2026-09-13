import type { MappingEntry, WatchlistEntry } from "./domain.js";

export function isError(err: unknown): err is Error {
	return err instanceof Error;
}

export function isMappingEntry(obj: unknown): obj is MappingEntry {
	if (!obj || typeof obj !== "object") return false;
	const record = obj as Record<string, unknown>;

	// We at least expect platform and platform_id to exist for it to be a valid map
	return (
		typeof record.platform === "string" &&
		typeof record.platform_id === "string"
	);
}

export function isMappingRecord(
	obj: unknown,
): obj is Record<string, MappingEntry> {
	if (!obj || typeof obj !== "object") return false;
	for (const key of Object.keys(obj)) {
		if (!isMappingEntry((obj as Record<string, unknown>)[key])) {
			return false;
		}
	}
	return true;
}

export function isWatchlistEntry(obj: unknown): obj is WatchlistEntry {
	if (!obj || typeof obj !== "object") return false;
	const record = obj as Record<string, unknown>;
	return (
		typeof record.platform === "string" &&
		typeof record.platformId === "string" &&
		typeof record.title === "string" &&
		typeof record.status === "string" &&
		typeof record.episodesWatched === "number"
	);
}
