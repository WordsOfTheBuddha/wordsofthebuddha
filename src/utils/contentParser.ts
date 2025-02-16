type Heading = {
	depth: number;
	slug: string;
	text: string;
};

type ContentPair = {
	type: "paragraph" | "other";
	english: string;
	pali?: string;
};

type ContentEntry = {
	body: string;
};

export function parseContent(
	paliContent: ContentEntry,
	englishContent: ContentEntry,
	sectionNumber?: string,
	fullReference?: string // e.g. "DHP 1-20"
) {
	const pairs: ContentPair[] = [];
	const paliText = paliContent?.body?.trim?.() ? paliContent.body : "";
	const englishText = toSmartQuotes(englishContent?.body || "");

	if (sectionNumber) {
		// Find section boundaries in both English and Pali content
		const englishBlocks = englishText.split(/\n\n+/);
		const paliBlocks = paliText.split(/\n\n+/);
		let inTargetSection = false;
		let targetEnglish: string[] = [];
		let targetPali: string[] = [];

		// Process English content
		for (const block of englishBlocks) {
			const isHeading =
				block.startsWith("###") || block.startsWith("####");
			if (isHeading) {
				const headingNumber = block.match(
					/#{3,4}\s+(\d+(?:\.\d+)?)/
				)?.[1];
				if (headingNumber === sectionNumber) {
					inTargetSection = true;
					targetEnglish.push(block);
				} else if (inTargetSection) {
					break;
				}
			} else if (inTargetSection) {
				targetEnglish.push(block);
			}
		}

		// Reset and process Pali content
		inTargetSection = false;
		for (const block of paliBlocks) {
			const isHeading =
				block.startsWith("###") || block.startsWith("####");
			if (isHeading) {
				const headingNumber = block.match(
					/#{3,4}\s+(\d+(?:\.\d+)?)/
				)?.[1];
				if (headingNumber === sectionNumber) {
					inTargetSection = true;
					targetPali.push(block);
				} else if (inTargetSection) {
					break;
				}
			} else if (inTargetSection) {
				targetPali.push(block);
			}
		}

		// Add "See full text" link if this is a partial view
		if (fullReference) {
			targetEnglish.push(
				`\n\n<p><a href="/${fullReference
					.toLowerCase()
					.replace(
						" ",
						""
					)}" class="text-blue-600 hover:underline">View full text for: ${fullReference}</a></p>`
			);
		}

		// Process the section content
		return processBlocks(
			targetEnglish.join("\n\n"),
			targetPali.join("\n\n")
		);
	}

	return processBlocks(englishText, paliText);
}

function processBlocks(englishText: string, paliText: string): ContentPair[] {
	const pairs: ContentPair[] = [];

	const paliParagraphs = paliText
		? paliText
				.split(/\n\n+/)
				.filter((p) => p.trim().length > 0 && !p.startsWith("---"))
		: [];

	const englishBlocks = englishText
		.split(/\n\n+/)
		.filter((p) => p.trim().length > 0 && !p.startsWith("---"));

	let paliIndex = 0;

	englishBlocks.forEach((block: string) => {
		const isPlainParagraph =
			!block.startsWith("#") &&
			!block.startsWith("<") &&
			!block.startsWith("```");

		if (
			isPlainParagraph &&
			paliParagraphs[paliIndex] &&
			!paliParagraphs[paliIndex].startsWith("#")
		) {
			pairs.push({
				type: "paragraph",
				english: block,
				pali: paliParagraphs[paliIndex],
			});
		} else {
			pairs.push({
				type: "paragraph",
				english: block,
			});
		}
		paliIndex++;
	});

	return pairs;
}

function toSmartQuotes(text: string): string {
	return text.replace(/"([^"]*)"/g, "“$1”").replace(/'([^']*)'/g, "‘$1’");
}

export function createCombinedMarkdown(
	pairs: ContentPair[],
	showPali: boolean
) {
	const result = pairs
		.map((pair) => {
			if (pair.type === "other") {
				return pair.english;
			}
			const isVerseText = isVerse(pair.english);
			const verseEnglish = isVerse(pair.english) ? "verse" : "";

			if (!showPali || !pair.pali) {
				return isVerseText
					? `<p class="english-paragraph ${verseEnglish}">${transformVerseNewlines(
							pair.english
					  )}</p>`
					: pair.english;
			}
			const versePali = isVerse(pair.pali) ? "verse-basic" : "";
			return `<p class="pali-paragraph ${versePali}">${
				isVerseText ? transformVerseNewlines(pair.pali) : pair.pali
			}</p>\n\n<p class="english-paragraph ${verseEnglish}">${
				isVerseText
					? transformVerseNewlines(pair.english)
					: pair.english
			}</p>`;
		})
		.join("\n\n");

	return result;
}

const isVerse = (text: string) => {
	const lines = text
		.split(/(?:\r\n|\n|\r|<br>)/)
		.map((l) => l.trim())
		.filter(Boolean);

	if (lines.length < 2) return false;

	const lastLine = lines[lines.length - 1];
	const otherLines = lines.slice(0, -1);

	const lastLineValid = /[.?"—'’;‘”]$/.test(lastLine);
	const otherLinesValid = otherLines.every((line) => /[,;:.?!]?$/.test(line));

	return lastLineValid && otherLinesValid;
};

const transformVerseNewlines = (text: string): string => {
	return text.replace(/\n/g, "<br />");
};
