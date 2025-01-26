import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const baseSchema = z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    fetter: z.string().optional(),
    tags: z.string().optional(),
    simile: z.string().optional(),
});

const bookSchema = baseSchema.extend({
    title: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    summary: z.string().optional(),
    author: z.string().optional(),
    imagePath: z.string().optional(),
    order: z.number().int().optional(),
});

function createCollection(base: string, pattern: string = "*.mdx", schema = baseSchema) {
    return defineCollection({
        loader: glob({ pattern, base }),
        schema,
    });
}

const dhp = createCollection("src/content/en/dhp/");
const mn = createCollection("src/content/en/mn/");
const ud = createCollection("src/content/en/ud/");
const sn = createCollection("src/content/en/sn/");
const an = createCollection("src/content/en/an/");
const snp = createCollection("src/content/en/snp/");
const iti = createCollection("src/content/en/iti/");
const books = createCollection("src/content/en/books/", "*.mdx", bookSchema);
const all = createCollection("src/content/en/", "**/*.mdx");

export const collections = { dhp, mn, ud, sn, snp, an, iti, books, all };