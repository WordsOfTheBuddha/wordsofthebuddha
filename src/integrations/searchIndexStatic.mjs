import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const INDEX_FILES = [
	"search-index.json",
	"reference-search-index.json",
	"suggestions-index.json",
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
