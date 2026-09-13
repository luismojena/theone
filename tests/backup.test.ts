import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
	createBackupDirectory,
	getBackupTimestamp,
	runBackup,
} from "../src/services/BackupService.js";

test("Backup Timestamp Format", () => {
	const ts = getBackupTimestamp();
	assert.strictEqual(typeof ts, "string");
	assert.ok(ts.length > 0);
	assert.ok(!ts.includes(":")); // colon safe for filenames
});

test("Backup Directory Creation", () => {
	const folder = createBackupDirectory("test_ts");
	assert.ok(fs.existsSync(folder));
	assert.ok(folder.includes("backup_test_ts"));
});

test("Run Backup Creates Archive and Manifest", async () => {
	const folder = await runBackup();
	assert.ok(fs.existsSync(folder));

	const manifestPath = path.join(folder, "manifest.json");
	assert.ok(fs.existsSync(manifestPath));

	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	assert.ok(Array.isArray(manifest.files_backed_up));
	assert.ok(manifest.created_at);
});
