import fs from 'fs';
import readline from 'readline';

export const DATA_DIR = './migrations';
export const SCRAPED_FILE = `${DATA_DIR}/scraped.json`;
export const RESOLVED_FILE = `${DATA_DIR}/resolved.json`;
export const EXPORT_FILE = `${DATA_DIR}/import.xml`;
export const SYNC_JKANIME_FILE = `${DATA_DIR}/sync_jkanime.json`;
export const MAPPINGS_FILE = `${DATA_DIR}/mappings.json`;

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD") // Split accented chars into base + accent
    .replace(/[\u0300-\u036f]/g, "") // Remove accent markers
    .replace(/[^a-z0-9]/g, ''); // Keep only alphanumeric
}

export function extractSeason(title) {
  const t = title.toLowerCase();
  
  // Match patterns like "season 2", "s2", "2nd season", etc.
  let m = t.match(/(?:season|s)\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  m = t.match(/(\d+)(?:st|nd|rd|th)\s*season/);
  if (m) return parseInt(m[1], 10);
  
  // Match Roman numerals
  if (/\bii\b/.test(t) || /\b2\b/.test(t)) return 2;
  if (/\biii\b/.test(t) || /\b3\b/.test(t)) return 3;
  if (/\biv\b/.test(t) || /\b4\b/.test(t)) return 4;
  if (/\bv\b/.test(t) || /\b5\b/.test(t)) return 5;
  if (/\bvi\b/.test(t) || /\b6\b/.test(t)) return 6;
  
  return 1;
}

export function cleanBaseTitle(title) {
  return title
    .replace(/(?:season|s)\s*\d+/i, '')
    .replace(/\d+(?:st|nd|rd|th)\s*season/i, '')
    .replace(/\b(?:ii|iii|iv|v|vi)\b/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

export const CONFIG_FILE = `${DATA_DIR}/config.json`;

export function loadConfig() {
  ensureDataDir();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {}
  }
  return {};
}

export function saveConfig(config) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

export function normalizeJKAnimeStatus(statusStr) {

  if (!statusStr) return 'Watching';
  const norm = normalize(String(statusStr));

  if (norm.includes('completado') || norm === '2') {
    return 'Completed';
  }
  if (norm.includes('pausado') || norm.includes('espera') || norm === '5') {
    return 'On-Hold';
  }
  if (norm.includes('abandonado') || norm === '6') {
    return 'Dropped';
  }
  if (norm.includes('deseado') || norm.includes('porver') || norm === '4') {
    return 'Plan to Watch';
  }
  if (norm.includes('mirando') || norm.includes('viendo') || norm.includes('siguiendo') || norm === '1' || norm === '3') {
    return 'Watching';
  }

  return 'Watching';
}

