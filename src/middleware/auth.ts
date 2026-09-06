import { getAuth, type UserRecord } from "firebase-admin/auth";
import type { AstroCookies } from "astro";
import { app, isFirebaseInitialized } from "../service/firebase/server";
import { shouldCheckSessionRevoked } from "../utils/authVerifyPolicy";

const userCache = new Map<string, { user: UserRecord; timestamp: number }>();
const CACHE_TTL = 120 * 60 * 1000; // 120 minutes TTL

/** Last revocation-list check for this exact session cookie (this isolate). */
const sessionRevokeAt = new Map<string, { uid: string; checkedAt: number }>();
const inflightVerify = new Map<string, Promise<UserRecord | null>>();

interface VerifyUserOptions {
	forceRefresh?: boolean;
	cookies?: AstroCookies;
}

async function verifyUserOnce(
	sessionCookie: string,
	options: VerifyUserOptions,
): Promise<UserRecord | null> {
	const { forceRefresh = false, cookies } = options;

	try {
		if (!isFirebaseInitialized || !app) {
			console.warn("Firebase is not initialized - cannot verify user");
			return null;
		}

		const auth = getAuth(app);
		const now = Date.now();
		const sessionMeta = sessionRevokeAt.get(sessionCookie);
		const checkRevoked = shouldCheckSessionRevoked(
			sessionMeta?.checkedAt,
			now,
			forceRefresh,
		);

		const decodedCookie = await auth.verifySessionCookie(
			sessionCookie,
			checkRevoked,
		);
		const uid = decodedCookie.uid;

		if (checkRevoked || !sessionMeta) {
			sessionRevokeAt.set(sessionCookie, {
				uid,
				checkedAt: now,
			});
		}

		const cachedData = userCache.get(uid);
		if (
			!forceRefresh &&
			cachedData &&
			now - cachedData.timestamp < CACHE_TTL
		) {
			return cachedData.user;
		}

		const freshUserData = await auth.getUser(uid);
		userCache.set(uid, {
			user: freshUserData,
			timestamp: now,
		});

		return freshUserData;
	} catch (error: any) {
		sessionRevokeAt.delete(sessionCookie);
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

/* Centralized session verification */
export async function verifyUser(
	sessionCookie: string | undefined,
	options: VerifyUserOptions = {},
): Promise<UserRecord | null> {
	if (!sessionCookie) {
		return null;
	}

	const inflightKey = `${options.forceRefresh ? "1" : "0"}:${sessionCookie}`;
	const existing = inflightVerify.get(inflightKey);
	if (existing) return existing;

	const pending = verifyUserOnce(sessionCookie, options).finally(() => {
		inflightVerify.delete(inflightKey);
	});
	inflightVerify.set(inflightKey, pending);
	return pending;
}

// Function to clear cache for specific user (can be called after profile update)
export function clearUserCache(uid: string): void {
	userCache.delete(uid);
	for (const [cookie, meta] of sessionRevokeAt) {
		if (meta.uid === uid) sessionRevokeAt.delete(cookie);
	}
}

/**
 * Ask quota depends on emailVerified. Refresh when the cached record is still
 * unverified so a just-clicked email link unlocks the signed-in bucket.
 */
export async function verifyUserForAskQuota(
	sessionCookie: string | undefined,
	options: VerifyUserOptions = {},
): Promise<UserRecord | null> {
	const user = await verifyUser(sessionCookie, options);
	if (!user || user.emailVerified) return user;
	return verifyUser(sessionCookie, { ...options, forceRefresh: true });
}
