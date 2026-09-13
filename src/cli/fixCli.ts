import * as cheerio from "cheerio";
import { JKAnimePlatform } from "../platforms/JKAnimePlatform.js";
import { MALPlatform } from "../platforms/MALPlatform.js";
import { FileMappingRepository } from "../repositories/FileMappingRepository.js";

export async function runFixEntry(platformName: string, platformId: string) {
	console.log(`--- Surgical Fix: ${platformName} -> ${platformId} ---`);

	const repo = new FileMappingRepository("./migrations/mappings.json");
	const existing = repo.getMapping(platformName, platformId);

	if (!existing) {
		console.error(`❌ Entry '${platformName}:${platformId}' does not exist in mappings.json`);
		return;
	}

	let newTitle = existing.title;
	let newMalTitle = existing.mal_title;
	const changes: string[] = [];

	// 1. Fetch Platform Data
	if (platformName === "jkanime") {
		console.log(`Fetching live HTML from JKanime for '${platformId}'...`);
		try {
			const p = new JKAnimePlatform();
			const res = await p.request(`https://jkanime.net/${platformId}/`);
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

			if (scrapedTitle && scrapedTitle !== existing.title) {
				changes.push(`Title: "${existing.title}" -> "${scrapedTitle}"`);
				newTitle = scrapedTitle;
			} else if (scrapedTitle) {
				console.log(`Platform title is already perfectly correct: "${scrapedTitle}"`);
			} else {
				console.warn("⚠️ Could not find a valid title in the JKanime HTML.");
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`❌ Failed to scrape JKanime:`, msg);
		}
	} else {
		console.log(`⚠️ Platform specific HTML scraping for '${platformName}' is not implemented yet.`);
	}

	// 2. Fetch MAL Data
	const malId = Number(existing.mal_id);
	if (malId > 0) {
		console.log(`Fetching live HTML from MyAnimeList for ID '${malId}'...`);
		try {
			const malPlatform = new MALPlatform();
			const res = await malPlatform.request(`https://myanimelist.net/anime/${malId}`);
			const html = await res.text();
			const $ = cheerio.load(html);

			const malTitleScraped =
				$("h1.title-name strong").text().trim() || $("h1.title-name").text().trim();

			if (malTitleScraped && malTitleScraped !== existing.mal_title) {
				changes.push(`MAL Title: "${existing.mal_title}" -> "${malTitleScraped}"`);
				newMalTitle = malTitleScraped;
			} else if (malTitleScraped) {
				console.log(`MAL title is already perfectly correct: "${malTitleScraped}"`);
			} else {
				console.warn("⚠️ Could not find a valid title in the MyAnimeList HTML.");
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`❌ Failed to scrape MyAnimeList:`, msg);
		}
	} else {
		console.log(`⚠️ No mal_id mapped for this entry. Skipping MyAnimeList sync.`);
	}

	// 3. Save Changes
	if (changes.length > 0) {
		console.log(`\n✅ Applying fixes to ${platformName}:${platformId}:`);
		for (const change of changes) {
			console.log(`   - ${change}`);
		}

		repo.setMapping(platformName, platformId, malId, newMalTitle || "", {
			...existing,
			title: newTitle,
		});
		console.log(`\n🎉 Entry successfully healed!`);
	} else {
		console.log(`\n✅ Entry is already in perfect condition. No changes needed.`);
	}
}
