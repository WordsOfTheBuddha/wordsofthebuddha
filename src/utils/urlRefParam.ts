/** `true` / `false` when URL has `ref` or legacy `all`; `null` when absent. */
export function getRefParamFromUrl(
	params: URLSearchParams,
): boolean | null {
	for (const key of params.keys()) {
		const lower = key.toLowerCase();
		if (lower === "ref" || lower === "all") {
			return params.get(key) === "true";
		}
	}
	return null;
}

/** Case-insensitive `ref=true` (and legacy `all=true`) on collection/discourse URLs. */
export function urlHasRefParam(params: URLSearchParams): boolean {
	for (const key of params.keys()) {
		const lower = key.toLowerCase();
		if (
			(lower === "ref" || lower === "all") &&
			params.get(key) === "true"
		) {
			return true;
		}
	}
	return false;
}

export function deleteRefParam(url: URL): void {
	for (const key of [...url.searchParams.keys()]) {
		const lower = key.toLowerCase();
		if (lower === "ref" || lower === "all") {
			url.searchParams.delete(key);
		}
	}
}

export function setRefParam(url: URL): void {
	deleteRefParam(url);
	url.searchParams.set("ref", "true");
}
