import { defineCollection, z } from "astro:content";
import { file, glob } from "astro/loaders";

const dhp = defineCollection({
    loader: glob({ pattern: "*.mdx", base: "src/content/en/dhp/" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        fetter: z.string(),
        id: z.string(),
        tags: z.string(),
        simile: z.string().optional(),
        slug: z.string().optional(),
        filePath: z.string().optional(),
    }),
});

const mn = defineCollection({
    loader: glob({ pattern: "*.mdx", base: "src/content/en/mn/" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        fetter: z.string(),
        id: z.string(),
        tags: z.string(),
        simile: z.string().optional(),
        slug: z.string().optional(),
        filePath: z.string().optional(),
    }),
});

const all = defineCollection({
    loader: glob({ pattern: "**/*.mdx", base: "src/content/en/" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        fetter: z.string(),
        id: z.string(),
        tags: z.string(),
        simile: z.string().optional(),
        slug: z.string().optional(),
        filePath: z.string().optional(),
    }),
});

export const collections = { dhp, mn, all };