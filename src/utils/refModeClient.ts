import {
	deleteRefParam,
	getRefParamFromUrl,
	setRefParam,
	setRefParamOff,
	urlHasRefParam,
} from "./urlRefParam";

export const REF_MODE_STORAGE_KEY = "refMode";

export function getStoredRefMode(): boolean {
	return localStorage.getItem(REF_MODE_STORAGE_KEY) === "true";
}

export function setStoredRefMode(enabled: boolean): void {
	if (enabled) {
		localStorage.setItem(REF_MODE_STORAGE_KEY, "true");
	} else {
		localStorage.removeItem(REF_MODE_STORAGE_KEY);
	}
}

/** URL `ref` / `all` when present, otherwise localStorage. */
export function resolveRefMode(
	params: URLSearchParams = new URLSearchParams(window.location.search),
): boolean {
	const fromUrl = getRefParamFromUrl(params);
	if (fromUrl !== null) return fromUrl;
	return getStoredRefMode();
}

/**
 * Sync an explicit URL ref param to localStorage; when absent, apply stored
 * ref mode to the URL (mirrors pli/layout link param behavior).
 * `defaultOnIfUnset` shows refs when the URL and storage are both silent
 * (Pali-only person pages).
 */
export function initRefModeFromUrl(
	options: { defaultOnIfUnset?: boolean } = {},
): boolean {
	const url = new URL(window.location.href);
	const fromUrl = getRefParamFromUrl(url.searchParams);

	if (fromUrl !== null) {
		setStoredRefMode(fromUrl);
		return fromUrl;
	}
	if (getStoredRefMode()) {
		setRefParam(url);
		window.history.replaceState({}, "", url);
		return true;
	}
	return options.defaultOnIfUnset === true;
}

export { deleteRefParam, setRefParam, setRefParamOff, urlHasRefParam };
