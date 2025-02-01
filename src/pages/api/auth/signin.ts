export const prerender = false;
import type { APIRoute } from "astro";
import { app, db } from "../../../firebase/server";
import { getAuth } from "firebase-admin/auth";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { UserPreferences } from "../../../utils/theme";

// Add debug flag to force logging
const DEBUG = true;

const logger = {
    debug: (...args: any[]) => DEBUG && console.debug('[Vercel]', ...args),
    info: (...args: any[]) => console.log('[Vercel]', ...args),
    error: (...args: any[]) => console.error('[Vercel]', ...args)
};

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    logger.info(`[${requestId}] Starting signin at ${new Date().toISOString()}`);
    logger.debug(`[${requestId}] Request headers:`, Object.fromEntries(request.headers));

    const auth = getAuth(app);
    const TIMEOUT_MS = 7000; // Increased to 7 seconds

    try {
        // Early validation
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        logger.debug(`[${requestId}] Token present: ${!!idToken}, took ${Date.now() - startTime}ms`);
        if (!idToken) {
            logger.info(`[${requestId}] No token found`);
            return new Response("No token found", { status: 401 });
        }

        const url = new URL(request.url);
        const returnTo = url.searchParams.get("returnTo") || "/dashboard";

        logger.info(`[${requestId}] Starting auth at ${Date.now() - startTime}ms`);
        // Run token verification and session creation in parallel
        // with a shorter timeout
        const authResult = await Promise.race([
            Promise.all([
                auth.verifyIdToken(idToken),
                auth.createSessionCookie(idToken, {
                    expiresIn: 60 * 60 * 24 * 14 * 1000
                })
            ]).then(result => {
                logger.debug(`[${requestId}] Auth completed in ${Date.now() - startTime}ms`);
                return result as [DecodedIdToken, string];
            }),
            new Promise<[DecodedIdToken, string]>((_, reject) =>
                setTimeout(() => {
                    logger.debug(`[${requestId}] Auth timeout triggered at ${Date.now() - startTime}ms`);
                    reject(new Error('Auth timeout'));
                }, TIMEOUT_MS)
            )
        ]);

        const [decodedToken, sessionCookie] = authResult;
        logger.info(`[${requestId}] Token verified in ${Date.now() - startTime}ms`);

        // Set cookie immediately after verification
        cookies.set("__session", sessionCookie, { path: "/" });
        logger.debug(`[${requestId}] Cookie set`);

        // Quick DB query with minimal fields
        logger.info(`[${requestId}] Starting DB query at ${Date.now() - startTime}ms`);
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

        logger.debug(`[${requestId}] DB returned:`, userPrefs);
        logger.info(`[${requestId}] DB query done in ${Date.now() - startTime}ms`);

        // Build redirect URL
        const redirectUrl = new URL(returnTo, request.url);
        if (userPrefs?.showPali === true) redirectUrl.searchParams.set('pli', 'true');
        if (userPrefs.theme) redirectUrl.searchParams.set('theme', userPrefs.theme);

        logger.info(`[${requestId}] Redirecting after ${Date.now() - startTime}ms to ${redirectUrl}`);
        return redirect(redirectUrl.toString());

    } catch (error) {
        const timeTaken = Date.now() - startTime;
        logger.error(`[${requestId}] Failed:`, {
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