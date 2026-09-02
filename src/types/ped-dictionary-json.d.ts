declare module "../data/pedDictionary.generated.json" {
	const value: {
		_meta?: {
			source?: string;
			license?: string;
			generatedAt?: string;
			entries?: number;
		};
		entries: Record<string, string>;
	};
	export default value;
}

declare module "*/pedDictionary.generated.json" {
	const value: {
		_meta?: {
			source?: string;
			license?: string;
			generatedAt?: string;
			entries?: number;
		};
		entries: Record<string, string>;
	};
	export default value;
}
