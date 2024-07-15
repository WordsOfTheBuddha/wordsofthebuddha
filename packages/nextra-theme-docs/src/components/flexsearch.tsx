import cn from "clsx";
// flexsearch types are incorrect, they were overwritten in tsconfig.json
import FlexSearch from "flexsearch";
import { useRouter } from "next/router";
import type { SearchData } from "nextra";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useState } from "react";
import { DEFAULT_LOCALE } from "../constants";
import type { SearchResult } from "../types";
import { HighlightMatches } from "./highlight-matches";
import { Search } from "./search";

type SectionIndex = FlexSearch.Document<
	{
		id: string;
		url: string;
		title: string;
		pageId: string;
		content: string;
		display?: string;
	},
	["title", "content", "url", "display"]
>;

type PageIndex = FlexSearch.Document<
	{
		id: number;
		discourseId: string;
		title: string;
		content: string;
	},
	["discourseId", "title"]
>;

type Result = {
	_page_rk: number;
	_section_rk: number;
	route: string;
	prefix: ReactNode;
	children: ReactNode;
};

// This can be global for better caching.
const indexes: {
	[locale: string]: [PageIndex, SectionIndex];
} = {};

// Custom encoder to remove diacritics and normalize text
const removeDiacritics = (str: string) =>
	str
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

const isVerse = (paragraph: string): boolean => {
	const lines = paragraph.trim().split("\n");
	if (lines.length < 2) return false;

	const lastLine = lines[lines.length - 1].trim();
	const otherLines = lines.slice(0, -1);

	const lastLineValid = /[.?"-]$/.test(lastLine);
	const otherLinesValid = otherLines.every((line) =>
		/[,;:.?]?$/i.test(line.trim())
	);

	return lastLineValid && otherLinesValid;
};

type Pattern = {
  regex: RegExp;
  offset: number;
};

function splitByPatterns(text: string): string[] {
  // Define the regular expression patterns in logical order
  const patterns: Pattern[] = [
    { regex: /\.""(?=[A-Z])/g, offset: 2 },
    { regex: /\?""(?=[A-Z])/g, offset: 2 },
    { regex: /:"(?=[A-Z])/g, offset: 1 },
    { regex: /\.'(?=[A-Z])/g, offset: 2 },
    { regex: /\."(?=[A-Z])/g, offset: 2 },
    { regex: /\.(?=[A-Z])/g, offset: 1 }
  ];

  function splitTextByPatterns(text: string, patterns: Pattern[]): string[] {
    let paragraphs: string[] = [text];

    patterns.forEach(pattern => {
      let newParagraphs: string[] = [];

      paragraphs.forEach(paragraph => {
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.regex.exec(paragraph)) !== null) {
          const matchIndex = match.index + pattern.offset;
          newParagraphs.push(paragraph.slice(lastIndex, matchIndex).trim());
          lastIndex = matchIndex;
        }

        if (lastIndex < paragraph.length) {
          newParagraphs.push(paragraph.slice(lastIndex).trim());
        }
      });

      paragraphs = newParagraphs;
    });

    return paragraphs;
  }

  return splitTextByPatterns(text, patterns);
}

const splitContentIntoParagraphs = (content: string): string[] => {
	// First split content by custom patterns
	const rawParagraphs = splitByPatterns(content);
	const paragraphs: string[] = [];

	rawParagraphs.forEach((rawParagraph) => {
		// Split raw paragraph by single newlines to handle verses
		const lines = rawParagraph.split("\n").map((line) => line.trim());

		let currentParagraph = "";
		lines.forEach((line, index) => {
			if (currentParagraph) {
				currentParagraph += "\n" + line;
			} else {
				currentParagraph = line;
			}

			// If it's the last line or the next line starts a new paragraph, push the current paragraph
			if (index === lines.length - 1 || lines[index + 1] === "") {
				if (isVerse(currentParagraph)) {
					paragraphs.push(currentParagraph);
				} else {
					paragraphs.push(
						...currentParagraph.split("\n\n").map(removeDiacritics)
					);
				}
				currentParagraph = "";
			}
		});
	});

  return paragraphs.filter(paragraph => paragraph.trim().length > 0);
};

const getDiscourseId = (url: string): string => {
	// Split the URL by '/' and get the last part
	const parts = url.split("/");
	const lastPart = parts[parts.length - 1];

	// Extract the discourse ID without the extension
	return lastPart.replace(/(.*)(\.\w{2,3})(#[\s\S]*)?$/, "$1$3");
};

const getFormattedDiscourseId = (url: string): string => {
	const discourseId = getDiscourseId(url);
	// Match the text part and the numeric part, including dots or dashes
	const match = discourseId.match(/^([a-zA-Z]+)([0-9]+(?:[\.\-][0-9]+)*)$/);

	if (match) {
		const [_, text, number] = match;
		// Format the string to "TEXT NUMBER"
		return `${text.toUpperCase()} ${number}`;
	}

	return discourseId;
};

// Caches promises that load the index
const loadIndexesPromises = new Map<string, Promise<void>>();
const loadIndexes = (basePath: string, locale: string): Promise<void> => {
	const key = basePath + "@" + locale;
	if (loadIndexesPromises.has(key)) {
		return loadIndexesPromises.get(key)!;
	}
	const promise = loadIndexesImpl(basePath, locale);
	loadIndexesPromises.set(key, promise);
	return promise;
};

const loadIndexesImpl = async (
	basePath: string,
	locale: string
): Promise<void> => {
	const response = await fetch(
		`${basePath}/_next/static/chunks/nextra-data-${locale}.json`
	);
	const searchData = (await response.json()) as SearchData;

	const pageIndex: PageIndex = new FlexSearch.Document({
		cache: 100,
		tokenize: "full",
		document: {
			id: "id",
			index: "content",
			store: ["discourseId", "title"],
		},
		context: {
			resolution: 9,
			depth: 2,
			bidirectional: true,
		},
	});

	const sectionIndex: SectionIndex = new FlexSearch.Document({
		cache: 100,
		tokenize: "full",
		document: {
			id: "id",
			index: "content",
			tag: "pageId",
			store: ["title", "content", "url", "display"],
		},
		context: {
			resolution: 9,
			depth: 2,
			bidirectional: true,
		},
	});

	let pageId = 0;

	for (const [route, structurizedData] of Object.entries(searchData)) {
		let pageContent = "";
		++pageId;

		for (const [key, content] of Object.entries(structurizedData.data)) {
			const [headingId, headingValue] = key.split("#");
			const url = route + (headingId ? "#" + headingId : "");
			const pageTitle = removeDiacritics(structurizedData.title);
			const title = removeDiacritics(headingValue || structurizedData.title);
			const paragraphs = splitContentIntoParagraphs(content);
      const revisedContent = removeDiacritics(paragraphs.join("\n\n"));

			//for (let i = 0; i < paragraphs.length; i++) {
				sectionIndex.add({
					id: url,
					url,
					title,
					pageId: `page_${pageId}`,
					content:
						getDiscourseId(route) +
						" " +
						getFormattedDiscourseId(route) +
						" " +
						pageTitle +
						" " + title + " " +
						revisedContent,
				});
			//}

			// Add the page itself.
			pageContent += ` ${title} ${paragraphs.join(" ")}`;
		}

		pageContent += `${getDiscourseId(route)} ${getFormattedDiscourseId(
			route
		)} ${removeDiacritics(structurizedData.title)}`;

		pageIndex.add({
			id: pageId,
			discourseId: getFormattedDiscourseId(route),
			title: removeDiacritics(structurizedData.title),
			content: pageContent, // Already normalized
		});
	}

	indexes[locale] = [pageIndex, sectionIndex];
};

export function Flexsearch({
	className,
}: {
	className?: string;
}): ReactElement {
	const { locale = DEFAULT_LOCALE, basePath } = useRouter();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);
	const [results, setResults] = useState<SearchResult[]>([]);
	const [search, setSearch] = useState("");

	const doSearch = (search: string) => {
		if (!search) return;
		const [pageIndex, sectionIndex] = indexes[locale];

		const normalizedSearch = removeDiacritics(search);

		// Show the results for the top 5 pages
		const pageResults =
			pageIndex.search<true>(normalizedSearch, 5, {
				enrich: true,
				suggest: true,
			})[0]?.result || [];

		const results: Result[] = [];
		const pageTitleMatches: Record<number, number> = {};

		for (let i = 0; i < pageResults.length; i++) {
			const result = pageResults[i];
			pageTitleMatches[i] = 0;

			// Show the top 5 results for each page
			const sectionResults =
				sectionIndex.search<true>(normalizedSearch, 5, {
					enrich: true,
					suggest: true,
					tag: `page_${result.id}`,
				})[0]?.result || [];

			let isFirstItemOfPage = true;
			const occurred: Record<string, boolean> = {};

			for (let j = 0; j < sectionResults.length; j++) {
				const { doc } = sectionResults[j];
				const isMatchingTitle = doc.display !== undefined;
				if (isMatchingTitle) {
					pageTitleMatches[i]++;
				}
				const { url, title } = doc;
				const content = doc.display || doc.content;
				const urlId = result.doc.discourseId;
				// Step 1 & 2: Prepare both versions of urlId, with and without spaces
				const urlIdNoSpaces = urlId.replace(/\s+/g, "");

				// Prepare the title for regex
				const titleForRegex = result.doc.title.replace(
					/[.*+?^${}()|[\]\\]/g,
					"\\$&"
				);

        const sectionTitleForRegex = doc.title.replace(
          /[.*+?^${}()|[\]\\]/g,
					"\\$&"
				);

				// Create a regex pattern that matches both versions
				// The pattern escapes special regex characters in urlId to avoid issues
				const pattern = new RegExp(
					`${urlId.replace(
						/[.*+?^${}()|[\]\\]/gi,
						"\\$&"
					)}|${urlIdNoSpaces.replace(
						/[.*+?^${}()|[\]\\]/g,
						"\\$&"
					)}|${titleForRegex}|${sectionTitleForRegex}`,
					"gi"
				);
				let titleString = urlId;
				if (urlId !== result.doc.title) {
					titleString += `: ${result.doc.title}`;
				}

				// Step 4: Replace occurrences in content
				const cleanedContent = content.replace(pattern, "");
				if (occurred[url + "@" + cleanedContent]) continue;
				occurred[url + "@" + cleanedContent] = true;
				results.push({
					_page_rk: i,
					_section_rk: j,
					route: url,
					prefix: isFirstItemOfPage && (
						<div
							className={cn(
								"nx-mx-2.5 nx-mb-2 nx-mt-6 nx-select-none nx-border-b nx-border-black/10 nx-px-2.5 nx-pb-1.5 nx-text-xs nx-font-semibold nx-uppercase nx-text-gray-500 first:nx-mt-0 dark:nx-border-white/20 dark:nx-text-gray-300",
								"contrast-more:nx-border-gray-600 contrast-more:nx-text-gray-900 contrast-more:dark:nx-border-gray-50 contrast-more:dark:nx-text-gray-50"
							)}
						>
							{titleString}
						</div>
					),
					children: (
						<>
							<div className="nx-text-base nx-font-semibold nx-leading-5">
								<HighlightMatches match={search} value={title} />
							</div>
							{cleanedContent && (
								<div className="excerpt nx-mt-1 nx-text-sm nx-leading-[1.35rem] nx-text-gray-600 dark:nx-text-gray-400 contrast-more:dark:nx-text-gray-50">
									<HighlightMatches match={search} value={cleanedContent} />
								</div>
							)}
						</>
					),
				});
				isFirstItemOfPage = false;
			}
		}

		setResults(
			results
				.sort((a, b) => {
					// Sort by number of matches in the title.
					if (a._page_rk === b._page_rk) {
						return a._section_rk - b._section_rk;
					}
					if (pageTitleMatches[a._page_rk] !== pageTitleMatches[b._page_rk]) {
						return pageTitleMatches[b._page_rk] - pageTitleMatches[a._page_rk];
					}
					return a._page_rk - b._page_rk;
				})
				.map((res) => ({
					id: `${res._page_rk}_${res._section_rk}`,
					route: res.route,
					prefix: res.prefix,
					children: res.children,
				}))
		);
	};

	const preload = useCallback(
		async (active: boolean) => {
			if (active && !indexes[locale]) {
				setLoading(true);
				try {
					await loadIndexes(basePath, locale);
				} catch (e) {
					setError(true);
				}
				setLoading(false);
			}
		},
		[locale, basePath]
	);

	const handleChange = async (value: string) => {
		setSearch(value);
		if (loading) {
			return;
		}
		if (!indexes[locale]) {
			setLoading(true);
			try {
				await loadIndexes(basePath, locale);
			} catch (e) {
				setError(true);
			}
			setLoading(false);
		}
		doSearch(value);
	};

	return (
		<Search
			loading={loading}
			error={error}
			value={search}
			onChange={handleChange}
			onActive={preload}
			className={className}
			overlayClassName="nx-w-screen nx-min-h-[100px] nx-max-w-[min(calc(100vw-2rem),calc(100%+20rem))]"
			results={results}
		/>
	);
}
