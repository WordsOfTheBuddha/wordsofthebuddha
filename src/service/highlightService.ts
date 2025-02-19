import { getDomPath, scanPageForHighlights } from "../utils/dom";

export interface HighlightInfo {
	text: string;
	color: string;
	index: number;
}

export async function persistToFirestore(
	rangyHash: string,
	highlighter: Highlighter | null
): Promise<void> {
	const validContainers = [
		"p",
		"div",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"li",
		"table",
	];
	const highlightedContainers = scanPageForHighlights(validContainers);

	if (highlightedContainers.length === 0) {
		const slug = getSlug();
		console.log(`[highlight] Deleting highlights for slug: ${slug}`);
		await fetch("/api/highlights/delete", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug }),
		});
		return;
	}

	// Build highlight segments
	const highlightSegments: { [key: string]: any } = {};
	highlightedContainers.forEach(({ containerIndex, container, order }) => {
		const highlightText = extractHighlightedText(container);
		if (highlightText) {
			highlightSegments[containerIndex] = {
				containerHTML: container.outerHTML,
				highlightText,
				domPath: getDomPath(container),
				order,
			};
		}
	});

	const slug = getSlug();
	const highlight = {
		slug,
		title: document.getElementById("highlight-root")?.dataset.title || "",
		description:
			document.getElementById("highlight-root")?.dataset.description ||
			"",
		rangyHash,
		highlightSegments,
		updatedAt: new Date(),
	};

	try {
		console.log(`[highlight] Adding highlights for slug: ${slug}`);
		const response = await fetch("/api/highlights/add", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				slug,
				highlights: highlight,
			}),
		});
		const data = await response.json();
		if (data.error) {
			console.error("Server reported error:", data.error);
		}
	} catch (error) {
		console.error("Error persisting highlights:", error);
	}
}

export async function fetchHighlights(
	highlighter: Highlighter | null
): Promise<void> {
	try {
		const slug = getSlug();
		console.log(`[highlight] Fetching highlights for slug: ${slug}`);

		const response = await fetch(
			`/api/highlights/get?slug=${encodeURIComponent(slug)}`
		);
		const data = await response.json();
		console.log(`[highlight] Received data:`, {
			hasData: !!data,
			hasRangyHash: !!data.highlights?.rangyHash,
			highlighterReady: !!highlighter,
		});

		if (data.highlights?.rangyHash && highlighter) {
			console.log(`[highlight] Deserializing highlights`);
			highlighter.deserialize(data.highlights.rangyHash);
		}
	} catch (error) {
		console.error("[highlight] Error fetching highlights:", error);
	}
}
function extractHighlightedText(container: Element): string {
	const parser = new DOMParser();
	const doc = parser.parseFromString(container.outerHTML, "text/html");
	const containerEl = doc.body.firstElementChild;
	if (!containerEl) return "";

	const highlights = getHighlightInfo(containerEl);
	return formatHighlightSegments(highlights);
}

function getHighlightInfo(containerEl: Element): HighlightInfo[] {
	const highlights: HighlightInfo[] = [];
	containerEl.querySelectorAll("mark").forEach((mark, index) => {
		const color = Array.from(mark.classList)
			.find((cls) => cls.startsWith("highlight-"))
			?.replace("highlight-", "");
		if (color) {
			highlights.push({
				text: mark.textContent || "",
				color,
				index,
			});
		}
	});
	return highlights;
}

function formatHighlightSegments(highlights: HighlightInfo[]): string {
	if (highlights.length === 0) return "";

	const segments: string[] = [];
	let currentGroup = [highlights[0]];

	for (let i = 1; i < highlights.length; i++) {
		const current = highlights[i];
		const prev = highlights[i - 1];

		if (current.color === prev.color && current.index === prev.index + 1) {
			currentGroup.push(current);
		} else {
			segments.push(currentGroup.map((h) => h.text).join(" "));
			currentGroup = [current];
		}
	}
	segments.push(currentGroup.map((h) => h.text).join(" "));

	return segments.join(" ... ");
}

function getSlug(): string {
	const url = new URL(window.location.href);
	const basePath = url.pathname;
	const pliParam = url.searchParams.get("pli");
	const layoutParam = url.searchParams.get("layout");
	const params = new URLSearchParams();
	if (pliParam) params.append("pli", "true");
	if (layoutParam) {
		params.append("layout", layoutParam);
	} else if (pliParam) {
		params.append("layout", "interleaved");
	}
	const queryString = params.toString();
	return queryString ? `${basePath}?${queryString}` : basePath;
}
