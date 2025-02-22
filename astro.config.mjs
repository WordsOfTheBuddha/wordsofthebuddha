// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import mdx from "@astrojs/mdx";
import vercel from "@astrojs/vercel";
import rehypeExternalLinks from "rehype-external-links";

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
		ssr: {
			noExternal: ["rangy"],
		},
	},

	adapter: vercel({
		maxDuration: 30,
	}),

	redirects: {
		"/dhammapada": "/dhp",
		"/suttanipata": "/snp",
		"/in-the-buddhas-words": "/anthologies/in-the-buddhas-words",
		"/noble-truths-noble-path": "/anthologies/noble-truths-noble-path",
	},
});
