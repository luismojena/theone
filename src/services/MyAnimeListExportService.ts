import type { MappingEntry } from "../core/domain.js";
import { WatchStatus } from "../core/domain.js";

export class MyAnimeListExportService {
	public generateMyAnimeListXml(matchedEntries: MappingEntry[]): string {
		if (matchedEntries.length === 0) {
			return "";
		}

		let xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<myanimelist>\n  <myinfo>\n    <user_export_type>1</user_export_type>\n  </myinfo>\n`;

		for (const item of matchedEntries) {
			const malId = item.mal_id;
			const malTitle = item.mal_title;
			const itemStatus = item.mal_status || item.last_synced_status || WatchStatus.WATCHING;
			const itemEpisodes = item.last_synced_episodes || 0;

			xml += `  <anime>
    <series_animedb_id>${malId}</series_animedb_id>
    <series_title><![CDATA[${malTitle}]]></series_title>
    <my_id>0</my_id>
    <my_watched_episodes>${itemEpisodes}</my_watched_episodes>
    <my_status>${itemStatus}</my_status>
    <update_on_import>1</update_on_import>
  </anime>\n`;
		}

		xml += `</myanimelist>\n`;
		return xml;
	}
}
