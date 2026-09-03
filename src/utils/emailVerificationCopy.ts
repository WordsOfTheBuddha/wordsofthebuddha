/** Client-safe copy for verification emails (no Firebase secrets). */

export function isGmailAddress(email: string): boolean {
	const domain = email.trim().toLowerCase().split("@")[1] || "";
	return domain === "gmail.com" || domain === "googlemail.com";
}

/**
 * Gmail ignores dots in the local part for delivery (a.b@gmail.com ≡ ab@gmail.com).
 * Firebase still treats them as different accounts.
 */
export function isGmailDotAliasPair(a: string, b: string): boolean {
	const norm = (email: string): { local: string; domain: string } | null => {
		const trimmed = email.trim().toLowerCase();
		const at = trimmed.lastIndexOf("@");
		if (at <= 0) return null;
		const local = trimmed.slice(0, at).split("+")[0] || "";
		const domain = trimmed.slice(at + 1);
		return { local, domain };
	};
	const left = norm(a);
	const right = norm(b);
	if (!left || !right) return false;
	const gmail =
		isGmailAddress(`${left.local}@${left.domain}`) &&
		isGmailAddress(`${right.local}@${right.domain}`);
	if (!gmail) return false;
	return left.local.replace(/\./g, "") === right.local.replace(/\./g, "");
}

export function verificationSentStatus(email?: string | null): string {
	const dest = email?.trim();
	if (!dest) {
		return "Verification email sent. Check your inbox and spam.";
	}
	return `Sent to ${dest}. Check inbox and spam.`;
}
