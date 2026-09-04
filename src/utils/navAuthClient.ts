export const NAV_AUTH_STORAGE_KEY = "nav-auth";

export type NavAuthCache =
	| { signedIn: true; displayName: string }
	| { signedIn: false };

export type NavAuthRenderOptions = {
	registerHref: string;
	returnTo: string;
	hideGuestCta: boolean;
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function readNavAuthCache(): NavAuthCache | null {
	try {
		const raw = localStorage.getItem(NAV_AUTH_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<NavAuthCache>;
		if (parsed.signedIn === true) {
			if (typeof parsed.displayName !== "string") return null;
			const displayName = parsed.displayName.trim();
			if (!displayName) return null;
			return { signedIn: true, displayName };
		}
		if (parsed.signedIn === false) return { signedIn: false };
		return null;
	} catch {
		return null;
	}
}

export function writeNavAuthCache(value: NavAuthCache): void {
	try {
		localStorage.setItem(NAV_AUTH_STORAGE_KEY, JSON.stringify(value));
	} catch {
		// ignore quota / private mode
	}
}

export function clearNavAuthCache(): void {
	try {
		localStorage.removeItem(NAV_AUTH_STORAGE_KEY);
	} catch {
		// ignore
	}
}

export function signedInNavAuthHtml(
	displayName: string,
	returnTo: string,
): string {
	const name = escapeHtml(displayName);
	const returnValue = escapeHtml(returnTo);
	return `
		<button type="button" id="user-menu-button" class="flex items-center gap-2 px-1 py-1 text-sm font-medium text-[var(--text-color)] hover:text-[var(--link-hover-color)] focus:outline-none">
			<span>${name}</span>
			<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
			</svg>
		</button>
		<div id="user-menu" class="hidden absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-[var(--auth-card-bg)] ring-1 ring-black ring-opacity-5">
			<div class="py-1">
				<a href="/discover" class="block px-4 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--auth-input-bg)]">Discover</a>
				<a href="/review-room" class="block px-4 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--auth-input-bg)]">Review Room</a>
				<a href="/profile" class="block px-4 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--auth-input-bg)]">Profile</a>
				<form action="/api/auth/signout" method="post">
					<input type="hidden" name="returnTo" value="${returnValue}" />
					<button type="submit" class="block w-full text-left px-4 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--auth-input-bg)]">Sign out</button>
				</form>
			</div>
		</div>`;
}

export function signedOutNavAuthHtml(registerHref: string): string {
	const href = escapeHtml(registerHref);
	return `<a href="${href}" class="px-3 py-1 text-sm border rounded-md font-medium text-white bg-[var(--auth-button-bg)] border-[var(--auth-button-bg)] hover:bg-[var(--auth-button-hover)] hover:border-[var(--auth-button-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-color)]">Register</a>`;
}

export function navAuthSlotMatches(
	slot: HTMLElement,
	state: NavAuthCache,
): boolean {
	const current = slot.getAttribute("data-state");
	if (state.signedIn) {
		if (current !== "signed-in") return false;
		const name =
			slot.querySelector("#user-menu-button span")?.textContent?.trim() ??
			"";
		return name === state.displayName;
	}
	return current === "signed-out";
}

export function renderNavAuthSlot(
	slot: HTMLElement,
	state: NavAuthCache,
	options: NavAuthRenderOptions,
): void {
	if (navAuthSlotMatches(slot, state)) {
		slot.removeAttribute("aria-busy");
		return;
	}

	slot.removeAttribute("aria-busy");
	if (state.signedIn) {
		slot.setAttribute("data-state", "signed-in");
		slot.innerHTML = signedInNavAuthHtml(state.displayName, options.returnTo);
		return;
	}

	slot.setAttribute("data-state", "signed-out");
	slot.innerHTML = options.hideGuestCta
		? ""
		: signedOutNavAuthHtml(options.registerHref);
}

export function seedNavAuthCacheFromSlot(slot: HTMLElement): void {
	const state = slot.getAttribute("data-state");
	if (state === "signed-in") {
		const displayName =
			slot.querySelector("#user-menu-button span")?.textContent?.trim() ??
			"";
		if (displayName) writeNavAuthCache({ signedIn: true, displayName });
		return;
	}
	if (state === "signed-out") {
		writeNavAuthCache({ signedIn: false });
	}
}
