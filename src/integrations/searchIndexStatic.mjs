import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEV_RELOAD_INDEX_FILES = new Set([
	"search-index.json",
	"reference-search-index.json",
]);

const INDEX_FILES = [
	"search-index.json",
	"reference-search-index.json",
	"suggestions-index.json",
	"discourse-suggest-index.json",
];
const GENERATED_DIR = "generated";

function generatedPath(root, file) {
	return join(root, GENERATED_DIR, file);
}

/** Copy generated search indexes to client static output; serve them in dev. */
export function searchIndexStatic() {
	return {
		name: "search-index-static",
		hooks: {
			"astro:config:setup": ({ updateConfig }) => {
				updateConfig({
					vite: {
						plugins: [
							{
								name: "search-index-static-serve",
								configureServer(server) {
									const root = server.config.root;
									for (const file of INDEX_FILES) {
										server.middlewares.use((req, res, next) => {
											if (req.url !== `/${file}`) {
												next();
												return;
											}
											const path = generatedPath(root, file);
											if (!existsSync(path)) {
												next();
												return;
											}
											res.setHeader(
												"Content-Type",
												"application/json",
											);
											res.end(readFileSync(path));
										});
									}

									// Dev: start background cache rebuild when contentWatcher
									// rewrites generated search indexes (stale-while-revalidate).
									const watchPaths = [
										...DEV_RELOAD_INDEX_FILES,
									].map((file) => generatedPath(root, file));
									for (const watchPath of watchPaths) {
										if (existsSync(watchPath)) {
											server.watcher.add(watchPath);
										}
									}

									const scheduleDevSearchCacheReload = async (
										changedFile,
									) => {
										const name = basename(changedFile);
										if (!DEV_RELOAD_INDEX_FILES.has(name)) return;
										const mod = await server.ssrLoadModule(
											"/src/utils/loadSearchIndexData.ts",
										);
										if (name === "search-index.json") {
											mod.scheduleNativeSearchIndexReload?.();
										} else if (
											name === "reference-search-index.json"
										) {
											mod.scheduleReferenceSearchIndexReload?.();
										}
									};

									server.watcher.on("change", (changedFile) => {
										scheduleDevSearchCacheReload(changedFile).catch(
											(err) => {
												console.error(
													"[search-index-static] dev cache reload failed:",
													err,
												);
											},
										);
									});
									server.watcher.on("add", (changedFile) => {
										scheduleDevSearchCacheReload(changedFile).catch(
											(err) => {
												console.error(
													"[search-index-static] dev cache reload failed:",
													err,
												);
											},
										);
									});
								},
							},
						],
					},
				});
			},
			"astro:build:done": ({ dir, logger }) => {
				const root = process.cwd();
				const clientDir = fileURLToPath(dir);
				mkdirSync(clientDir, { recursive: true });
				for (const file of INDEX_FILES) {
					const src = generatedPath(root, file);
					if (existsSync(src)) {
						copyFileSync(src, join(clientDir, file));
						logger.info(`Copied ${file} to client static output`);
					} else {
						logger.warn(`Missing ${src}; search index not copied`);
					}
				}
			},
		},
	};
}
