const PROMPT_SELECTOR = "[data-prompt]";
const INSTALLED = new WeakSet<HTMLElement>();

let lastFocus: HTMLElement | null = null;

function currentReturnTo(): string {
	return `${window.location.pathname}${window.location.search}`;
}

export function applyAuthReturnPaths(prompt: HTMLElement): void {
	const returnTo = encodeURIComponent(currentReturnTo());
	prompt.querySelectorAll<HTMLAnchorElement>("a[data-auth-href]").forEach((link) => {
		const path = link.getAttribute("data-auth-href") || "";
		if (!path) return;
		link.href = `${path}?returnTo=${returnTo}`;
	});
}

export function hideSignInPrompt(
	prompt: HTMLElement,
	opts: { restoreFocus?: boolean } = {},
): void {
	prompt.hidden = true;
	prompt.setAttribute("aria-hidden", "true");
	if (opts.restoreFocus === false) return;
	if (lastFocus && document.contains(lastFocus)) {
		lastFocus.focus();
	}
	lastFocus = null;
}

export function showSignInPrompt(id: string): void {
	const prompt = document.getElementById(id);
	if (!prompt) return;

	document.querySelectorAll<HTMLElement>(PROMPT_SELECTOR).forEach((el) => {
		if (el !== prompt && !el.hidden) {
			hideSignInPrompt(el, { restoreFocus: false });
		}
	});

	lastFocus =
		document.activeElement && document.activeElement !== document.body
			? (document.activeElement as HTMLElement)
			: null;

	if (prompt.parentElement !== document.body) {
		document.body.appendChild(prompt);
	}

	applyAuthReturnPaths(prompt);
	prompt.hidden = false;
	prompt.setAttribute("aria-hidden", "false");

	const primary = prompt.querySelector<HTMLElement>(".site-dialog-primary");
	(primary ?? prompt.querySelector<HTMLElement>(".site-dialog-close"))?.focus();
}

function onEscape(event: KeyboardEvent): void {
	if (event.key !== "Escape") return;
	const open = document.querySelector<HTMLElement>(
		`${PROMPT_SELECTOR}:not([hidden])`,
	);
	if (!open) return;
	event.preventDefault();
	hideSignInPrompt(open);
}

export function installSignInPromptEscape(): void {
	const root = document.documentElement;
	if (root.dataset.signInPromptEscape === "1") return;
	root.dataset.signInPromptEscape = "1";
	document.addEventListener("keydown", onEscape);
}

export function installSignInPrompt(prompt: HTMLElement): void {
	if (INSTALLED.has(prompt)) return;
	INSTALLED.add(prompt);

	prompt.addEventListener("click", (event) => {
		if (event.target === prompt) hideSignInPrompt(prompt);
	});
	prompt.querySelector(".site-dialog-sheet")?.addEventListener("click", (event) => {
		event.stopPropagation();
	});
	prompt.querySelectorAll(".close-prompt").forEach((btn) => {
		btn.addEventListener("click", () => hideSignInPrompt(prompt));
	});

	applyAuthReturnPaths(prompt);
	installSignInPromptEscape();
}
