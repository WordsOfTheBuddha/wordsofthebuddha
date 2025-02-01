export const prerender = false;
import type { APIRoute } from "astro";
import { app, db } from "../../../firebase/server";
import { getAuth } from "firebase-admin/auth";
import { DocumentSnapshot } from "firebase-admin/firestore";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
    const startTime = Date.now();
    console.log(`[Auth] Starting signin process at ${new Date().toISOString()}`);

    const auth = getAuth(app);
    const timeoutMs = 9000; // 9 seconds to stay under Vercel's 10s limit

    try {
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        console.log(`[Auth] Token present: ${Boolean(idToken)}`);
        if (!idToken) return new Response("No token found", { status: 401 });

        const url = new URL(request.url);
        console.log(`[Auth] Request URL: ${url.toString()}`);
        console.log(`[Auth] Search params:`, Object.fromEntries(url.searchParams));
        const returnTo = url.searchParams.get("returnTo");

        // Create a promise race between our auth operations and a timeout
        return await Promise.race<Response>([
            (async () => {
                console.log('[Auth] Starting concurrent auth operations');
                const tokenVerifyStart = Date.now();

                try {
                    // Verify token and get user data concurrently
                    const [decodedToken, sessionCookie] = await Promise.all([
                        auth.verifyIdToken(idToken),
                        auth.createSessionCookie(idToken, {
                            expiresIn: 60 * 60 * 24 * 14 * 1000 // 14 days
                        })
                    ]);
                    console.log(`[Auth] Token verification completed in ${Date.now() - tokenVerifyStart}ms`);
                    console.log(`[Auth] User ID: ${decodedToken.uid}`);

                    const dbStart = Date.now();
                    const userSnap = await Promise.race([
                        db.collection('users').doc(decodedToken.uid).get(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('DB timeout')), 5000)
                        )
                    ]) as DocumentSnapshot;
                    console.log(`[Auth] DB fetch completed in ${Date.now() - dbStart}ms`);

                    const userData = userSnap.data();
                    console.log('[Auth] User data retrieved:', {
                        hasData: Boolean(userData),
                        preferences: {
                            showPali: userData?.['preferences.showPali'],
                            theme: userData?.['preferences.theme']
                        }
                    });

                    cookies.set("__session", sessionCookie, { path: "/" });

                    // Build redirect URL with minimal params
                    const baseRedirectPath = returnTo || "/dashboard";
                    const redirectUrl = new URL(baseRedirectPath, request.url);

                    // Only add essential preferences
                    if (userData?.['preferences.showPali']) {
                        redirectUrl.searchParams.set('pli', 'true');
                    }
                    if (userData?.['preferences.theme']) {
                        redirectUrl.searchParams.set('theme', userData['preferences.theme']);
                    }

                    console.log(`[Auth] Total signin process took ${Date.now() - startTime}ms`);
                    console.log(`[Auth] Redirecting to: ${redirectUrl.toString()}`);

                    return redirect(redirectUrl.toString());
                } catch (innerError) {
                    console.error('[Auth] Inner operation failed:', {
                        error: innerError,
                        stack: innerError instanceof Error ? innerError.stack : undefined,
                        timeTaken: Date.now() - startTime
                    });
                    throw innerError;
                }
            })(),
            new Promise((_, reject) =>
                setTimeout(() => {
                    console.log(`[Auth] Operation timed out after ${timeoutMs}ms`);
                    reject(new Error('Operation timeout'));
                }, timeoutMs)
            )
        ]);

    } catch (error) {
        console.error('[Auth] Signin failed:', {
            error,
            stack: error instanceof Error ? error.stack : undefined,
            timeTaken: Date.now() - startTime,
            url: request.url
        });

        return new Response(
            error instanceof Error ? error.message : "Authentication failed",
            { status: error instanceof Error && error.message.includes('timeout') ? 504 : 401 }
        );
    }
};