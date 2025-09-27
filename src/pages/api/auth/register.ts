export const prerender = false;
import type { APIRoute } from "astro";
import { getAuth } from "firebase-admin/auth";
import { app, isFirebaseInitialized } from "../../../service/firebase/server";

export const POST: APIRoute = async ({ request, redirect }) => {
	// Debug request information
	console.log("Request Method:", request.method);
	console.log(
		"Request Headers:",
		Object.fromEntries(request.headers.entries())
	);

	// Check if Firebase is properly configured
	if (!isFirebaseInitialized || !app) {
		console.log("Firebase not configured for registration");
		return new Response(
			"Registration service is not available. Please check server configuration.",
			{
				status: 503,
				headers: {
					"Content-Type": "text/plain",
				},
			}
		);
	}

	// Debug raw body
	const rawBody = await request.text();
	console.log("Raw Body:", rawBody);

	// Parse the body back into a request for further processing
	const newRequest = new Request(request.url, {
		method: request.method,
		headers: request.headers,
		body: rawBody,
	});

	const auth = getAuth(app);
	let formData;

	try {
		// Try parsing as URLSearchParams first since we logged the raw body
		const params = new URLSearchParams(rawBody);
		formData = new FormData();
		for (const [key, value] of params) {
			formData.append(key, value);
			console.log("Form field:", key, "=", value);
		}
	} catch (error) {
		console.error("Error parsing form data:", error);
		return new Response("Error parsing request data", { status: 400 });
	}

	const email = formData.get("email")?.toString();
	const password = formData.get("password")?.toString();
	const name = formData.get("name")?.toString();
	const returnTo = formData.get("returnTo")?.toString();

	if (!email || !password || !name) {
		return new Response("Missing form data", { status: 400 });
	}

	try {
		await auth.createUser({
			email,
			password,
			displayName: name,
		});
	} catch (error: any) {
		console.error("Error creating user:", error);
		return new Response(error.message || "Something went wrong", {
			status: 400,
		});
	}

	// Ensure redirect path is safe and ASCII-encoded for the Location header
	const safePath = returnTo
		? new URL(returnTo, request.url).pathname
		: "/signin";
	return redirect(safePath);
};
