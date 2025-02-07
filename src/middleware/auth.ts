import { getAuth } from "firebase-admin/auth";
import { app } from "../firebase/server";

const userCache = new Map<string, { user: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes TTL
const AUTH_GET_USER_TIMEOUT = 5000; // 5 seconds

/* Centralized session verification */
export async function verifyUser(sessionCookie: string | undefined) {
    const opId = `verifyUser-${Date.now()}`;
    console.log(`[${opId}] Verifying user with session cookie`);

    if (!sessionCookie) {
        console.log(`[${opId}] No session cookie provided`);
        throw new Error("No session");
    }

    const now = Date.now();
    const cached = userCache.get(sessionCookie);
    if (cached && now - cached.timestamp < CACHE_TTL) {
        console.log(`[${opId}] Returning cached user`);
        return cached.user;
    }

    try {
        const auth = getAuth(app);
        console.log(`[${opId}] Verifying session cookie with Firebase Auth`);
        const decodedCookie = await auth.verifySessionCookie(sessionCookie);
        console.log(`[${opId}] Session cookie verified, fetching user`);

        // Add a timeout to the getUser call
        const getUserPromise = auth.getUser(decodedCookie.uid);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout of ${AUTH_GET_USER_TIMEOUT}ms exceeded`)), AUTH_GET_USER_TIMEOUT)
        );

        const user = await Promise.race([getUserPromise, timeoutPromise]);

        console.log(`[${opId}] User fetched successfully`);

        if (!user) {
            console.log(`[${opId}] User not found in Firebase Auth`);
            throw new Error("User not found");
        }

        userCache.set(sessionCookie, { user, timestamp: now });
        console.log(`[${opId}] User cached and returning`);
        return user;
    } catch (error: any) {
        console.error(`[${opId}] Error verifying user: ${error.message}`);
        throw error;
    }
}
