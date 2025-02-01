export const prerender = false;
import type { APIRoute } from "astro";
import { app, db } from "../../../firebase/server";
import { getAuth } from "firebase-admin/auth";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { UserPreferences } from "../../../utils/theme";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
    const startTime = Date.now();
    console.log(`[Auth] Starting signin at ${new Date().toISOString()}`);
    console.log('[Auth] Request headers:', Object.fromEntries(request.headers));

    const auth = getAuth(app);
    const TIMEOUT_MS = 7000; // Increased to 7 seconds

    try {
        // Early validation
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        console.log(`[Auth] Token extraction took ${Date.now() - startTime}ms`);
        if (!idToken) {
            console.log("[Auth] No token found");
            return new Response("No token found", { status: 401 });
        }

        const url = new URL(request.url);
        const returnTo = url.searchParams.get("returnTo") || "/dashboard";

        console.log('[Auth] Starting auth operations at', Date.now() - startTime);
        // Run token verification and session creation in parallel
        // with a shorter timeout
        const authResult = await Promise.race([
            Promise.all([
                auth.verifyIdToken(idToken),
                auth.createSessionCookie(idToken, {
                    expiresIn: 60 * 60 * 24 * 14 * 1000
                })
            ]).then(result => {
                console.log(`[Auth] Token verification completed in ${Date.now() - startTime}ms`);
                return result as [DecodedIdToken, string];
            }),
            new Promise<[DecodedIdToken, string]>((_, reject) =>
                setTimeout(() => {
                    console.log(`[Auth] Auth timeout triggered at ${Date.now() - startTime}ms`);
                    reject(new Error('Auth timeout'));
                }, TIMEOUT_MS)
            )
        ]);

        const [decodedToken, sessionCookie] = authResult;
        console.log(`[Auth] Token verified in ${Date.now() - startTime}ms`);

        // Set cookie immediately after verification
        cookies.set("__session", sessionCookie, { path: "/" });

        // Quick DB query with minimal fields
        const userPrefs = await Promise.race([
            db.collection('users')
                .doc(decodedToken.uid)
                .get()
                .then(snap => ({
                    showPali: snap.get('preferences.showPali'),
                    theme: snap.get('preferences.theme')
                })),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('DB timeout')), 3000)
            )
        ]) as UserPreferences;

        console.log(`[Auth] DB query completed in ${Date.now() - startTime}ms`);

        // Build redirect URL
        const redirectUrl = new URL(returnTo, request.url);
        if (userPrefs?.showPali === true) redirectUrl.searchParams.set('pli', 'true');
        if (userPrefs.theme) redirectUrl.searchParams.set('theme', userPrefs.theme);

        console.log(`[Auth] Redirecting after ${Date.now() - startTime}ms`);
        return redirect(redirectUrl.toString());

    } catch (error) {
        const timeTaken = Date.now() - startTime;
        console.error('[Auth] Failed:', {
            error,
            timeTaken,
            url: request.url,
            headers: Object.fromEntries(request.headers)
        });

        // More specific error handling
        if (error instanceof Error) {
            const status = error.message.includes('timeout') ? 504 : 401;
            const message = error.message.includes('timeout')
                ? `Operation timed out after ${timeTaken}ms`
                : error.message;
            return new Response(message, { status });
        }

        return new Response("Authentication failed", { status: 401 });
    }
};