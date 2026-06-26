import {
	parseContent,
	createCombinedMarkdown,
	compareHierarchicalNumber,
	constructHierarchicalEnd,
	isValidParagraphRange,
	isViewFullTextFallbackOnly,
	debug,
} from "./contentParser";
import { getEnglishEntry, getPaliEntry } from "./getContentEntry";
import { getLastModified } from "./getLastModified";
import { routes } from "./routes";
import { transformId } from "./transformId";
import { findContentImages } from "./contentImage";
import { buildReferenceDiscoursePage } from "./referenceDiscoursePage";

export type CatchAllDiscoursePage = {
	suttaProps: Record<string, unknown>;
	mainContent: string;
	splitEnglish?: string;
	splitPali?: string;
	refPaliOnlyContent?: string;
	referenceFallbackPage: boolean;
};

type RedirectFn = (url: string) => Response;

/** Resolve partial discourse, paragraph, and reference URLs for SSR catch-all routes. */
export async function resolveCatchAllDiscoursePage(
	originalId: string | undefined,
	redirect: RedirectFn,
): Promise<CatchAllDiscoursePage | Response> {
	let id = originalId || "";

	let suttaProps: Record<string, unknown> | undefined;
	let mainContent = "";
	let splitEnglish: string | undefined;
	let splitPali: string | undefined;
	let refPaliOnlyContent: string | undefined;
	let referenceFallbackPage = false;

	let currentIndex = routes.findIndex((route) => route === id);
	let sectionNumber: string | undefined;
	let fullRef: string | undefined;
	let paragraphRequest: {
		type: "single" | "range";
		start: number;
		end?: number;
	} | null = null;
	let discourseRange: { start: string; end: string } | null = null;

	if (currentIndex === -1) {
		debug(`Full ID parsing for: ${id}`);

		const paragraphRangeMatch = id.match(/^(.+)\.(\d+(?:-\d+)?)$/);
		if (paragraphRangeMatch) {
			const [, baseId, paragraphPart] = paragraphRangeMatch;
			debug(
				`Detected potential paragraph range - baseId: ${baseId}, paragraphPart: ${paragraphPart}`,
			);

			const baseContent = await getEnglishEntry(baseId);
			if (baseContent) {
				debug(
					`Found baseContent for ${baseId} - treating as paragraph range`,
				);
				if (paragraphPart.includes("-")) {
					const [start, end] = paragraphPart.split("-").map(Number);
					if (isValidParagraphRange(start, end)) {
						paragraphRequest = { type: "range", start, end };
						id = baseId;
						currentIndex = routes.findIndex((route) => route === baseId);
						fullRef = transformId(baseId);
					}
				} else {
					const paragraphNum = Number(paragraphPart);
					if (!isNaN(paragraphNum)) {
						paragraphRequest = {
							type: "single",
							start: paragraphNum,
						};
						id = baseId;
						currentIndex = routes.findIndex((route) => route === baseId);
						fullRef = transformId(baseId);
					}
				}
			}
		}

		if (currentIndex === -1) {
			debug(`No paragraph range match, trying discourse range logic`);
			const idParseMatch = id.match(/^([a-z]+)(\d+(?:\.\d+)?(?:-\d+)?)/);
			if (idParseMatch) {
				const [, prefix, numericPart] = idParseMatch;

				if (numericPart.includes("-")) {
					const [startStr, endStr] = numericPart.split("-");
					const constructedTargetEnd = constructHierarchicalEnd(
						startStr,
						endStr,
					);

					const parentRoute = routes.find((route) => {
						if (!route.startsWith(prefix)) return false;

						const rangeMatch = route.match(
							/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/,
						);
						if (!rangeMatch) return false;

						const [, rangeStart, rangeEnd] = rangeMatch;
						const properRangeEnd = constructHierarchicalEnd(
							rangeStart,
							rangeEnd,
						);

						return (
							compareHierarchicalNumber(startStr, rangeStart) >= 0 &&
							compareHierarchicalNumber(
								constructedTargetEnd,
								properRangeEnd,
							) <= 0
						);
					});

					if (parentRoute) {
						currentIndex = routes.findIndex(
							(route) => route === parentRoute,
						);
						id = parentRoute;
						fullRef = transformId(parentRoute);
						discourseRange = {
							start: startStr,
							end: constructHierarchicalEnd(startStr, endStr),
						};
					}
				} else {
					sectionNumber = numericPart;

					const parentRoute = routes.find((route) => {
						if (!route.startsWith(prefix)) return false;

						const rangeMatch = route.match(
							/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/,
						);
						if (!rangeMatch) return false;

						const [, rangeStart, rangeEnd] = rangeMatch;
						const properRangeEnd = constructHierarchicalEnd(
							rangeStart,
							rangeEnd,
						);

						return (
							compareHierarchicalNumber(numericPart, rangeStart) >=
								0 &&
							compareHierarchicalNumber(
								numericPart,
								properRangeEnd,
							) <= 0
						);
					});

					if (parentRoute) {
						currentIndex = routes.findIndex(
							(route) => route === parentRoute,
						);
						id = parentRoute;
						fullRef = transformId(parentRoute);
					}
				}
			}
		}
	}

	let servePublishedEnglish = currentIndex !== -1;

	if (currentIndex === -1) {
		const englishEntry = await getEnglishEntry(id);
		if (englishEntry) {
			servePublishedEnglish = true;
			currentIndex = routes.indexOf(id);
		} else {
			const paliParagraphEntry = await getPaliEntry(id);
			if (!paliParagraphEntry) {
				return redirect(`/search?q=${encodeURIComponent(id)}`);
			}

			const refPage = await buildReferenceDiscoursePage(id);
			if (!refPage) {
				return redirect(`/search?q=${encodeURIComponent(id)}`);
			}

			return {
				mainContent: refPage.mainContent,
				splitEnglish: refPage.splitEnglish,
				splitPali: refPage.splitPali,
				refPaliOnlyContent: refPage.refPaliOnlyContent,
				referenceFallbackPage: refPage.referenceFallbackPage,
				suttaProps: refPage.suttaProps,
			};
		}
	}

	if (!servePublishedEnglish) {
		return redirect(`/search?q=${encodeURIComponent(id)}`);
	}

	const contentItem = await getEnglishEntry(id);
	if (!contentItem) {
		return redirect(`/search?q=${encodeURIComponent(id)}`);
	}

	let paliContent = { body: "" } as { body: string };
	const paliEntry = await getPaliEntry(id);
	if (paliEntry) paliContent = paliEntry;

	const pairs = await parseContent(
		paliContent,
		contentItem,
		!paragraphRequest && !discourseRange ? sectionNumber : undefined,
		fullRef,
		paragraphRequest,
		discourseRange,
		originalId || id,
	);

	const interleavedContent = createCombinedMarkdown(
		pairs,
		true,
		"interleaved",
		paragraphRequest,
	);
	const splitContent = createCombinedMarkdown(
		pairs,
		true,
		"split",
		paragraphRequest,
	);

	if (typeof interleavedContent === "string") {
		mainContent = interleavedContent;
	}
	if (typeof splitContent !== "string") {
		splitEnglish = splitContent.english;
		splitPali = splitContent.pali;
	}

	const fpParts = (contentItem.filePath ?? "").split("/");
	const folder = fpParts[fpParts.length - 2] || "";
	const fp = folder ? `${folder}/${id}` : id;

	const nextIndex = currentIndex + 1;
	const prevIndex = currentIndex - 1;
	const next =
		currentIndex >= 0 && nextIndex < routes.length
			? await getEnglishEntry(routes[nextIndex])
			: null;
	const prev =
		currentIndex > 0 ? await getEnglishEntry(routes[prevIndex]) : null;

	const collectionPrefix = (id.match(/^[a-z]+/i)?.[0] || "").toLowerCase();
	let prevViz: { slug: string; title: string } | null = null;
	let nextViz: { slug: string; title: string } | null = null;

	if (collectionPrefix && currentIndex >= 0) {
		for (let i = currentIndex - 1; i >= 0; i--) {
			const candidateId = routes[i];
			const candidatePrefix = (
				candidateId.match(/^[a-z]+/i)?.[0] || ""
			).toLowerCase();
			if (candidatePrefix !== collectionPrefix) continue;

			const candidateEntry = await getEnglishEntry(candidateId);
			if (!candidateEntry) continue;

			const candidateImages = findContentImages(
				candidateId,
				{
					image: candidateEntry.data.image,
					imageCaption: candidateEntry.data.imageCaption,
				},
				candidateEntry.data.title,
			);

			if (candidateImages.length > 0) {
				prevViz = {
					slug: candidateId,
					title: candidateEntry.data.title || candidateId.toUpperCase(),
				};
				break;
			}
		}

		for (let i = currentIndex + 1; i < routes.length; i++) {
			const candidateId = routes[i];
			const candidatePrefix = (
				candidateId.match(/^[a-z]+/i)?.[0] || ""
			).toLowerCase();
			if (candidatePrefix !== collectionPrefix) continue;

			const candidateEntry = await getEnglishEntry(candidateId);
			if (!candidateEntry) continue;

			const candidateImages = findContentImages(
				candidateId,
				{
					image: candidateEntry.data.image,
					imageCaption: candidateEntry.data.imageCaption,
				},
				candidateEntry.data.title,
			);

			if (candidateImages.length > 0) {
				nextViz = {
					slug: candidateId,
					title: candidateEntry.data.title || candidateId.toUpperCase(),
				};
				break;
			}
		}
	}

	const filePath = contentItem.filePath || "";
	const lastUpdated = getLastModified(filePath);

	const contentImages = findContentImages(
		id,
		{
			image: contentItem.data.image,
			imageCaption: contentItem.data.imageCaption,
		},
		contentItem.data.title,
	);
	const contentImage = contentImages.length > 0 ? contentImages : null;
	const subsetFallback = isViewFullTextFallbackOnly(mainContent);

	suttaProps = {
		fp,
		title: contentItem.data.title,
		description: contentItem.data.description,
		qualities: contentItem.data.qualities
			?.split(",")
			.map((tag: string) => tag.trim()),
		prev,
		next,
		id,
		showReadLater: !subsetFallback,
		showSave: !subsetFallback,
		showRead: !subsetFallback,
		lastUpdated,
		showAuth: true,
		showPali: !subsetFallback,
		paragraphRequest,
		discourseRange,
		commentary: contentItem.data.commentary,
		contentImage,
		vizPrev: prevViz,
		vizNext: nextViz,
	};

	return {
		suttaProps,
		mainContent,
		splitEnglish,
		splitPali,
		refPaliOnlyContent,
		referenceFallbackPage,
	};
}
