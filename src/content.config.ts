import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const baseSchema = z.object({
	title: z.string(),
	slug: z.string(),
	description: z.string().optional(),
	qualities: z.string().optional(),
	theme: z.string().optional(),
	simile: z.string().optional(),
	topic: z.string().optional(),
	commentary: z.union([z.string(), z.array(z.string())]).optional(),
	priority: z.number().optional(),
	character: z.union([z.string(), z.array(z.string())]).optional(),
	// Content image (optional)
	// - image: custom path override (default: src/assets/content-images/{id}.{ext})
	// - imageCaption: caption with optional credit, e.g. "A lotus flower · Generated with ChatGPT"
	image: z.string().optional(),
	imageCaption: z.string().optional(),
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

const referenceSchema = baseSchema.extend({
	title: z.string().optional(),
	translator: z.string().optional(),
	license: z.string().optional(),
	source: z.string().optional(),
	edition: z.string().optional(),
	granularity: z.string().optional(),
});

function createCollection(
	base: string,
	pattern: string = "*.mdx",
	schema = baseSchema,
) {
	return defineCollection({
		loader: glob({ pattern, base }),
		schema,
	});
}

// NOTE: per-nikaya collections (dn/dhp/mn/ud/sn/an/snp/iti/kp) were removed:
// nothing read them (all lookups go through `all`, `pliAll`, `anthologies`, or
// the reference collections), and their glob loaders stored every English file
// a SECOND time in Astro's content data store (~100 MB in dev), doubling
// content-store reload and persist work after every content edit.

const anthologies = createCollection(
	"src/content/en/anthologies/",
	"*.mdx",
	bookSchema,
);
const pliSchema = baseSchema.extend({
	title: z.string().optional(),
	source: z.string().optional(),
	edition: z.string().optional(),
	granularity: z.string().optional(),
});
const all = createCollection("src/content/en/", "**/*.mdx");
const pliAll = createCollection("src/content/pli/", "**/*.md", pliSchema);
const referenceSujato = createCollection(
	"src/content/references/sujato/",
	"**/*.md",
	referenceSchema,
);
const referencePliMs = createCollection(
	"src/content/references/pli-ms/",
	"**/*.md",
	referenceSchema,
);
const gu = createCollection("src/content/gu/", "**/*.md");

export const collections = {
	anthologies,
	all,
	pliAll,
	referenceSujato,
	referencePliMs,
	gu,
};
