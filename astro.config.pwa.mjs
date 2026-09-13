// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import node from "@astrojs/node";
import rehypeExternalLinks from "rehype-external-links";

const externalLinksOptions = {
	target: "_blank",
	rel: ["noopener", "noreferrer"],
	content: { type: "text", value: " ↗" },
};

export default defineConfig({
	markdown: {
		processor: unified({
			rehypePlugins: [[rehypeExternalLinks, externalLinksOptions]],
		}),
	},
	integrations: [
		tailwind({ applyBaseStyles: false }),
		mdx(),
	],
	vite: {
		optimizeDeps: { include: ["rangy", "mermaid"] },
		build: {
			commonjsOptions: { include: [/rangy/] },
			// See astro.config.mjs — lightningcss drops unprefixed backdrop-filter.
			cssMinify: "esbuild",
		},
		logLevel: "error",
		clearScreen: false,
		ssr: { noExternal: ["rangy"] },
	},
	output: "server",
	adapter: node({ mode: "standalone" }),
	// Remove server adapter and redirects to avoid routing issues in preview
	redirects: {
		"/dhammapada": "/dhp",
		"/suttanipata": "/snp",
		"/in-the-buddhas-words": "/anthologies/in-the-buddhas-words",
		"/noble-truths-noble-path": "/anthologies/noble-truths-noble-path",
		"/explore": "/discover",
		"/give": "/support",
		"/donate": "/support",
	},
});
