import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEV_RELOAD_INDEX_FILES = new Set([
	"search-index.json",
	"reference-search-index.json",
]);

const INDEX_FILES = [
	"search-index.json",
	"search-meta.json",
	"reference-search-index.json",
	"suggestions-index.json",
	"discourse-suggest-index.json",
];
const GENERATED_DIR = "generated";
const CATEGORY_INDEX_FILE = "category-search-index.json";
const CATEGORY_DESCRIPTIONS_FILE = "category-discourse-descriptions.json";
const CATEGORY_INDEX_MODULE = "virtual:category-search-index-url";
const RESOLVED_CATEGORY_INDEX_MODULE = `\0${CATEGORY_INDEX_MODULE}`;

function generatedPath(root, file) {
	return join(root, GENERATED_DIR, file);
}

/**
 * Production builds emit the prebuilt category index as a hashed `/_astro/`
 * asset (immutable caching, service-worker cache-first). Dev exports null so
 * the client builds categories from the live mapping modules, which the
 * content watcher keeps current.
 */
function categorySearchIndexUrlPlugin() {
	let isBuild = false;
	let root = process.cwd();
	return {
		name: "category-search-index-url",
		configResolved(config) {
			isBuild = config.command === "build";
			root = config.root;
		},
		resolveId(id) {
			return id === CATEGORY_INDEX_MODULE
				? RESOLVED_CATEGORY_INDEX_MODULE
				: undefined;
		},
		load(id) {
			if (id !== RESOLVED_CATEGORY_INDEX_MODULE) return undefined;
			const unavailable =
				"export const categorySearchIndexUrl = null;\nexport const categoryDescriptionsUrl = null;";
			if (!isBuild) return unavailable;
			const missing = [CATEGORY_INDEX_FILE, CATEGORY_DESCRIPTIONS_FILE].filter(
				(file) => !existsSync(generatedPath(root, file)),
			);
			if (missing.length > 0) {
				this.warn(
					`Missing ${missing.map((f) => `${GENERATED_DIR}/${f}`).join(", ")}; /search will build categories from mapping modules`,
				);
				return unavailable;
			}
			return [
				`export { default as categorySearchIndexUrl } from "/${GENERATED_DIR}/${CATEGORY_INDEX_FILE}?url";`,
				`export { default as categoryDescriptionsUrl } from "/${GENERATED_DIR}/${CATEGORY_DESCRIPTIONS_FILE}?url";`,
			].join("\n");
		},
	};
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
							categorySearchIndexUrlPlugin(),
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
											const body = readFileSync(path);
											res.setHeader(
												"Content-Length",
												String(body.length),
											);
											if (req.method === "HEAD") {
												res.end();
												return;
											}
											res.end(body);
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
