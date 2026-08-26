/** Normalize a cache or manifest path and add slash / index.html variants. */
export function addPathVariantsToSet(path: string, set: Set<string>) {
	const p = path.split("#")[0];
	set.add(p);
	if (p.endsWith("/")) set.add(p.slice(0, -1));
	else set.add(p + "/");
	if (p.endsWith("/index.html")) set.add(p.replace(/\/?index\.html$/, "/"));
	else set.add((p.endsWith("/") ? p : p + "/") + "index.html");
}

/** True when `path` (or a slash/encoding variant) is already in `set`. */
export function anyVariantPresent(path: string, set: Set<string>): boolean {
	const candidates = new Set<string>([path]);
	try {
		candidates.add(encodeURI(path));
	} catch {}
	try {
		candidates.add(decodeURI(path));
	} catch {}
	const variants = new Set<string>();
	for (const p of candidates) addPathVariantsToSet(p, variants);
	for (const v of variants) if (set.has(v)) return true;
	return false;
}

/** Keep only URLs that are not already represented in the cached path set. */
export function filterUncachedPaths(
	urls: string[],
	cachedPathSet: Set<string>,
): string[] {
	return urls.filter((url) => !anyVariantPresent(url, cachedPathSet));
}
