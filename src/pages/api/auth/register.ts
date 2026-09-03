export const prerender = false;
import type { APIRoute } from "astro";
import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import {
	app,
	db,
	isFirebaseInitialized,
} from "../../../service/firebase/server";
import { safeAuthReturnUrl } from "../../../utils/authReturnTo";
import { parseSignupIntentFields } from "../../../utils/signupIntent";

export const POST: APIRoute = async ({ request, redirect }) => {
	if (!isFirebaseInitialized || !app) {
		return new Response(
			"Registration service is not available. Please check server configuration.",
			{
				status: 503,
				headers: {
					"Content-Type": "text/plain",
				},
			},
		);
	}

	const rawBody = await request.text();
	const params = new URLSearchParams(rawBody);
	const formData = new FormData();
	for (const [key, value] of params) {
		formData.append(key, value);
	}

	const auth = getAuth(app);
	const email = formData.get("email")?.toString();
	const password = formData.get("password")?.toString();
	const name = formData.get("name")?.toString();
	const returnTo = formData.get("returnTo")?.toString();
	const { intent, note } = parseSignupIntentFields({
		intent: formData.get("intent")?.toString(),
		note: formData.get("intentNote")?.toString(),
	});

	if (!email || !password || !name) {
		return new Response("Missing form data", { status: 400 });
	}

	try {
		const user = await auth.createUser({
			email,
			password,
			displayName: name,
		});

		if (db && (intent || note)) {
			await db
				.collection("users")
				.doc(user.uid)
				.set(
					{
						...(intent ? { signupIntent: intent } : {}),
						...(note ? { signupIntentNote: note } : {}),
						signupIntentAt: FieldValue.serverTimestamp(),
					},
					{ merge: true },
				);
		}
	} catch (error: unknown) {
		const message =
			error && typeof error === "object" && "message" in error
				? String((error as { message?: unknown }).message)
				: "Something went wrong";
		console.error("Error creating user:", error);
		return new Response(message || "Something went wrong", {
			status: 400,
		});
	}

	// Account exists but session isn’t created here — send them to sign in.
	// After sign-in we email a verification link (required for full Ask quota).
	const returnUrl = safeAuthReturnUrl(returnTo, request.url);
	const returnPath = `${returnUrl.pathname}${returnUrl.search}`;
	return redirect(
		`/signin?returnTo=${encodeURIComponent(returnPath)}&verify=1`,
	);
};
