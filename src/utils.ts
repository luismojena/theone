import fs from "node:fs";
import readline from "node:readline";

export const sleep = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

export function normalize(str: string) {
	if (!str) return "";
	return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function extractSeason(title: string) {
	const match =
		title.match(/(\d+)(st|nd|rd|th)?\s+season/i) ||
		title.match(/season\s+(\d+)/i);
	return match ? parseInt(match[1]!, 10) : 1;
}

export function cleanBaseTitle(title: string) {
	return title
		.replace(/(\d+)(st|nd|rd|th)?\s+season/i, "")
		.replace(/season\s+(\d+)/i, "")
		.replace(/\s+part\s+\d+/i, "")
		.replace(/\s+cour\s+\d+/i, "")
		.replace(/\s+-\s+.*$/, "")
		.replace(/:\s+.*$/, "")
		.trim();
}

export function askQuestion(query: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	return new Promise((resolve) =>
		rl.question(query, (ans) => {
			rl.close();
			resolve(ans.trim());
		}),
	);
}

export function loadConfig(): Record<string, any> {
	return {};
}

export function saveConfig(_config: any) {}

export function normalizeJKAnimeStatus(statusStr: string) {
	const low = statusStr.toLowerCase();
	if (low.includes("viendo")) return "Watching";
	if (low.includes("completado")) return "Completed";
	if (low.includes("espera")) return "On-Hold";
	if (low.includes("abandonado")) return "Dropped";
	if (low.includes("planeo")) return "Plan to Watch";
	return "Watching"; // default
}

import path from "node:path";

export const DATA_DIR = "./migrations";
export const CONFIG_FILE = path.join(DATA_DIR, "config.json");
export const SCRAPED_FILE = path.join(DATA_DIR, "scraped.json");
export const RESOLVED_FILE = path.join(DATA_DIR, "resolved.json");
export const SYNC_JKANIME_FILE = path.join(DATA_DIR, "sync_jkanime.json");
export const MAPPINGS_FILE = path.join(DATA_DIR, "mappings.json");
export const EXPORT_FILE = path.join(DATA_DIR, "import.xml");

export function ensureDataDir() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
}
