import { completeMALWatching } from "./src/cli/malCli.js";

completeMALWatching().catch((err) => {
	console.error("An unexpected error occurred:", err);
});
