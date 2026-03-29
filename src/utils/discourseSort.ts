/**
 * Sort discourse slugs for UI: collection weight (MN before SN, etc.), then numeric order
 * (MN2 before MN10; MN113 after MN12).
 */

const COLLECTION_WEIGHT: Record<string, number> = {
	mn: 0,
	dn: 10,
	sn: 20,
	an: 30,
	anp: 35,
	dhp: 40,
	iti: 50,
	kp: 60,
	snp: 70,
	ud: 80,
};

function numericPartsAfterPrefix(rest: string): number[] {
	return rest.split(/\D+/).filter(Boolean).map((n) => parseInt(n, 10));
}

/** Compare two discourse ids (e.g. mn2 vs mn10, mn1 vs sn12.3). */
export function compareDiscourseIds(a: string, b: string): number {
	const pa = /^([a-z]+)(\d.*)$/i.exec(a);
	const pb = /^([a-z]+)(\d.*)$/i.exec(b);
	if (pa && pb) {
		const ca = pa[1].toLowerCase();
		const cb = pb[1].toLowerCase();
		const wa = COLLECTION_WEIGHT[ca] ?? 100;
		const wb = COLLECTION_WEIGHT[cb] ?? 100;
		if (wa !== wb) return wa - wb;
		const na = numericPartsAfterPrefix(pa[2] ?? "");
		const nb = numericPartsAfterPrefix(pb[2] ?? "");
		const len = Math.max(na.length, nb.length);
		for (let i = 0; i < len; i++) {
			const va = na[i] ?? 0;
			const vb = nb[i] ?? 0;
			if (va !== vb) return va - vb;
		}
		return 0;
	}
	if (pa && !pb) return -1;
	if (!pa && pb) return 1;
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function sortDiscourseIds(ids: string[]): string[] {
	return [...ids].sort(compareDiscourseIds);
}

/** Display label for a discourse slug (e.g. mn53 → "MN 53", sn12.3 → "SN 12.3"). */
export function formatDiscourseTitle(slug: string): string {
	const m = /^([a-z]+)([\d.].*)$/i.exec(slug);
	if (m) return `${m[1].toUpperCase()} ${m[2]}`;
	return slug;
}
