import { OPENROUTER_SITE_URL } from "./openrouter";

export const RESEARCH_EMAIL_FROM_DEFAULT = "Ask <ask@wordsofthebuddha.org>";

const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|::1|0\.0\.0\.0)$/i;

/** Public site only — never a local/dev origin, even if the job ran there. */
export function publicResearchEmailOrigin(origin?: string | null): string {
	const raw = (origin || "").trim().replace(/\/+$/, "");
	if (!raw) return OPENROUTER_SITE_URL;
	try {
		const url = new URL(raw.includes("://") ? raw : `http://${raw}`);
		const host = url.hostname.replace(/^\[|\]$/g, "");
		if (LOOPBACK_HOST.test(host) || host.endsWith(".localhost")) {
			return OPENROUTER_SITE_URL;
		}
		return raw.includes("://") ? raw : `${url.protocol}//${url.host}`;
	} catch {
		return OPENROUTER_SITE_URL;
	}
}

export function researchResultHref(jobId: string, origin = OPENROUTER_SITE_URL): string {
	const id = jobId.replace(/\s+/g, "").trim();
	const base = publicResearchEmailOrigin(origin);
	return `${base}/search?mode=research&research=${encodeURIComponent(id)}`;
}

export function researchEmailFromAddress(
	from?: string | null,
	domain?: string | null,
): string {
	const explicit = (from || "").trim();
	if (explicit) return explicit;
	const host = (domain || "").trim().replace(/^@/, "");
	if (host) return `Ask <ask@${host}>`;
	return RESEARCH_EMAIL_FROM_DEFAULT;
}

export function buildResearchReadyEmail(input: {
	lookingFor: string;
	question: string;
	jobId: string;
	origin?: string;
	ok: boolean;
}): { subject: string; text: string; html: string; href: string } {
	const href = researchResultHref(input.jobId, input.origin);
	const theme =
		input.lookingFor.replace(/\s+/g, " ").trim() ||
		input.question.replace(/\s+/g, " ").trim() ||
		"your question";
	if (input.ok) {
		const subject = `Your research on ${theme} is ready`;
		const text = `Your research on ${theme} is ready.\n\nOpen it (signed in): ${href}\n`;
		const html = `<p>Your research on <strong>${escapeHtml(theme)}</strong> is ready.</p>
<p><a href="${escapeHtml(href)}">Open the briefing</a> — you’ll need to be signed in.</p>`;
		return { subject, text, html, href };
	}
	const subject = "Research could not finish";
	const text = `Research on ${theme} could not finish. You can try again from Ask (signed in): ${href}\n`;
	const html = `<p>Research on <strong>${escapeHtml(theme)}</strong> could not finish.</p>
<p><a href="${escapeHtml(href)}">Open Ask</a> and try again — you’ll need to be signed in.</p>`;
	return { subject, text, html, href };
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function env(name: string): string | undefined {
	const meta = (
		import.meta as ImportMeta & { env?: Record<string, string | undefined> }
	).env;
	const candidates = [
		typeof process !== "undefined" ? process.env[name] : undefined,
		meta?.[name],
	];
	for (const value of candidates) {
		if (value && value.trim()) return value.trim();
	}
	return undefined;
}

export function getResendApiKey(): string | undefined {
	return env("RESEND_API_KEY");
}

export async function sendResearchEmail(options: {
	to: string;
	lookingFor: string;
	question: string;
	jobId: string;
	origin?: string;
	ok: boolean;
}): Promise<{ sent: boolean; error?: string }> {
	const key = getResendApiKey();
	const to = options.to.trim();
	if (!key || !to) {
		return { sent: false, error: key ? "missing_to" : "missing_key" };
	}
	const from = researchEmailFromAddress(
		env("RESEARCH_EMAIL_FROM") || env("RESEND_EMAIL_FROM"),
		env("RESEND_EMAIL_DOMAIN"),
	);
	const payload = buildResearchReadyEmail({
		lookingFor: options.lookingFor,
		question: options.question,
		jobId: options.jobId,
		origin: options.origin,
		ok: options.ok,
	});
	try {
		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from,
				to: [to],
				subject: payload.subject,
				html: payload.html,
				text: payload.text,
			}),
		});
		if (!response.ok) {
			let message = `Resend failed (${response.status})`;
			try {
				const body = (await response.json()) as { message?: string };
				if (body.message) message = body.message;
			} catch {
				/* keep status */
			}
			return { sent: false, error: message };
		}
		return { sent: true };
	} catch (error) {
		return {
			sent: false,
			error: error instanceof Error ? error.message : "send_failed",
		};
	}
}
