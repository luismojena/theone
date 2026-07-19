import fs from 'fs';
import path from 'path';
import {
  DATA_DIR,
  SCRAPED_FILE,
  RESOLVED_FILE,
  SYNC_JKANIME_FILE,
  MAPPINGS_FILE,
  EXPORT_FILE,
  ensureDataDir
} from './utils.js';

export const BACKUPS_DIR = `${DATA_DIR}/backups`;

export function getBackupTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-');
}

export function createBackupDirectory(timestamp = null) {
  ensureDataDir();
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const ts = timestamp || getBackupTimestamp();
  const backupFolder = path.join(BACKUPS_DIR, `backup_${ts}`);
  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true });
  }

  return backupFolder;
}

export async function runBackup() {
  console.log('--- Multi-Platform Watchlist Backup ---');
  const backupFolder = createBackupDirectory();
  console.log(`Backup folder created: ${backupFolder}`);

  const backupFiles = [
    { name: 'mappings.json', src: MAPPINGS_FILE },
    { name: 'resolved.json', src: RESOLVED_FILE },
    { name: 'scraped.json', src: SCRAPED_FILE },
    { name: 'sync_jkanime.json', src: SYNC_JKANIME_FILE },
    { name: 'import.xml', src: EXPORT_FILE }
  ];

  const archivedFiles = [];
  for (const item of backupFiles) {
    if (fs.existsSync(item.src)) {
      const dest = path.join(backupFolder, item.name);
      fs.copyFileSync(item.src, dest);
      archivedFiles.push(item.name);
      console.log(`  ✅ Backed up: ${item.name}`);
    } else {
      console.log(`  ℹ️ Skipped (file not present): ${item.name}`);
    }
  }

  // Create manifest file
  const manifest = {
    created_at: new Date().toISOString(),
    files_backed_up: archivedFiles,
    backup_path: backupFolder
  };

  const manifestPath = path.join(backupFolder, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\n✅ Backup complete! Archive saved to:`);
  console.log(`   ${backupFolder}`);
  return backupFolder;
}
