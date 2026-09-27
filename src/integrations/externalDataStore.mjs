import { createHash } from "node:crypto";
import { posix } from "node:path";

const DATA_STORE_ID = "\0astro:data-layer-content";
const INLINE_PREFIX = "export default JSON.parse(";
const PLACEHOLDER = "__WOTB_EXTERNAL_DATA_STORE__";

/**
 * Astro inlines the whole content data store (~90 MB of en/pli/reference
 * entries) into the server bundle as one escaped string literal passed to
 * `JSON.parse`. V8 spends ~8 s compiling that literal on every cold start of
 * `_render.func`, before any content route can respond; reading the same JSON
 * from a sibling file and parsing it takes <1 s.
 *
 * Build-only, server environments only: rewrites the module to read a `.json`
 * asset emitted next to the chunk that ends up holding it. `@vercel/nft`
 * traces `readFileSync(new URL(..., import.meta.url))`, so the file ships in
 * the function. If Astro changes the module shape, the inline code is left
 * untouched.
 */
export function externalDataStoreVitePlugin() {
	/** @type {Map<string, string>} environment name → raw store JSON */
	const storeByEnv = new Map();

	return {
		name: "wotb-external-data-store",
		apply: "build",
		transform(code, id) {
			if (id !== DATA_STORE_ID) return null;
			if (this.environment?.config?.consumer !== "server") return null;
			const trimmed = code.trim();
			if (!trimmed.startsWith(INLINE_PREFIX) || !trimmed.endsWith(")")) {
				return null;
			}
			const literal = trimmed.slice(INLINE_PREFIX.length, -1);
			let json;
			try {
				json = JSON.parse(literal);
			} catch {
				return null;
			}
			if (typeof json !== "string") return null;
			storeByEnv.set(this.environment.name, json);
			return {
				code: [
					'import { readFileSync } from "node:fs";',
					`export default JSON.parse(readFileSync(new URL(${JSON.stringify(`./${PLACEHOLDER}`)}, import.meta.url), "utf8"));`,
				].join("\n"),
				map: { mappings: "" },
			};
		},
		generateBundle(_options, bundle) {
			const json = storeByEnv.get(this.environment?.name);
			if (json === undefined) return;
			const chunk = Object.values(bundle).find(
				(output) =>
					output.type === "chunk" && output.code.includes(PLACEHOLDER),
			);
			if (!chunk) {
				this.error("external data store: chunk with placeholder not found");
			}
			const hash = createHash("sha256").update(json).digest("hex").slice(0, 10);
			const assetName = `astro-data-store.${hash}.json`;
			this.emitFile({
				type: "asset",
				fileName: posix.join(posix.dirname(chunk.fileName), assetName),
				source: json,
			});
			chunk.code = chunk.code.replaceAll(PLACEHOLDER, assetName);
		},
	};
}
