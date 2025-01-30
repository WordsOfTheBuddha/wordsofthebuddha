export const prerender = false;
import type { APIRoute } from "astro";
import { app } from "../../../firebase/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
    const auth = getAuth(app);
    const db = getFirestore(app);

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
        const decodedToken = await auth.verifyIdToken(idToken);

        // Get user preferences
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data() || {};
        const showPali = userData['preferences.showPali'];
        const theme = userData['preferences.theme'];

        // Create session cookie
        const twoWeeks = 60 * 60 * 24 * 14 * 1000;
        const sessionCookie = await auth.createSessionCookie(idToken, {
            expiresIn: twoWeeks,
        });

        cookies.set("__session", sessionCookie, {
            path: "/",
        });

        // Modify return URL if Pali mode is enabled
        const baseRedirectPath = returnTo ? new URL(returnTo, request.url).pathname : "/dashboard";
        const redirectUrl = new URL(baseRedirectPath, request.url);
        redirectUrl.searchParams.append('load-preferences', 'true');
        if (showPali) {
            redirectUrl.searchParams.set('pli', 'true');
        } else {
            redirectUrl.searchParams.delete('pli');
        }
        redirectUrl.searchParams.set('theme', theme);

        return redirect(redirectUrl.toString());
    } catch (error) {
        return new Response("Invalid token", { status: 401 });
    }
};

// Remove or update POST endpoint as needed...