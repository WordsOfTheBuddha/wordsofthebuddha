#!/usr/bin/env node
/**
 * User-owned pm2 `astro-dev` entrypoint. Same stack as `yarn dev`:
 * predev (indexes, routes, catalogs) then content watcher + image watcher + astro.
 *
 * Node (not bash) so pm2 `node_args: --trace-deprecation` stays valid.
 */
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const extraPath = [
	join(homedir(), ".local/bin"),
	join(root, "node_modules/.bin"),
	"/opt/homebrew/bin",
	"/usr/local/bin",
].join(":");
process.env.PATH = `${extraPath}:${process.env.PATH ?? ""}`;

const child = spawn("yarn", ["dev"], {
	stdio: "inherit",
	env: process.env,
});

const stop = (signal) => {
	if (child.killed) return;
	child.kill(signal);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}
	process.exit(code ?? 1);
});
