import { highlightSlugFromUrl } from "./highlightSlug";

export type PageUserState = {
	signedIn: boolean;
	user?: {
		displayName: string;
		email: string | null;
		emailVerified: boolean;
	};
	hasRead: boolean;
	isSaved: boolean;
	isInReadLater: boolean;
	highlights: { rangyHash?: string } | null;
};

const DISCOURSE_SLUG = /^[a-z]+\d/i;

export function emptyPageUserState(): PageUserState {
	return {
		signedIn: false,
		hasRead: false,
		isSaved: false,
		isInReadLater: false,
		highlights: null,
	};
}

/** Last path segment when it looks like `mn1` / `sn55.21`, else empty. */
export function discourseSlugFromPath(pathname: string): string {
	const cleaned = pathname.replace(/^\/+/, "").split("?")[0].split("#")[0];
	const last = cleaned.split("/").filter(Boolean).pop() || "";
	return DISCOURSE_SLUG.test(last) ? last : "";
}

export function pageStateQueryFromLocation(loc: {
	href: string;
	pathname: string;
}): URLSearchParams {
	const params = new URLSearchParams();
	const slug = discourseSlugFromPath(loc.pathname);
	if (slug) params.set("slug", slug);
	params.set("highlightSlug", highlightSlugFromUrl(loc.href));
	return params;
}

function parsePageUserState(data: unknown): PageUserState {
	const empty = emptyPageUserState();
	if (!data || typeof data !== "object") return empty;
	const raw = data as Record<string, unknown>;
	const signedIn = raw.signedIn === true;
	const userRaw =
		raw.user && typeof raw.user === "object"
			? (raw.user as Record<string, unknown>)
			: null;
	const highlights =
		raw.highlights && typeof raw.highlights === "object"
			? (raw.highlights as { rangyHash?: string })
			: null;
	return {
		signedIn,
		user:
			signedIn && userRaw && typeof userRaw.displayName === "string"
				? {
						displayName: userRaw.displayName,
						email:
							typeof userRaw.email === "string"
								? userRaw.email
								: null,
						emailVerified: userRaw.emailVerified === true,
					}
				: undefined,
		hasRead: raw.hasRead === true,
		isSaved: raw.isSaved === true,
		isInReadLater: raw.isInReadLater === true,
		highlights,
	};
}

let inflight: Promise<PageUserState | null> | null = null;

export function resetPageUserStateClient(): void {
	inflight = null;
}

/**
 * One GET `/api/user/page-state` per page. Navbar, highlights, and the
 * read/save/read-later buttons all await this promise.
 */
export function loadPageUserState(): Promise<PageUserState | null> {
	if (inflight) return inflight;
	inflight = (async () => {
		const qs = pageStateQueryFromLocation(window.location);
		const res = await fetch(`/api/user/page-state?${qs}`, {
			credentials: "same-origin",
		});
		if (!res.ok) return null;
		return parsePageUserState(await res.json());
	})().catch(() => {
		inflight = null;
		return null;
	});
	return inflight;
}

export { parsePageUserState };
