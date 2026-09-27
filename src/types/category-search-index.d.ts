declare module "virtual:category-search-index-url" {
	/** Hashed URL of the prebuilt category index; null in dev or when not generated. */
	const url: string | null;
	export default url;
}
