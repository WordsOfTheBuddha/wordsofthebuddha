// @ts-check
import { defineConfig } from "astro/config";
import { globSync } from "glob";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import tailwind from "@astrojs/tailwind";

import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import vercel from "@astrojs/vercel";
import rehypeExternalLinks from "rehype-external-links";
import { searchIndexStatic } from "./src/integrations/searchIndexStatic.mjs";
import {
	silentDevReload,
	silentDevReloadViteConfig,
} from "./src/integrations/silentDevReload.mjs";
import { mnVaggaSections } from "./src/data/mnVaggaStructure.generated.ts";

const mnVaggaRedirects = Object.fromEntries(
	Object.entries(mnVaggaSections).flatMap(([pannasa, sections]) =>
		Object.keys(sections).map((slug) => [
			`/${slug}`,
			`/${pannasa}#${slug}`,
		]),
	),
);

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * PDF export (`/api/export/*`) reads SVG markup with `fs.readFileSync` from
 * `public/content-images/`. Vercel serverless bundles do not include `public/`
 * by default (those files are static assets on the CDN), so production would
 * see ENOENT unless we attach them here. `prebuild` runs `copyContentImages.mjs`
 * before `astro build`, so this glob is populated on CI.
 */
const vercelPdfIncludeContentImages = globSync("public/content-images/**/*", {
	cwd: __dirname,
	nodir: true,
	dot: false,
});

const externalLinksOptions = {
	target: "_blank",
	rel: ["noopener", "noreferrer"],
	content: { type: "text", value: " ↗" },
};

// https://astro.build/config
export default defineConfig({
	// Production serves www; the bare domain 308s to it. Required for absolute
	// canonical/OG URLs — without it `Astro.url` on prerendered pages resolves
	// against the build-time dev origin (localhost:4321).
	site: "https://www.wordsofthebuddha.org",

	markdown: {
		processor: unified({
			rehypePlugins: [[rehypeExternalLinks, externalLinksOptions]],
		}),
	},

	integrations: [
		silentDevReload(),
		searchIndexStatic(),
		tailwind({
			applyBaseStyles: false,
		}),
		mdx(),
	],

	vite: {
		...silentDevReloadViteConfig(),
		optimizeDeps: {
			include: ["rangy"],
		},
		build: {
			commonjsOptions: {
				include: [/rangy/],
			},
		},
		logLevel: "error",
		clearScreen: false,
		ssr: {
			noExternal: ["rangy"],
		},
	},

	adapter: vercel({
		// PDF export (/api/export/*) launches headless Chromium; Hobby Fluid Compute
		// caps serverless functions at 60s.
		maxDuration: 60,
		includeFiles: vercelPdfIncludeContentImages,
		excludeFiles: [
			"generated/search-index.json",
			"generated/search-meta.json",
			"generated/reference-search-index.json",
			"generated/suggestions-index.json",
			"generated/discourse-suggest-index.json",
		],
	}),

	redirects: {
		"/dhammapada": "/dhp",
		"/suttanipata": "/snp",
		"/in-the-buddhas-words": "/anthologies/in-the-buddhas-words",
		"/noble-truths-noble-path": "/anthologies/noble-truths-noble-path",
		"/buddha-quote": "/buddha-quotes",
		"/explore": "/discover",
		"/give": "/support",
		"/donate": "/support",
		...mnVaggaRedirects,
	},
});
