interface ImportMetaEnv {
	readonly POLAR_ACCESS_TOKEN?: string;
	readonly POLAR_SUCCESS_URL?: string;
	readonly POLAR_SERVER?: string;
	readonly PUBLIC_POLAR_CHECKOUT_LINK?: string;
	readonly PUBLIC_POLAR_PRODUCT_ID_ONCE?: string;
	readonly PUBLIC_POLAR_PRODUCT_ID_MONTHLY?: string;
	readonly VERCEL_TOKEN?: string;
	readonly VERCEL_ACCESS_TOKEN?: string;
	readonly VERCEL_PROJECT_ID?: string;
	readonly VERCEL_TEAM_ID?: string;
	readonly VERCEL_ORG_ID?: string;
	readonly VERCEL_TEAM_SLUG?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
