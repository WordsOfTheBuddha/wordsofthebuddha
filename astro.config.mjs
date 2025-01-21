// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import mdx from "@astrojs/mdx";
import rehypeExternalLinks from "rehype-external-links";
import { rehypeVerseParagraphs } from "./src/utils/rehype-verse-paragraphs.js";
import remarkBreaks from "remark-breaks";

// https://astro.build/config
export default defineConfig({
  markdown: {
    remarkPlugins: [[remarkBreaks, { soft: false }]],
    rehypePlugins: [
      rehypeVerseParagraphs,
      [
        rehypeExternalLinks,
        {
          content: { type: "text", value: " ↗" },
        },
      ],
    ],
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    mdx({
      rehypePlugins: [rehypeVerseParagraphs],
    }),
  ],
});
