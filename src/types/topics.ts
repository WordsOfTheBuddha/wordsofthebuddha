export interface TopicDiscourse {
	id: string;
	note?: string;
}

export interface TopicPost {
	url: string;
	title: string;
	description?: string;
}

export interface Topic {
	title: string;
	description: string;
	synonyms?: string[];
	pali?: string[];
	related?: string[];
	supportedBy?: string[];
	leadsTo?: string[];
	opposite?: string[];
	redirects?: string[];
	post?: TopicPost;
	discourses: TopicDiscourse[];
}
