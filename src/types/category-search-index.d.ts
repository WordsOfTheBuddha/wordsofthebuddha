declare module "virtual:category-search-index-url" {
	/** Hashed URLs of the prebuilt category index files; null in dev or when not generated. */
	export const categorySearchIndexUrl: string | null;
	export const categoryDescriptionsUrl: string | null;
}
