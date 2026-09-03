/**
 * Server-side Firebase Auth email actions via Identity Toolkit REST.
 * Admin SDK can create custom tokens / links, but sending the template email
 * needs either the client SDK or this REST hop.
 */

const FIREBASE_WEB_API_KEY = "AIzaSyAqmA841Q4iPUszg2zZA07Z9PBOX0VUp6k";

export type SendVerificationResult =
	| { ok: true }
	| { ok: false; code: string; message: string };

function identityError(
	payload: { error?: { message?: string; errors?: { message?: string }[] } },
	fallback: string,
): { code: string; message: string } {
	const raw =
		payload.error?.message ||
		payload.error?.errors?.[0]?.message ||
		fallback;
	const code = raw.split(":")[0]?.trim() || "unknown";
	return { code, message: humanizeFirebaseAuthError(code, raw) };
}

/** Map Firebase Auth / Identity Toolkit codes to short user-facing copy. */
export function humanizeFirebaseAuthError(code: string, raw = ""): string {
	const normalized = code.toUpperCase();
	if (
		normalized.includes("TOO_MANY_ATTEMPTS") ||
		normalized.includes("TOO_MANY_REQUESTS")
	) {
		return "A verification email was already sent recently. Wait a few minutes, then check inbox and spam.";
	}
	if (normalized.includes("EMAIL_EXISTS") || normalized.includes("EMAIL_ALREADY_EXISTS")) {
		return "That email is already registered. Try signing in, or use a different address.";
	}
	if (normalized.includes("INVALID_EMAIL")) {
		return "That email address looks invalid.";
	}
	if (normalized.includes("USER_NOT_FOUND")) {
		return "No account found for that email. Create an account first.";
	}
	if (normalized.includes("UNAUTHORIZED_CONTINUE_URI") || normalized.includes("INVALID_CONTINUE_URI")) {
		return "Verification link setup is misconfigured for this site domain.";
	}
	if (normalized.includes("OPERATION_NOT_ALLOWED")) {
		return "Email verification is disabled in Firebase Auth. Enable the Email/Password provider templates.";
	}
	if (raw && raw !== code) return raw;
	return "Could not send the verification email. Try again in a few minutes.";
}

export {
	isGmailAddress,
	isGmailDotAliasPair,
} from "./emailVerificationCopy";

async function exchangeCustomToken(customToken: string): Promise<
	| { ok: true; idToken: string }
	| { ok: false; code: string; message: string }
> {
	const response = await fetch(
		`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				token: customToken,
				returnSecureToken: true,
			}),
		},
	);
	const payload = (await response.json()) as {
		idToken?: string;
		error?: { message?: string; errors?: { message?: string }[] };
	};
	if (!response.ok || !payload.idToken) {
		const err = identityError(payload, "CUSTOM_TOKEN_EXCHANGE_FAILED");
		return { ok: false, ...err };
	}
	return { ok: true, idToken: payload.idToken };
}

/** Send Firebase’s “verify email” template for the given Auth user. */
export async function sendFirebaseVerificationEmail(options: {
	customToken: string;
	continueUrl: string;
}): Promise<SendVerificationResult> {
	const exchanged = await exchangeCustomToken(options.customToken);
	if (!exchanged.ok) return exchanged;

	const response = await fetch(
		`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				requestType: "VERIFY_EMAIL",
				idToken: exchanged.idToken,
				continueUrl: options.continueUrl,
			}),
		},
	);
	const payload = (await response.json()) as {
		email?: string;
		error?: { message?: string; errors?: { message?: string }[] };
	};
	if (!response.ok) {
		const err = identityError(payload, "SEND_OOB_FAILED");
		return { ok: false, ...err };
	}
	return { ok: true };
}
