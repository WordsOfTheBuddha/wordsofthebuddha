/** How often a warm isolate may call Firebase Auth's revocation list. */
export const SESSION_REVOKE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Session cookies are JWTs: signature and expiry can be checked locally.
 * `checkRevoked` is a network hop to Identity Toolkit — use it on force-refresh
 * and then at most once per interval per cookie on an isolate.
 */
export function shouldCheckSessionRevoked(
	lastRevokeCheckAt: number | undefined,
	now: number,
	forceRefresh: boolean,
	intervalMs: number = SESSION_REVOKE_CHECK_INTERVAL_MS,
): boolean {
	if (forceRefresh) return true;
	if (lastRevokeCheckAt == null) return false;
	return now - lastRevokeCheckAt >= intervalMs;
}
