/** Comma-separated allowlist, e.g. you@example.com,other@example.com */
export function getAskAdminEmails(
	raw: string | undefined = process.env.ASK_ADMIN_EMAILS ||
		import.meta.env.ASK_ADMIN_EMAILS,
): string[] {
	if (!raw || typeof raw !== "string") return [];
	return raw
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
}

export function isAskAdminEmail(
	email: string | null | undefined,
	allowlist = getAskAdminEmails(),
): boolean {
	if (!email) return false;
	const normalized = email.trim().toLowerCase();
	return allowlist.includes(normalized);
}
