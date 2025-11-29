// Debug helper for development-only console output
export function debug(...args: any[]) {
	if (import.meta.env.DEV) {
		console.log(...args);
	}
}

type Heading = {
	depth: number;
	slug: string;
	text: string;
};

type ContentPair = {
	type: "paragraph" | "other";
	english: string;
	pali?: string;
	actualParagraphNumber?: number;
};

type ContentEntry = {
	body: string;
};

// Shared utility functions for hierarchical number handling
export function parseHierarchicalNumber(num: string) {
	const parts = num.split(".");
	return {
		major: parseInt(parts[0]),
		minor: parts[1] ? parseInt(parts[1]) : 0,
	};
}

export function compareHierarchicalNumber(a: string, b: string): number {
	const aParts = parseHierarchicalNumber(a);
	const bParts = parseHierarchicalNumber(b);

	if (aParts.major !== bParts.major) {
		return aParts.major - bParts.major;
	}
	return aParts.minor - bParts.minor;
}

export function isHierarchicalNumberInRange(
	num: string,
	start: string,
	end: string
): boolean {
	const numParts = parseHierarchicalNumber(num);
	const startParts = parseHierarchicalNumber(start);
	const endParts = parseHierarchicalNumber(end);

	const isAtOrAfterStart =
		numParts.major > startParts.major ||
		(numParts.major === startParts.major &&
			numParts.minor >= startParts.minor);
	const isAtOrBeforeEnd =
		numParts.major < endParts.major ||
		(numParts.major === endParts.major && numParts.minor <= endParts.minor);

	return isAtOrAfterStart && isAtOrBeforeEnd;
}

export function constructHierarchicalEnd(
	startStr: string,
	endStr: string
): string {
	if (startStr.includes(".")) {
		// For hierarchical discourse numbers like "1.306-308", construct "1.308"
		const startParts = startStr.split(".");
		return startParts.slice(0, -1).join(".") + "." + endStr;
	}
	return endStr;
}

export function isValidParagraphRange(start: number, end: number): boolean {
	return !isNaN(start) && !isNaN(end) && start <= end;
}

export function parseContent(
	paliContent: ContentEntry,
	englishContent: ContentEntry,
	sectionNumber?: number | string,
	fullReference?: string,
	paragraphRequest?: {
		type: "single" | "range";
		start: number;
		end?: number;
	} | null,
	discourseRange?: { start: string; end: string } | null
) {
	const pairs: ContentPair[] = [];
	const paliText = paliContent?.body?.trim?.() ? paliContent.body : "";
	const englishText = toSmartQuotes(englishContent?.body || "");

	// Handle paragraph requests
	if (paragraphRequest) {
		const allPairs = processBlocks(englishText, paliText, null);

		let paragraphCount = 0;
		const filteredPairs: ContentPair[] = [];
		const pendingHeadings: ContentPair[] = [];
		let inRange = false;

		for (const pair of allPairs) {
			const isHeading = pair.english.startsWith("#");

			if (isHeading) {
				// Store headings to potentially include later
				pendingHeadings.push(pair);
			} else {
				paragraphCount++;

				if (paragraphRequest.type === "single") {
					if (paragraphCount === paragraphRequest.start) {
						// For single paragraphs, don't include any headings (as per requirements)
						filteredPairs.push(pair);
						break;
					}
				} else if (paragraphRequest.type === "range") {
					const rangeStart = paragraphRequest.start;
					const rangeEnd =
						paragraphRequest.end || paragraphRequest.start;

					if (
						paragraphCount >= rangeStart &&
						paragraphCount <= rangeEnd
					) {
						// We're in the range
						if (!inRange) {
							// First paragraph in range - include any pending headings
							if (pendingHeadings.length > 0) {
								filteredPairs.push(...pendingHeadings);
							}
							inRange = true;
						} else {
							// We're already in range - include any pending headings that appeared between paragraphs
							if (pendingHeadings.length > 0) {
								filteredPairs.push(...pendingHeadings);
							}
						}

						filteredPairs.push(pair);
						pendingHeadings.length = 0; // Clear pending headings after using them
					} else if (paragraphCount > rangeEnd) {
						break;
					} else {
						// Clear pending headings if we're not in range yet
						pendingHeadings.length = 0;
					}
				}
			}
		}

		// Add "View full text" link for paragraph ranges and single paragraphs
		if (
			(paragraphRequest.type === "range" ||
				paragraphRequest.type === "single") &&
			filteredPairs.length > 0 &&
			fullReference
		) {
			const baseId = fullReference;
			filteredPairs.push({
				type: "paragraph",
				english: `\n\n<p><a href="/${baseId
					.toLowerCase()
					.replace(
						/\s+/g,
						""
					)}" class="text-blue-600 hover:underline">View full text for: ${baseId}</a></p>`,
			});
		}

		return filteredPairs;
	}

	// Handle discourse range requests (e.g., an1.306-308)
	if (discourseRange) {
		debug("Processing discourse range:", discourseRange);
		const englishBlocks = englishText.split(/\n\n+/);
		const paliBlocks = paliText.split(/\n\n+/);
		let inTargetRange = false;
		let targetEnglish: string[] = [];
		let targetPali: string[] = [];
		let foundEndHeading = false;

		debug("Total English blocks to process:", englishBlocks.length);
		debug(
			"Looking for start:",
			discourseRange.start,
			"end:",
			discourseRange.end
		);

		// Process English content
		for (let i = 0; i < englishBlocks.length; i++) {
			const block = englishBlocks[i];
			const isHeading =
				block.startsWith("###") || block.startsWith("####");

			if (isHeading) {
				const headingNumber = block.match(
					/#{3,4}\s+(\d+(?:\.\d+)?)/
				)?.[1];
				debug(
					`Block ${i}: Found heading ${headingNumber}, inTargetRange: ${inTargetRange}`
				);

				if (headingNumber) {
					debug(`Parsing hierarchical numbers:`);
					debug(
						`- Heading: ${headingNumber} -> major: ${
							parseHierarchicalNumber(headingNumber).major
						}, minor: ${
							parseHierarchicalNumber(headingNumber).minor
						}`
					);
					debug(
						`- Start: ${discourseRange.start} -> major: ${
							parseHierarchicalNumber(discourseRange.start).major
						}, minor: ${
							parseHierarchicalNumber(discourseRange.start).minor
						}`
					);
					debug(
						`- End: ${discourseRange.end} -> major: ${
							parseHierarchicalNumber(discourseRange.end).major
						}, minor: ${
							parseHierarchicalNumber(discourseRange.end).minor
						}`
					);

					const isInRange = isHierarchicalNumberInRange(
						headingNumber,
						discourseRange.start,
						discourseRange.end
					);
					debug(`- isInRange: ${isInRange}`);

					// Check if this heading is the start of our range
					if (headingNumber === discourseRange.start) {
						inTargetRange = true;
						targetEnglish.push(block);
						debug(
							`Found START heading ${headingNumber}, entering range`
						);
					} else if (
						inTargetRange &&
						headingNumber === discourseRange.end
					) {
						// Include the end heading and mark that we found it
						targetEnglish.push(block);
						foundEndHeading = true;
						debug(
							`Found END heading ${headingNumber}, marking end found`
						);
					} else if (inTargetRange && isInRange) {
						// This is a heading within our range (between start and end)
						targetEnglish.push(block);
						debug(
							`Found WITHIN range heading ${headingNumber}, including`
						);
					} else if (inTargetRange && !isInRange) {
						// We've passed the end range
						debug(
							`Found heading ${headingNumber} beyond end range, breaking`
						);
						break;
					}
				}
			} else if (inTargetRange) {
				targetEnglish.push(block);
				debug(
					`Block ${i}: Added content block to target (inTargetRange: ${inTargetRange})`
				);
			} else {
				debug(`Block ${i}: Skipping content block (not in range)`);
			}
		}

		debug("Collected English blocks:", targetEnglish.length);
		debug("Found end heading:", foundEndHeading);

		// Process Pali content similarly
		inTargetRange = false;
		foundEndHeading = false;
		for (const block of paliBlocks) {
			const isHeading =
				block.startsWith("###") || block.startsWith("####");
			if (isHeading) {
				const headingNumber = block.match(
					/#{3,4}\s+(\d+(?:\.\d+)?)/
				)?.[1];

				if (headingNumber) {
					const isInRange = isHierarchicalNumberInRange(
						headingNumber,
						discourseRange.start,
						discourseRange.end
					);

					if (headingNumber === discourseRange.start) {
						inTargetRange = true;
						targetPali.push(block);
					} else if (
						inTargetRange &&
						headingNumber === discourseRange.end
					) {
						targetPali.push(block);
						foundEndHeading = true;
					} else if (inTargetRange && isInRange) {
						targetPali.push(block);
					} else if (inTargetRange && !isInRange) {
						break;
					}
				}
			} else if (inTargetRange) {
				targetPali.push(block);
			}
		}

		// Add "View full text" link if this is a partial view
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

		const result = processBlocks(
			targetEnglish.join("\n\n"),
			targetPali.join("\n\n"),
			{ type: "discourse", originalContent: englishText } // Pass original content for paragraph numbering
		);
		return result;
	}

	// Handle existing section logic (for discourse ranges like an1.308 -> an1.306-315)
	if (sectionNumber) {
		debug("Processing single section:", sectionNumber);
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
				debug(
					"Found heading:",
					headingNumber,
					"looking for:",
					sectionNumber
				);
				if (headingNumber === sectionNumber) {
					inTargetSection = true;
					targetEnglish.push(block);
					debug("Entered target section");
				} else if (inTargetSection) {
					debug("Exiting target section");
					break;
				}
			} else if (inTargetSection) {
				targetEnglish.push(block);
				debug("Added block to target section");
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

		debug("Target English blocks for section:", targetEnglish.length);
		debug("Will use discourse-style processing for single section");

		// Process the section content with discourse-style paragraph numbering
		const result = processBlocks(
			targetEnglish.join("\n\n"),
			targetPali.join("\n\n"),
			{ type: "discourse", originalContent: englishText } // Use discourse logic for proper paragraph numbering
		);
		return result;
	}

	const result = processBlocks(englishText, paliText, null);
	return result;
}

function processBlocks(
	englishText: string,
	paliText: string,
	options?: { type: "discourse"; originalContent: string } | null
): ContentPair[] {
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
	let actualParagraphNumber = 1;

	// If this is a discourse range, calculate the starting paragraph number
	if (options?.type === "discourse" && options.originalContent) {
		const originalBlocks = options.originalContent
			.split(/\n\n+/)
			.filter((p) => p.trim().length > 0 && !p.startsWith("---"));

		debug("Calculating paragraph starting number for discourse range");
		debug("Original blocks count:", originalBlocks.length);
		debug("Target blocks count:", englishBlocks.length);

		// Find where our first NON-HEADING block appears in the original content
		const firstNonHeadingBlock = englishBlocks.find(
			(block) => !block.startsWith("#")
		);
		debug(
			"First non-heading block:",
			firstNonHeadingBlock?.substring(0, 100)
		);

		if (firstNonHeadingBlock) {
			let paragraphCount = 0;
			for (const block of originalBlocks) {
				const isPlainParagraph =
					!block.startsWith("#") &&
					!block.startsWith("<") &&
					!block.startsWith("```");
				if (isPlainParagraph) {
					paragraphCount++;
				}
				if (block === firstNonHeadingBlock) {
					actualParagraphNumber = paragraphCount;
					debug(
						"Found first non-heading block at paragraph position:",
						paragraphCount
					);
					break;
				}
			}
		}
		debug("Starting paragraph number set to:", actualParagraphNumber);
	}

	englishBlocks.forEach((block: string, blockIndex: number) => {
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
				actualParagraphNumber: isPlainParagraph
					? actualParagraphNumber
					: undefined,
			});
		} else {
			pairs.push({
				type: "paragraph",
				english: block,
				actualParagraphNumber: isPlainParagraph
					? actualParagraphNumber
					: undefined,
			});
		}

		if (isPlainParagraph) {
			actualParagraphNumber++;
		}
		paliIndex++;
	});

	return pairs;
}

// Helper to process quotes in a paragraph based on boundaries.
function processParagraphQuotes(
	p: string,
	quote: string,
	open: string,
	close: string
): string {
	// Replace quote at start/end and adjacent to whitespace
	p = p
		.replace(new RegExp(`^${quote}`, "g"), open)
		.replace(new RegExp(`${quote}$`, "g"), close)
		.replace(new RegExp(`(\\s)${quote}`, "g"), `$1${open}`)
		.replace(new RegExp(`${quote}(\\s)`, "g"), `${close}$1`);
	return p;
}

function toSmartQuotes(text: string): string {
	// First handle paired quotes via regex.
	let processed = text
		.replace(/"([^"]*?)"/g, "“$1”")
		.replace(/'([^']*?)'/g, "‘$1’");

	// Handle contractions (preserving apostrophes) explicitly.
	processed = processed.replace(/(\w)'(\w)/g, "$1’$2");

	// Split into paragraphs for context-based processing.
	const paragraphs = processed.split(/\n\n+/);
	for (let i = 0; i < paragraphs.length; i++) {
		let p = paragraphs[i];
		p = processParagraphQuotes(p, '"', "“", "”");
		p = processParagraphQuotes(p, "'", "‘", "’");
		paragraphs[i] = p;
	}
	return paragraphs.join("\n\n");
}

export type SplitContent = {
	pali: string;
	english: string;
};

// Add word wrapping for Pali text to enable word-by-word navigation
function wrapPaliWords(text: string): string {
	// Split on whitespace while preserving it
	const tokens = text.split(/(\s+)/);

	return tokens
		.map((token, index) => {
			// If it's whitespace, wrap it in a span to preserve it
			if (/^\s+$/.test(token)) {
				return `<span class="word-space">${token}</span>`;
			}

			// Check if token contains Pali characters
			if (/[a-zA-ZāīūṅñṭḍṇḷṃṁĀĪŪṄÑŢĎŅĻṂ]/.test(token)) {
				// Handle breaking punctuation (em-dash, en-dash, etc.)
				const breakingPunctuation = /([—–])/g;

				if (breakingPunctuation.test(token)) {
					// Split on breaking punctuation while preserving it
					const parts = token.split(/([—–])/);

					return parts
						.map((part) => {
							if (/[—–]/.test(part)) {
								// Breaking punctuation gets its own span
								return `<span class="punctuation">${part}</span>`;
							} else if (
								/[a-zA-ZāīūṅñṭḍṇḷṃṁĀĪŪṄÑŢĎŅĻṂ]/.test(part)
							) {
								// Word part gets pali-word span
								const cleanWord = part
									.toLowerCase()
									.replace(
										/[''.,;:!?…"'"'\(\)\[\]\{\}«»"“”‘’]/g,
										""
									);
								return `<span class="pali-word" data-word="${cleanWord}" data-original="${part}">${part}</span>`;
							} else {
								// Other punctuation (attached to words)
								return part;
							}
						})
						.join("");
				} else {
					// No breaking punctuation, treat as single word
					const cleanWord = token
						.toLowerCase()
						.replace(/[''.,;:!?…—"'"'\(\)\[\]\{\}«»"“”‘’]/g, "");
					return `<span class="pali-word" data-word="${cleanWord}" data-original="${token}">${token}</span>`;
				}
			}

			// Other tokens (pure punctuation), return as-is or wrap in punctuation span
			if (/[—–]/.test(token)) {
				return `<span class="punctuation">${token}</span>`;
			}

			return token;
		})
		.join("");
}

function formatBlock(
	text: string,
	isPali: boolean = false,
	index?: number,
	paragraphRequest?: {
		type: "single" | "range";
		start: number;
		end?: number;
	} | null,
	actualParagraphNumber?: number
): string {
	// Helper to convert bold (**text**), italic (*text*), and superscript (^text^) markdown to HTML
	// Must process bold first to avoid conflicts with italic
	const processInlineEmphasis = (s: string): string => {
		// Handle bold: **text** or __text__ (non-greedy)
		let result = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
		result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");
		// Handle italic: *text* or _text_ (non-greedy, but not inside words for underscore)
		result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
		result = result.replace(
			/(?<![a-zA-Z])_(.+?)_(?![a-zA-Z])/g,
			"<em>$1</em>"
		);
		// Handle superscript: ^text^ - everything between carets becomes superscript (non-greedy)
		result = result.replace(/\^(.+?)\^/g, "<sup>$1</sup>");
		return result;
	};

	// Handle headings - still process inline emphasis
	if (text.startsWith("#")) {
		return processInlineEmphasis(text);
	}

	// Generate paragraph number and anchor ID (just the number, no prefix)
	// Only add anchor IDs to English paragraphs to avoid conflicts
	// Skip anchor IDs for "View full text" links
	let anchorId = "";
	const isViewFullTextLink = text.includes("View full text for:");

	if (index !== undefined && !isPali && !isViewFullTextLink) {
		// Use actual paragraph number if available, otherwise calculate from request
		let paragraphNum = actualParagraphNumber;

		if (!paragraphNum) {
			// Fall back to old logic if no actual paragraph number
			paragraphNum = index + 1;
			if (paragraphRequest) {
				if (paragraphRequest.type === "single") {
					paragraphNum = paragraphRequest.start;
				} else if (paragraphRequest.type === "range") {
					paragraphNum = paragraphRequest.start + index;
				}
			}
		}

		anchorId = ` id="${paragraphNum}" data-paragraph-number="${paragraphNum}"`;
	}

	// Add data-pair-id to track corresponding paragraphs
	const pairAttr = index !== undefined ? ` data-pair-id="${index}"` : "";
	const isVerseText = isVerse(text);
	const className = isPali ? "pali-paragraph" : "english-paragraph";
	const verseClass = isVerseText ? (isPali ? "verse-basic" : "verse") : "";

	// Helper to convert inline markdown links to anchors, but NOT inside gloss patterns |term::definition|
	const replaceMarkdownLinksOutsideGloss = (s: string): string => {
		const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
		const glossRegex = /\|[^|]*?::[^|]*?\|/g; // non-greedy gloss pattern
		let result = "";
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = glossRegex.exec(s)) !== null) {
			const before = s.slice(lastIndex, match.index);
			// Replace links in the segment before gloss
			result += before.replace(linkRegex, (_m, label, url) => {
				const href = String(url).trim();
				const isExternal = /^https?:\/\//i.test(href);
				const extra = isExternal
					? ' target="_blank" rel="noopener"'
					: "";
				return `<a href="${href}" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"${extra}>${label}</a>`;
			});
			// Append gloss untouched
			result += match[0];
			lastIndex = glossRegex.lastIndex;
		}
		// Trailing remainder
		const tail = s.slice(lastIndex);
		result += tail.replace(linkRegex, (_m, label, url) => {
			const href = String(url).trim();
			const isExternal = /^https?:\/\//i.test(href);
			const extra = isExternal ? ' target="_blank" rel="noopener"' : "";
			return `<a href="${href}" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"${extra}>${label}</a>`;
		});
		return result;
	};

	// Wrap individual words if this is a Pali paragraph and convert inline markdown links
	let processedText = text;
	if (isPali) {
		processedText = wrapPaliWords(text);
	}
	// Convert inline markdown links for both English and Pāli content, but keep links inside gloss patterns as raw markdown
	processedText = replaceMarkdownLinksOutsideGloss(processedText);
	// Convert bold, italic, and superscript markdown to HTML
	processedText = processInlineEmphasis(processedText);

	return `<p${anchorId}${pairAttr} class="${className} ${verseClass}">${
		isVerseText ? transformVerseNewlines(processedText) : processedText
	}</p>`;
}

export function createCombinedMarkdown(
	pairs: ContentPair[],
	showPali: boolean,
	layout: "split" | "interleaved" = "interleaved",
	paragraphRequest?: {
		type: "single" | "range";
		start: number;
		end?: number;
	} | null
): string | SplitContent {
	if (layout === "split" && showPali) {
		let pairIndex = 0;

		const pali = pairs
			.filter(
				(pair): pair is ContentPair & { pali: string } =>
					pair.pali !== undefined
			)
			.map((pair) => {
				if (!pair.pali.startsWith("#")) {
					return formatBlock(
						pair.pali,
						true,
						pairIndex++,
						paragraphRequest,
						pair.actualParagraphNumber
					);
				}
				return formatBlock(
					pair.pali,
					true,
					undefined,
					paragraphRequest,
					pair.actualParagraphNumber
				);
			})
			.join("\n\n");

		pairIndex = 0;
		const english = pairs
			.map((pair) => {
				if (!pair.english.startsWith("#")) {
					return formatBlock(
						pair.english,
						false,
						pairIndex++,
						paragraphRequest,
						pair.actualParagraphNumber
					);
				}
				return formatBlock(
					pair.english,
					false,
					undefined,
					paragraphRequest,
					pair.actualParagraphNumber
				);
			})
			.join("\n\n");

		return { pali, english };
	}

	// Return interleaved content
	let pairIndex = 0;
	const result = pairs
		.map((pair) => {
			if (!showPali || !pair.pali) {
				const currentIndex = pair.english.startsWith("#")
					? undefined
					: pairIndex++;
				return formatBlock(
					pair.english,
					false,
					currentIndex,
					paragraphRequest,
					pair.actualParagraphNumber
				);
			}
			const currentIndex = pair.english.startsWith("#")
				? undefined
				: pairIndex++;
			return `${formatBlock(
				pair.pali,
				true,
				currentIndex,
				paragraphRequest,
				pair.actualParagraphNumber
			)}\n\n${formatBlock(
				pair.english,
				false,
				currentIndex,
				paragraphRequest,
				pair.actualParagraphNumber
			)}`;
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

	const lastLineValid = /[\]!.?"—'’;:‘”“]$/.test(lastLine);
	const otherLinesValid = otherLines.every((line) => /[,;:.?!]?$/.test(line));

	return lastLineValid && otherLinesValid;
};

const transformVerseNewlines = (text: string): string => {
	return text.replace(/\n/g, "<br />");
};
