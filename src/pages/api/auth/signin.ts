export const prerender = false;
import type { APIRoute } from "astro";
import { app } from "../../../service/firebase/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import type { Note } from "../../../types/notes";

const SESSION_COOKIE_TIMEOUT = 40000; // Increase timeout to 40 seconds

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
	const opId = `signin-${Date.now()}`;
	console.log(`[${opId}] Sign-in request started`);

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

		// Get user preferences
		const showPali = userData["preferences.showPali"];
		const theme = userData["preferences.theme"];
		const enablePaliLookup =
			userData["preferences.enablePaliLookup"] || false;
		let noteId = userData["defaultNoteId"];
		console.log(
			`[${opId}] User preferences: showPali=${showPali}, theme=${theme}, enablePaliLookup=${enablePaliLookup}, noteId=${noteId}`
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

			await db.collection("users").doc(decodedToken.uid).update({
				defaultNoteId: noteRef.id,
			});
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
			return new Response("Failed to create session cookie", {
				status: 500,
			});
		}

		cookies.set("__session", sessionCookie, {
			path: "/",
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
		redirectUrl.searchParams.set(
			"enablePaliLookup",
			enablePaliLookup.toString()
		);
		console.log(`[${opId}] Redirecting to: ${redirectUrl.toString()}`);

		return redirect(redirectUrl.toString());
	} catch (error) {
		console.error(`[${opId}] Authentication failed:`, error);
		if (error instanceof Error) {
			return new Response(error.message, { status: 401 });
		}
		return new Response("Authentication failed", { status: 401 });
	}
};
