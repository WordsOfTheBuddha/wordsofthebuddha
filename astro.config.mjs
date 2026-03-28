// @ts-check
import { defineConfig } from "astro/config";
import { globSync } from "glob";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import tailwind from "@astrojs/tailwind";

import mdx from "@astrojs/mdx";
import vercel from "@astrojs/vercel";
import rehypeExternalLinks from "rehype-external-links";

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
	markdown: {
		rehypePlugins: [[rehypeExternalLinks, externalLinksOptions]],
	},

	integrations: [
		tailwind({
			applyBaseStyles: false,
		}),
		mdx({
			rehypePlugins: [[rehypeExternalLinks, externalLinksOptions]],
		}),
	],

	vite: {
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
		maxDuration: 30,
		includeFiles: vercelPdfIncludeContentImages,
	}),

	redirects: {
		"/dhammapada": "/dhp",
		"/suttanipata": "/snp",
		"/in-the-buddhas-words": "/anthologies/in-the-buddhas-words",
		"/noble-truths-noble-path": "/anthologies/noble-truths-noble-path",
		"/buddha-quote": "/buddha-quotes",
	},
});
