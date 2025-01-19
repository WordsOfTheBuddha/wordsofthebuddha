// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import mdx from "@astrojs/mdx";
import rehypeExternalLinks from "rehype-external-links";

// https://astro.build/config
export default defineConfig({
  markdown: {
    rehypePlugins: [
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
    mdx(),
  ],
});
