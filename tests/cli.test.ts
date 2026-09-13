import assert from "node:assert";
import { test } from "node:test";
import { buildCLI } from "../theone.js";

test("CLI structure defines main platform subcommands", () => {
	const cli = buildCLI();

	// Verify commands exist
	const commands = cli.commands.map((c) => c.name());

	assert.ok(commands.includes("db"));
	assert.ok(commands.includes("mal"));
	assert.ok(commands.includes("jkanime"));
	assert.ok(commands.includes("animeflv"));
});

test("CLI structure defines correct nested actions for mal", () => {
	const cli = buildCLI();
	const malCmd = cli.commands.find((c) => c.name() === "mal");

	assert.ok(malCmd);
	const actions = malCmd.commands.map((c) => c.name());
	assert.ok(actions.includes("export"));
	assert.ok(actions.includes("resolve"));
	assert.ok(actions.includes("review"));
	assert.ok(actions.includes("complete"));
});

test("CLI structure defines correct nested actions for jkanime", () => {
	const cli = buildCLI();
	const jkanimeCmd = cli.commands.find((c) => c.name() === "jkanime");

	assert.ok(jkanimeCmd);
	const actions = jkanimeCmd.commands.map((c) => c.name());
	assert.ok(actions.includes("fetch"));
	assert.ok(actions.includes("sync"));
});

test("CLI parses jkanime sync options correctly", () => {
	const cli = buildCLI();

	// We can't easily test action execution without mocking all of the legacy imports,
	// but we can test that the commands are configured to accept the options.
	const jkanimeCmd = cli.commands.find((c) => c.name() === "jkanime");
	const syncCmd = jkanimeCmd?.commands.find((c) => c.name() === "sync");

	const options = syncCmd?.options.map((o) => o.long);
	assert.ok(options.includes("--autoskip"));
	assert.ok(options.includes("--force"));
});
