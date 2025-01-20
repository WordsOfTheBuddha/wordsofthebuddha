import { defineCollection, z } from "astro:content";
import { file, glob } from "astro/loaders";

const dhp = defineCollection({
    loader: glob({ pattern: "*.mdx", base: "src/content/en/dhp/" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        fetter: z.string().optional(),
        tags: z.string().optional(),
        slug: z.string(),
        simile: z.string().optional(),
        filePath: z.string().optional(),
    }),
});

const mn = defineCollection({
    loader: glob({ pattern: "*.mdx", base: "src/content/en/mn/" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        fetter: z.string().optional(),
        tags: z.string().optional(),
        simile: z.string().optional(),
        slug: z.string(),
        filePath: z.string().optional(),
    }),
});

const ud = defineCollection({
    loader: glob({ pattern: "*.mdx", base: "src/content/en/ud/" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        fetter: z.string().optional(),
        tags: z.string().optional(),
        simile: z.string().optional(),
        slug: z.string(),
        filePath: z.string().optional(),
    }),
});

const sn = defineCollection({
    loader: glob({ pattern: "*.mdx", base: "src/content/en/sn/" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        fetter: z.string().optional(),
        tags: z.string().optional(),
        simile: z.string().optional(),
        slug: z.string(),
        filePath: z.string().optional(),
    }),
});

const an = defineCollection({
    loader: glob({ pattern: "*.mdx", base: "src/content/en/an/" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        fetter: z.string().optional(),
        tags: z.string().optional(),
        simile: z.string().optional(),
        slug: z.string(),
        filePath: z.string().optional(),
    }),
});

const snp = defineCollection({
    loader: glob({ pattern: "*.mdx", base: "src/content/en/snp/" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        fetter: z.string().optional(),
        tags: z.string().optional(),
        simile: z.string().optional(),
        slug: z.string(),
        filePath: z.string().optional(),
    }),
});

const iti = defineCollection({
    loader: glob({ pattern: "*.mdx", base: "src/content/en/iti/" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        fetter: z.string().optional(),
        tags: z.string().optional(),
        simile: z.string().optional(),
        slug: z.string(),
        filePath: z.string().optional(),
    }),
});

const all = defineCollection({
    loader: glob({ pattern: "**/*.mdx", base: "src/content/en/" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        fetter: z.string().optional(),
        tags: z.string().optional(),
        simile: z.string().optional(),
        slug: z.string(),
        filePath: z.string().optional(),
    }),
});

export const collections = { dhp, mn, ud, sn, snp, an, iti, all };