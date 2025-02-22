import { marked } from "marked";
import type { Tokens } from "marked";

// Configure marked options
marked.setOptions({
	gfm: true,
	breaks: true,
	pedantic: false,
});

// Custom renderer
const renderer = new marked.Renderer();

// Add slugify helper
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

// Fix heading renderer to match marked's interface
renderer.heading = (heading: Tokens.Heading) => {
	const { depth, text } = heading;
	return `<h${depth} id=${slugify(text)}>${text}</h${depth}>`;
};

// Customize paragraph rendering without heading logic
renderer.paragraph = ({ text }) => {
	if (text.startsWith('<div class="pali-paragraph"')) {
		return text; // Don't wrap Pāli divs in paragraphs
	}
	if (text.startsWith('<div class="english-paragraph"')) {
		return text; // Don't wrap English divs in paragraphs
	}
	return `<p>${text}</p>`;
};

marked.use({ renderer });

export async function parseMarkdown(content: string): Promise<string> {
	return marked.parse(content);
}
