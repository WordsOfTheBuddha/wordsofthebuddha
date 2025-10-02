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

// Heading renderer using token-based API; render inline tokens to support links/emphasis
renderer.heading = function (this: any, token: Tokens.Heading) {
	const html = this.parser?.parseInline
		? this.parser.parseInline(token.tokens)
		: token.text ?? "";
	const raw = (token.text ?? html).replace(/<[^>]*>/g, "");
	const id = slugify(raw);
	return `<h${token.depth} id="${id}">${html}</h${token.depth}>`;
};

// Customize paragraph rendering without heading logic
renderer.paragraph = function (this: any, token: Tokens.Paragraph) {
	const html: string = this.parser?.parseInline
		? this.parser.parseInline(token.tokens)
		: token.text ?? "";
	const t = html.trimStart();
	if (t.startsWith('<div class="pali-paragraph"')) {
		return html; // Don't wrap Pāli divs in paragraphs
	}
	if (t.startsWith('<div class="english-paragraph"')) {
		return html; // Don't wrap English divs in paragraphs
	}
	return `<p>${html}</p>`;
};

marked.use({ renderer });

// Simple markdown parser for basic syntax (links, paragraphs, tables)
export function parseSimpleMarkdown(text: string): string {
	if (!text) return "";

	let parsed = text.trim();

	// Handle markdown links [text](url)
	parsed = parsed.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">$1</a>'
	);

	// Handle bold text **text** or __text__
	parsed = parsed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
	parsed = parsed.replace(/__(.*?)__/g, "<strong>$1</strong>");

	// Handle italic text *text* or _text_
	parsed = parsed.replace(/\*(.*?)\*/g, "<em>$1</em>");
	parsed = parsed.replace(/_(.*?)_/g, "<em>$1</em>");

	// Split by double newlines to separate blocks, but also detect table sequences
	const blocks = parsed.split(/\n\s*\n/);
	const processedBlocks: string[] = [];
	let i = 0;

	while (i < blocks.length) {
		const block = blocks[i].trim();

		// Check if this block starts a table or if we can combine sequential table-like blocks
		if (block.includes("|")) {
			// Collect consecutive table-related blocks
			let tableContent = block;
			let j = i + 1;

			// Look ahead for more table rows that might be in separate blocks
			while (j < blocks.length && blocks[j].trim().includes("|")) {
				tableContent += "\n" + blocks[j].trim();
				j++;
			}

			// Try to parse as table
			const tableResult = parseMarkdownTable(tableContent);
			if (tableResult.startsWith("<table")) {
				processedBlocks.push(tableResult);
				i = j; // Skip all blocks we consumed
				continue;
			}
		}

		// Not a table, process as regular block
		processedBlocks.push(block);
		i++;
	}

	// Join blocks back and wrap non-table content in paragraphs
	const result = processedBlocks
		.filter((block) => block.length > 0)
		.map((block) => {
			// If it's already HTML (table), don't wrap in <p>
			if (block.startsWith("<table")) {
				return block;
			}
			return `<p>${block}</p>`;
		})
		.join("");

	return result || `<p>${parsed}</p>`;
}

// Parse markdown table into HTML
function parseMarkdownTable(tableText: string): string {
	const lines = tableText
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line);

	if (lines.length < 2) return tableText; // Not a valid table

	// Find header separator line (contains --- or --|, and has at least 3 dashes)
	const separatorIndex = lines.findIndex(
		(line) =>
			line.includes("---") ||
			(line.includes("--|") && line.includes("--"))
	);

	if (separatorIndex === -1) return tableText; // No separator found

	const headerLines = lines.slice(0, separatorIndex);
	const bodyLines = lines.slice(separatorIndex + 1);

	if (headerLines.length === 0) return tableText;

	// Parse header - could be multiple header rows
	const headerRows = headerLines
		.map((line) => parseTableRow(line))
		.filter((row) => row.length > 0);

	// Parse body rows
	const bodyRows = bodyLines
		.map((line) => parseTableRow(line))
		.filter((row) => row.length > 0);

	if (headerRows.length === 0 && bodyRows.length === 0) return tableText;

	// Build HTML table
	let html = '<table class="commentary-table">';

	// Header
	if (headerRows.length > 0) {
		html += "<thead>";
		headerRows.forEach((row) => {
			html += "<tr>";
			row.forEach((cell) => {
				html += `<th>${cell}</th>`;
			});
			html += "</tr>";
		});
		html += "</thead>";
	}

	// Body
	if (bodyRows.length > 0) {
		html += "<tbody>";
		bodyRows.forEach((row) => {
			html += "<tr>";
			row.forEach((cell) => {
				html += `<td>${cell}</td>`;
			});
			html += "</tr>";
		});
		html += "</tbody>";
	}

	html += "</table>";

	return html;
}

// Parse a table row, preserving gloss content |text::definition|
function parseTableRow(rowText: string): string[] {
	// Split by | but be careful not to split gloss content
	const cells: string[] = [];
	let currentCell = "";
	let insideGloss = false;
	let i = 0;

	while (i < rowText.length) {
		const char = rowText[i];

		if (char === "|") {
			// Check if this starts or ends a gloss
			const nextChar = rowText[i + 1];
			const prevChar = i > 0 ? rowText[i - 1] : "";

			// Look ahead to see if this could be a gloss pattern |text::definition|
			const remainingText = rowText.slice(i);
			const glossMatch = remainingText.match(/^\|([^|:]+)::([^|]+)\|/);

			if (glossMatch) {
				// This is a gloss, add it entirely to current cell
				currentCell += glossMatch[0];
				i += glossMatch[0].length;
				continue;
			}

			// Regular table delimiter
			if (!insideGloss) {
				// End of cell
				cells.push(currentCell.trim());
				currentCell = "";
			} else {
				currentCell += char;
			}
		} else {
			currentCell += char;
		}

		i++;
	}

	// Add the last cell
	if (currentCell.trim()) {
		cells.push(currentCell.trim());
	}

	// Remove empty cells from start and end (table delimiters)
	while (cells.length > 0 && cells[0] === "") {
		cells.shift();
	}
	while (cells.length > 0 && cells[cells.length - 1] === "") {
		cells.pop();
	}

	return cells;
}

export async function parseMarkdown(content: string): Promise<string> {
	return marked.parse(content);
}
