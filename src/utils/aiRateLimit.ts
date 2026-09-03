const buckets = new Map<string, { day: string; count: number }>();

function utcDay(now = Date.now()): string {
	return new Date(now).toISOString().slice(0, 10);
}

export function clientIpFromRequest(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		const first = forwarded.split(",")[0]?.trim();
		if (first) return first;
	}
	return request.headers.get("x-real-ip")?.trim() || "local";
}

export function aiAskDailyLimit(): number {
	return import.meta.env?.DEV ? 200 : 40;
}

/** Returns remaining quota after consuming one request, or 0 if exhausted. */
export function consumeAiAskQuota(
	ip: string,
	limit = aiAskDailyLimit(),
	now = Date.now(),
): { allowed: boolean; remaining: number; limit: number } {
	const day = utcDay(now);
	const current = buckets.get(ip);
	if (!current || current.day !== day) {
		buckets.set(ip, { day, count: 1 });
		return { allowed: true, remaining: Math.max(0, limit - 1), limit };
	}
	if (current.count >= limit) {
		return { allowed: false, remaining: 0, limit };
	}
	current.count += 1;
	return { allowed: true, remaining: Math.max(0, limit - current.count), limit };
}

export function resetAiAskQuotaForTests(): void {
	buckets.clear();
}
