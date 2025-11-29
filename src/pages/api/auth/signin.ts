export const prerender = false;
import type { APIRoute } from "astro";
import { app, isFirebaseInitialized } from "../../../service/firebase/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import type { Note } from "../../../types/notes";

const SESSION_COOKIE_TIMEOUT = 40000; // Increase timeout to 40 seconds

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
	const opId = `signin-${Date.now()}`;
	console.log(`[${opId}] Sign-in request started`);

	// Check if Firebase is properly configured
	if (!isFirebaseInitialized || !app) {
		console.log(`[${opId}] Firebase not configured`);
		return new Response(
			"Authentication service is not available. Please check server configuration.",
			{
				status: 503,
				headers: {
					"Content-Type": "text/plain",
				},
			}
		);
	}

	const auth = getAuth(app);
	const db = getFirestore(app);

	/* Get token from request headers */
	const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
	if (!idToken) {
		console.log(`[${opId}] No token found in request headers`);
		return new Response("No token found", { status: 401 });
	}

	try {
		console.log(`[${opId}] Verifying ID token`);
		const decodedToken = await auth.verifyIdToken(idToken);
		console.log(`[${opId}] ID token verified, UID: ${decodedToken.uid}`);

		const userDoc = await db
			.collection("users")
			.doc(decodedToken.uid)
			.get();
		const userData = userDoc.data() || {};
		console.log(`[${opId}] User data fetched:`, userData);

		// Get user preferences with proper defaults
		const showPali = userData["preferences.showPali"] || false;
		const theme = userData["preferences.theme"] || "dark";
		const enablePaliLookup =
			userData["preferences.enablePaliLookup"] ?? true;
		let noteId = userData["defaultNoteId"];
		const layout = userData["preferences.paliLayout"] || "interleaved";
		const fontSize = userData["preferences.fontSize"] || "large";

		// Initialize default preferences if they don't exist (for new users)
		const needsPreferenceInit =
			userData["preferences.enablePaliLookup"] === undefined ||
			userData["preferences.theme"] === undefined ||
			userData["preferences.fontSize"] === undefined ||
			userData["preferences.paliLayout"] === undefined;

		if (needsPreferenceInit) {
			console.log(
				`[${opId}] Initializing default preferences for new user`
			);
			await db.collection("users").doc(decodedToken.uid).set(
				{
					"preferences.theme": theme,
					"preferences.showPali": showPali,
					"preferences.enablePaliLookup": enablePaliLookup,
					"preferences.paliLayout": layout,
					"preferences.fontSize": fontSize,
				},
				{ merge: true }
			);
			console.log(`[${opId}] Default preferences initialized`);
		}

		console.log(
			`[${opId}] User preferences: showPali=${showPali}, theme=${theme}, enablePaliLookup=${enablePaliLookup}, noteId=${noteId}, layout=${layout}, fontSize=${fontSize}`
		);

		// Create default note if it doesn't exist
		if (!noteId) {
			console.log(`[${opId}] No default note found, creating one`);
			const noteRef = await db.collection("notes").add({
				author: decodedToken.uid,
				name: "My Highlights",
				createdAt: Timestamp.now(),
			} as Note);
			console.log(
				`[${opId}] Default note created with ID: ${noteRef.id}`
			);

			await db.collection("users").doc(decodedToken.uid).set(
				{
					defaultNoteId: noteRef.id,
				},
				{ merge: true }
			);
			console.log(`[${opId}] User's defaultNoteId updated`);
			noteId = noteRef.id;
		}

		// Create session cookie
		const twoWeeks = 60 * 60 * 24 * 14 * 1000;
		console.log(`[${opId}] Creating session cookie`);
		let sessionCookie;
		try {
			sessionCookie = await auth.createSessionCookie(idToken, {
				expiresIn: twoWeeks,
			});
			console.log(`[${opId}] Session cookie created`);
		} catch (createCookieError: any) {
			console.error(
				`[${opId}] Error creating session cookie:`,
				createCookieError
			);
			// Try to get more specific error information
			let errorMessage = "Failed to create session cookie";
			if (createCookieError.code) {
				errorMessage += ` (${createCookieError.code})`;
			}
			return new Response(errorMessage, {
				status: 401, // Changed from 500 to 401 since this is an auth issue
			});
		}

		// Clear any existing cookie first to avoid stacking issues
		cookies.delete("__session");

		// Set new cookie with explicit options
		cookies.set("__session", sessionCookie, {
			path: "/",
			httpOnly: true,
			secure: process.env.NODE_ENV === "production", // Secure in production
			sameSite: "lax",
		});
		console.log(`[${opId}] Session cookie set`);

		// Build redirect URL
		const url = new URL(request.url);
		const returnTo = url.searchParams.get("returnTo");
		const baseRedirectPath = returnTo
			? new URL(returnTo, request.url).pathname
			: "/review-room";
		const redirectUrl = new URL(baseRedirectPath, request.url);

		redirectUrl.searchParams.append("load-preferences", "true");
		if (showPali) {
			redirectUrl.searchParams.set("pli", "true");
		}
		if (theme) {
			redirectUrl.searchParams.set("theme", theme);
		}
		if (layout) {
			redirectUrl.searchParams.set("layout", layout);
		}
		redirectUrl.searchParams.set(
			"enablePaliLookup",
			enablePaliLookup.toString()
		);
		console.log(`[${opId}] Redirecting to: ${redirectUrl.toString()}`);

		return redirect(redirectUrl.toString());
	} catch (error) {
		console.error(`[${opId}] Authentication failed:`, error);
		// Clean up any partial session
		cookies.delete("__session", { path: "/" });

		if (error instanceof Error) {
			const isExpiredToken = error.message.includes("expired");
			const statusCode = isExpiredToken ? 401 : 500;
			const errorMessage = isExpiredToken
				? "Authentication token has expired. Please try signing in again."
				: error.message;

			return new Response(errorMessage, { status: statusCode });
		}
		return new Response("Authentication failed", { status: 401 });
	}
};

// POST handler - redirect to sign-in page since this endpoint requires the token in headers
// This handles cases where the form is submitted before JavaScript loads
export const POST: APIRoute = async ({ request, redirect }) => {
	const url = new URL(request.url);
	const returnTo = url.searchParams.get("returnTo") || "/review-room";

	// Redirect back to signin page - the JS will handle the actual authentication
	return redirect(
		`/signin?returnTo=${encodeURIComponent(returnTo)}&retry=true`
	);
};
