/**
 * Browser helper for Ask / Review Room / Profile verify banners.
 * Sending is handled by `/api/auth/resend-verification` (server-side).
 */
export async function resendVerificationEmail(): Promise<{
	ok: boolean;
	alreadyVerified?: boolean;
	email?: string;
	error?: string;
}> {
	try {
		const response = await fetch("/api/auth/resend-verification", {
			method: "POST",
			credentials: "same-origin",
			headers: { Accept: "application/json" },
			redirect: "error",
		});
		const contentType = response.headers.get("content-type") || "";
		if (!contentType.includes("application/json")) {
			return {
				ok: false,
				error:
					"Verification send isn’t available on this server yet. Refresh the page and try again.",
			};
		}
		const data = (await response.json()) as {
			success?: boolean;
			alreadyVerified?: boolean;
			email?: string;
			error?: string;
		};
		if (data.alreadyVerified) {
			return { ok: true, alreadyVerified: true, email: data.email };
		}
		if (!response.ok || !data.success) {
			return {
				ok: false,
				email: data.email,
				error: data.error || "Could not send the verification email.",
			};
		}
		return { ok: true, email: data.email };
	} catch (error: unknown) {
		const name =
			error && typeof error === "object" && "name" in error
				? String((error as { name?: unknown }).name)
				: "";
		if (name === "TypeError") {
			// fetch redirect: "error" throws when the API route is missing (dev stale).
			return {
				ok: false,
				error:
					"Verification send isn’t available on this server yet. Refresh the page and try again.",
			};
		}
		return {
			ok: false,
			error: "Network error while sending the verification email.",
		};
	}
}
