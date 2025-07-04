export interface TopicDiscourse {
	id: string;
	note?: string;
}

export interface Topic {
	title: string;
	description: string;
	synonyms?: string[];
	pali?: string[];
	related?: string[];
	redirects?: string[];
	discourses: TopicDiscourse[];
}
