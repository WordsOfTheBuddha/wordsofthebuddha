export const prerender = false;
import type { APIRoute } from "astro";
import { app } from "../../../firebase/server";
import { getAuth } from "firebase-admin/auth";
import { loadPreferences } from "src/utils/theme";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
    const auth = getAuth(app);

    /* Get token from request headers */
    const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
    if (!idToken) {
        return new Response("No token found", { status: 401 });
    }

    /* Get return URL from query params */
    const url = new URL(request.url);
    console.log("Full URL:", url.toString()); // Debug log
    console.log("Search params:", Object.fromEntries(url.searchParams.entries())); // Debug log

    const returnTo = url.searchParams.get("returnTo");
    console.log("Return to value:", returnTo); // Debug log

    /* Verify id token */
    try {
        await auth.verifyIdToken(idToken);
    } catch (error) {
        return new Response("Invalid token", { status: 401 });
    }

    /* Create and set session cookie */
    const twoWeeks = 60 * 60 * 24 * 14 * 1000;
    const sessionCookie = await auth.createSessionCookie(idToken, {
        expiresIn: twoWeeks,
    });

    cookies.set("__session", sessionCookie, {
        path: "/",
    });

    // Only allow redirects to local paths
    const baseRedirectPath = returnTo ? new URL(returnTo, request.url).pathname : "/dashboard";
    const existingUrl = new URL(baseRedirectPath, request.url);
    existingUrl.searchParams.append('load-preferences', 'true');
    const redirectPath = existingUrl.toString();
    console.log("Redirecting to:", redirectPath); // Debug log
    return redirect(redirectPath);
};

// Remove or update POST endpoint as needed...