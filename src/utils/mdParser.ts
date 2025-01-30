import { marked } from 'marked';

// Configure marked options
marked.setOptions({
    gfm: true,
    breaks: true,
    pedantic: false,
});

// Custom renderer
const renderer = new marked.Renderer();

// Customize paragraph rendering
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
