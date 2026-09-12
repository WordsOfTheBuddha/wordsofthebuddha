export type SupportFrequency = "once" | "monthly";

export type SupportArea = {
	item: string;
	note: string;
};

export type SupportOtherWay = {
	item: string;
	note: string;
	href?: string;
};

/** Causal sentence above the category list. No amounts. */
export const supportAreasLede =
	"Gifts go toward time for translating and recording, and toward keeping the site and tools freely available.";

/** Sentence above the other-ways list, so the two columns can run in parallel. */
export const supportOtherWaysLede =
	"Help others find the translations and other ways to support the work.";

/** What support goes toward. No amounts — categories only. Edit as the work changes. */
export const supportAreas: SupportArea[] = [
	{
		item: "Translations",
		note: "Translating new discourses, revising existing ones, and adding notes",
	},
	{
		item: "Audio",
		note: "Preparing narration and audio hosting for listen mode",
	},
	{
		item: "Study tools",
		note: "Pāli lookup, Ask, research reports, learning stats, and more",
	},
	{
		item: "Hosting and development",
		note: "Keeping the site running, fast, and available offline",
	},
];

/** Non-financial ways to help. Named actions; no fundraising tone. */
export const supportOtherWays: SupportOtherWay[] = [
	{
		item: "Share a discourse",
		note: "If a teaching was useful, passing it on is enough",
	},
	{
		item: "Point someone here",
		note: "The translations are public domain; a link helps others find them",
	},
	{
		item: "Write to us",
		note: "Have a bright idea or feedback? Write to us.",
		href: "mailto:hello@wordsofthebuddha.org",
	},
];

const DEFAULT_POLAR_CHECKOUT_LINK =
	"https://buy.polar.sh/polar_cl_6bQGBy5AKcGhw1gk9ug1j409wbNPwwbkdNmie3TtXYX";

/** Production Polar products on the shared checkout link (once + monthly). */
const DEFAULT_POLAR_PRODUCT_ID_ONCE = "c82e055e-01f8-4f5b-b6ac-3d0bfa8bac76";
const DEFAULT_POLAR_PRODUCT_ID_MONTHLY = "286e2704-dbe8-4b3b-a3e9-52a21178ad56";

const polarProductIdByFrequency: Record<SupportFrequency, string> = {
	once:
		import.meta.env.PUBLIC_POLAR_PRODUCT_ID_ONCE ||
		DEFAULT_POLAR_PRODUCT_ID_ONCE,
	monthly:
		import.meta.env.PUBLIC_POLAR_PRODUCT_ID_MONTHLY ||
		DEFAULT_POLAR_PRODUCT_ID_MONTHLY,
};

export const monthlyCheckoutEnabled = true;

function polarCheckoutLink(): string {
	return (
		import.meta.env.PUBLIC_POLAR_CHECKOUT_LINK?.trim() ||
		DEFAULT_POLAR_CHECKOUT_LINK
	);
}

/** Direct Polar checkout-link URL; `product_id` preselects once vs monthly. */
export function polarCheckoutHref(options: {
	frequency: SupportFrequency;
}): string | null {
	if (options.frequency === "monthly" && !monthlyCheckoutEnabled) {
		return null;
	}
	const link = polarCheckoutLink();
	if (!link) return null;
	const dest = new URL(link);
	const productId = polarProductIdByFrequency[options.frequency];
	if (productId) {
		dest.searchParams.set("product_id", productId);
	}
	return dest.toString();
}
