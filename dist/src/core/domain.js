export const WatchStatus = {
    WATCHING: 'Watching',
    COMPLETED: 'Completed',
    ON_HOLD: 'On-Hold',
    DROPPED: 'Dropped',
    PLAN_TO_WATCH: 'Plan to Watch'
};
export class Anime {
    malId;
    title;
    constructor(malId, title) {
        this.malId = malId;
        this.title = title;
    }
}
export class WatchlistEntry {
    platform;
    platformId;
    title;
    status;
    episodesWatched;
    malId;
    constructor(platform, platformId, title, status, episodesWatched, malId = null) {
        this.platform = platform;
        this.platformId = platformId;
        this.title = title;
        this.status = status;
        this.episodesWatched = episodesWatched;
        this.malId = malId;
    }
}
