import { getAuth, type UserRecord } from "firebase-admin/auth";
import type { AstroCookies } from "astro";
import { app, isFirebaseInitialized } from "../service/firebase/server";

const userCache = new Map<string, { user: any; timestamp: number }>();
const CACHE_TTL = 120 * 60 * 1000; // 120 minutes TTL
const AUTH_GET_USER_TIMEOUT = 10000; // 10 seconds

interface VerifyUserOptions {
	forceRefresh?: boolean;
	cookies?: AstroCookies;
}

/* Centralized session verification */
export async function verifyUser(
	sessionCookie: string | undefined,
	options: VerifyUserOptions = {},
): Promise<UserRecord | null> {
	const { forceRefresh = false, cookies } = options;

	if (!sessionCookie) {
		return null;
	}

	try {
		// Check if Firebase is properly initialized
		if (!isFirebaseInitialized || !app) {
			console.warn("Firebase is not initialized - cannot verify user");
			return null;
		}

		const auth = getAuth(app);
		const decodedCookie = await auth.verifySessionCookie(
			sessionCookie,
			true,
		);
		const uid = decodedCookie.uid;

		// Check if we have a valid cached user and not forcing refresh
		const cachedData = userCache.get(uid);
		const now = Date.now();

		if (
			!forceRefresh &&
			cachedData &&
			now - cachedData.timestamp < CACHE_TTL
		) {
			return cachedData.user;
		}

		// If no valid cache or forced refresh, get fresh data
		const freshUserData = await auth.getUser(uid);

		// Update cache with new data
		userCache.set(uid, {
			user: freshUserData,
			timestamp: now,
		});

		return freshUserData;
	} catch (error: any) {
		// Clear the stale cookie if session expired
		if (
			error?.errorInfo?.code === "auth/session-cookie-expired" &&
			cookies
		) {
			console.warn("Session cookie expired, clearing stale cookie");
			cookies.delete("__session", { path: "/" });
		} else {
			console.error("Error verifying user:", error);
		}
		return null;
	}
}

// Function to clear cache for specific user (can be called after profile update)
export function clearUserCache(uid: string): void {
	userCache.delete(uid);
}
