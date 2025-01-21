// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import mdx from "@astrojs/mdx";
import rehypeExternalLinks from "rehype-external-links";
import { rehypeVerseParagraphs } from "./src/utils/rehype-verse-paragraphs.js";
import remarkBreaks from "remark-breaks";

const externalLinksOptions = {
  target: "_blank",
  rel: ["noopener", "noreferrer"],
  content: { type: "text", value: " ↗" },
};

// https://astro.build/config
export default defineConfig({
  markdown: {
    remarkPlugins: [[remarkBreaks, { soft: false }]],
    rehypePlugins: [
      rehypeVerseParagraphs,
      [rehypeExternalLinks, externalLinksOptions],
    ],
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    mdx({
      rehypePlugins: [
        rehypeVerseParagraphs,
        [rehypeExternalLinks, externalLinksOptions],
      ],
    }),
  ],
});
