#!/usr/bin/env node
/**
 * Copies src/assets/content-images to public/content-images so images
 * are available at clean permalink URLs: /content-images/{filename}
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "src/assets/content-images");
const dest = join(process.cwd(), "public/content-images");

if (existsSync(src)) {
	mkdirSync(dest, { recursive: true });
	cpSync(src, dest, { recursive: true });
}
