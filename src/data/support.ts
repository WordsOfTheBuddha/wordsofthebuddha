export type SupportFrequency = "once" | "monthly";

export type SupportCostRow = {
	item: string;
	monthlyUsd: number;
	note: string;
	/** Unknown or not yet settled — shown as * without a dollar figure. */
	tentative?: boolean;
};

/** Typical monthly costs, 2026. Edit when they change. */
export const supportCostsYear = 2026;

export const supportCosts: SupportCostRow[] = [
	{
		item: "Hosting",
		monthlyUsd: 25,
		note: "Website hosting and domain, wordsofthebuddha.org",
	},
	{
		item: "Translation tools and site development",
		monthlyUsd: 60,
		note: "Includes editor and coding tools used to prepare discourses and develop the site",
	},
	{
		item: "AI assistance",
		monthlyUsd: 0,
		tentative: true,
		note: "Tentative / not yet known — used for audio and live intelligence.",
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
