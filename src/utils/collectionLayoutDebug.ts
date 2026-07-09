const DEBUG_STORAGE_KEY = "debug-collection-layout";

/** Dev-only diagnostics for collection filter, ref toggle, and scroll spy. */
export function isCollectionLayoutDebug(): boolean {
	if (typeof window === "undefined") return false;
	try {
		if (new URLSearchParams(window.location.search).get("debug") === "1") {
			return true;
		}
		return localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
	} catch {
		return false;
	}
}

export function collectionLayoutDebugLog(...args: unknown[]): void {
	if (isCollectionLayoutDebug()) {
		console.log("[collection-layout]", ...args);
	}
}
