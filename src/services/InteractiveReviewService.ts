import * as cheerio from "cheerio";
import type { MappingEntry } from "../core/domain.js";
import type { MALPlatform } from "../platforms/MALPlatform.js";
import type { FileMappingRepository } from "../repositories/FileMappingRepository.js";
import { askQuestion } from "../utils.js";

export enum ReviewResult {
	RESOLVED = "RESOLVED",
	SKIPPED = "SKIPPED",
	QUIT = "QUIT",
}

export class InteractiveReviewService {
	constructor(
		private repo: FileMappingRepository,
		private malPlatform: MALPlatform,
		private promptFn: (promptText: string) => Promise<string> = askQuestion,
	) {}

	/**
	 * Launches the interactive review prompt for a single unmapped entry.
	 * Can be used by both the full 'mal review' loop and the surgical 'fix' command.
	 */
	async reviewSingleEntry(entry: MappingEntry): Promise<ReviewResult> {
		console.log(`\n========================================`);
		console.log(`Local Title: "${entry.title}" (Platform: ${entry.platform})`);

		while (true) {
			const input = await this.promptFn(
				`Choose action (s <query> / id <number> / k to skip / q to quit): `,
			);
			const cmd = input.trim().toLowerCase();

			if (cmd === "q") {
				console.log("Exiting review session.");
				return ReviewResult.QUIT;
			}

			if (cmd === "k") {
				console.log("Skipping...");
				return ReviewResult.SKIPPED;
			}

			if (cmd.startsWith("s ")) {
				const query = input.substring(2).trim();
				console.log(`Searching MyAnimeList for "${query}"...`);
				try {
					const results = await this.malPlatform.searchAnime(query);
					if (results.length === 0) {
						console.log("No results found.");
						continue;
					}

					console.log("\nSearch Results:");
					results.slice(0, 5).forEach((cand, idx) => {
						console.log(`  [${idx + 1}] "${cand.title}" - ID: ${cand.platform_id}`);
						console.log(`      Link: ${cand.url}`);
					});

					const choiceInput = await this.promptFn(
						"Select result number to assign (or press Enter to search again): ",
					);
					const choiceIdx = parseInt(choiceInput.trim(), 10) - 1;

					if (choiceIdx >= 0 && choiceIdx < results.length) {
						const selected = results[choiceIdx];
						const { mal_id, mal_title, ...safeExtraData } = entry;
						this.repo.setMapping(
							entry.platform || "",
							entry.platform_id || "",
							Number(selected.platform_id),
							selected.title,
							safeExtraData,
						);
						console.log(`✅ Assigned: "${selected.title}" (ID: ${selected.platform_id})`);
						return ReviewResult.RESOLVED;
					}
				} catch (err: unknown) {
					console.error("Search failed:", err instanceof Error ? err.message : String(err));
				}
			} else if (cmd.startsWith("id ")) {
				const malId = parseInt(input.substring(3).trim(), 10);
				if (Number.isNaN(malId)) {
					console.log("Invalid MAL ID.");
					continue;
				}

				console.log(`Fetching info for MAL ID: ${malId}...`);
				try {
					const res = await this.malPlatform.request(`https://myanimelist.net/anime/${malId}`);
					const html = await res.text();
					const $ = cheerio.load(html);
					const title = $("h1.title-name strong").text().trim() || $("h1.title-name").text().trim();

					if (title) {
						const { mal_id, mal_title, ...safeExtraData } = entry;
						this.repo.setMapping(
							entry.platform || "",
							entry.platform_id || "",
							malId,
							title,
							safeExtraData,
						);
						console.log(`✅ Assigned: "${title}" (ID: ${malId})`);
						return ReviewResult.RESOLVED;
					}
					console.log("Failed to parse title for this MAL ID. Please verify the ID.");
				} catch (err: unknown) {
					console.error(
						"Failed to fetch MAL ID:",
						err instanceof Error ? err.message : String(err),
					);
				}
			} else {
				console.log("Invalid input. Enter a choice or one of the commands.");
			}
		}
		return ReviewResult.SKIPPED;
	}

	/**
	 * Iterates through all unmapped entries in the DB and runs the interactive prompt.
	 */
	async runFullReviewLoop() {
		const mappings = this.repo.loadMappings();
		const pending = Object.values(mappings).filter(
			(val) => !val.mal_id || Number(val.mal_id) === 0,
		);

		if (pending.length === 0) {
			console.log("✅ All anime entries are already matched! Nothing to review.");
			return;
		}

		console.log(
			`\nStarting interactive review. There are ${pending.length} pending unmatched entries.`,
		);
		console.log("Commands:");
		console.log("  s <query> - Search MyAnimeList for a custom title");
		console.log("  id <number> - Manually set a MyAnimeList ID");
		console.log("  k - Keep unmatched / skip");
		console.log("  q - Quit");

		let resolvedCount = 0;
		for (const entry of pending) {
			const result = await this.reviewSingleEntry(entry);
			if (result === ReviewResult.QUIT) {
				break;
			}
			if (result === ReviewResult.RESOLVED) {
				resolvedCount++;
			}
		}

		console.log(`\nReview session complete. You manually resolved ${resolvedCount} entries!`);
	}
}
