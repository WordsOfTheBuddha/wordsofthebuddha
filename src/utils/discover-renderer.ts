import type { UnifiedContentItem } from "../types/discover";
import {
	generateContentTagHtml,
	getContentTypeFromApiData,
} from "./ContentTagUtils";
import qualities from "../data/qualities.json";
import topicMappings from "../data/topicMappings.json";
import "../styles/topicTag.css";
import graphSvg from "../assets/graph.svg?raw";

// Ensure the inline SVG renders at the expected size
const graphIcon = graphSvg.replace("<svg", '<svg class="w-6 h-6"');

export class DiscoverRenderer {
	private highlightFn?: (text: string) => string;

	constructor(
		private expandedItems: Set<string>,
		private toggleExpanded: (itemId: string) => void,
		highlightFn?: (text: string) => string,
	) {
		this.highlightFn = highlightFn;
	}

	/**
	 * Helper to apply highlighting if function is provided
	 */
	private highlight(text: string): string {
		return this.highlightFn ? this.highlightFn(text) : text;
	}

	renderResults(
		filteredData: UnifiedContentItem[],
		resultsEl: HTMLElement | null,
	): void {
		if (!resultsEl) return;

		// Group by first letter
		const groupedData = new Map<string, UnifiedContentItem[]>();
		filteredData.forEach((item) => {
			const firstLetter = item.title.charAt(0).toUpperCase();
			if (!groupedData.has(firstLetter)) {
				groupedData.set(firstLetter, []);
			}
			groupedData.get(firstLetter)!.push(item);
		});

		const sortedLetters = Array.from(groupedData.keys()).sort();

		resultsEl.innerHTML = sortedLetters
			.map((letter) => {
				const items = groupedData.get(letter)!;
				return `
			<div id="letter-${letter}" class="mb-8 scroll-mt-32">
				<h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200 border-b pb-2">${letter}</h2>
				<div class="space-y-4">
					${items.map((item) => this.renderItem(item)).join("")}
				</div>
			</div>
		`;
			})
			.join("");
	}

	/**
	 * Render a single item card. Useful for search results.
	 */
	public renderSingleItem(item: UnifiedContentItem): string {
		return this.renderItem(item);
	}

	private renderItem(item: UnifiedContentItem): string {
		const isExpanded = this.expandedItems.has(item.id);

		// Get the content type and generate the tag HTML
		const contentType = getContentTypeFromApiData(item);

		// Determine if we should show dual tags
		let isTopic = item.type === "topic";
		if (!isTopic) {
			// Check if this slug is a synonym for any topic
			const slugLower = item.slug.toLowerCase();
			for (const [topicSlug, topicData] of Object.entries(
				topicMappings,
			)) {
				const tData = topicData as any;
				if (
					tData.synonyms &&
					tData.synonyms.some(
						(s: string) =>
							s.toLowerCase().replace(/\s+/g, "-") === slugLower,
					)
				) {
					isTopic = true;
					break;
				}
			}
		}

		const isQuality =
			item.type === "quality" ||
			qualities.positive.includes(item.slug) ||
			qualities.negative.includes(item.slug) ||
			qualities.neutral.includes(item.slug);

		let contentTagHtml = "";

		if (isTopic) {
			contentTagHtml += generateContentTagHtml("topic");
		}

		if (isQuality) {
			let qualityType = "neutral-quality";
			if (qualities.positive.includes(item.slug))
				qualityType = "bright-quality";
			else if (qualities.negative.includes(item.slug))
				qualityType = "negative-quality";

			contentTagHtml += generateContentTagHtml(qualityType as any);
		}

		if (!contentTagHtml) {
			contentTagHtml = generateContentTagHtml(contentType);
		}

		const itemUrl = `/on/${item.slug}`;

		return `
        <div class="post-item relative flex flex-col w-full p-5 rounded-lg border border-[color:var(--surface-border)] bg-[var(--surface-elevated)] text-[var(--surface-ink)] shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer" data-href="${itemUrl}">
			<div class="flex items-start justify-between mb-2">
				<div class="flex items-start flex-grow min-w-0">
					<h3 class="text-lg mt-1 mb-1 flex items-center gap-2 flex-wrap">
						<a href="${itemUrl}" class="font-normal hover:text-link-color">${this.highlight(item.title)}</a>
						${contentTagHtml}
					</h3>
				</div>
			</div>

            ${
				item.type !== "simile"
					? `
				<div class="mt-2 ml-2 space-y-2 text-sm">
					${
						item.description
							? `
						<div class="text-text">${this.highlight(item.description)}</div>
					`
							: ""
					}

					${
						item.synonyms && item.synonyms.length > 0
							? `
						<div class="text-gray-600 dark:text-gray-400 text-xs">
							Synonyms: ${this.highlight(item.synonyms.join(", "))}
						</div>
					`
							: ""
					}
					
                    ${
						item.pali && item.pali.length > 0
							? `
						<div class="pali-paragraph font-semibold text-text text-xs">
							Pāli: ${this.highlight(item.pali.join(", "))}
						</div>
					`
							: ""
					}

                    ${
						isExpanded
							? `
                        ${
							item.supportedBy?.length ||
							item.leadsTo?.length ||
							item.related?.length ||
							(item as any).opposite?.length
								? `
                        <div class="meta-grid text-xs text-gray-600 dark:text-gray-400 mt-2">
                            ${
								item.supportedBy?.length
									? `
                            <div class="meta-row">
                                <div class="soft meta-label">Supported by</div>
                                <div class="inline-tags">
                                    ${item.supportedBy
										.map((slug: string) => {
											const name = slug
												.split("-")
												.map(
													(w: string) =>
														w
															.charAt(0)
															.toUpperCase() +
														w.slice(1),
												)
												.join(" ");
											const isPositive =
												qualities.positive.includes(
													slug,
												);
											const isNegative =
												qualities.negative.includes(
													slug,
												);
											const tagClass = isPositive
												? "topic-tag positive"
												: isNegative
													? "topic-tag negative"
													: "topic-tag neutral";
											return `<a href="/on/${slug}" class="${tagClass}">${name}</a>`;
										})
										.join("")}
                                </div>
                            </div>`
									: ""
							}

                            ${
								item.leadsTo?.length
									? `
                            <div class="meta-row">
                                <div class="soft meta-label">Leads to</div>
                                <div class="inline-tags">
                                    ${item.leadsTo
										.map((slug: string) => {
											const name = slug
												.split("-")
												.map(
													(w: string) =>
														w
															.charAt(0)
															.toUpperCase() +
														w.slice(1),
												)
												.join(" ");
											const isPositive =
												qualities.positive.includes(
													slug,
												);
											const isNegative =
												qualities.negative.includes(
													slug,
												);
											const tagClass = isPositive
												? "topic-tag positive"
												: isNegative
													? "topic-tag negative"
													: "topic-tag neutral";
											return `<a href="/on/${slug}" class="${tagClass}">${name}</a>`;
										})
										.join("")}
                                </div>
                            </div>`
									: ""
							}

                            ${
								item.related?.length
									? `
                            <div class="meta-row">
                                <div class="soft meta-label">Related</div>
                                <div class="inline-tags">
                                    ${item.related
										.map((slug: string) => {
											const name = slug
												.split("-")
												.map(
													(w: string) =>
														w
															.charAt(0)
															.toUpperCase() +
														w.slice(1),
												)
												.join(" ");
											const isPositive =
												qualities.positive.includes(
													slug,
												);
											const isNegative =
												qualities.negative.includes(
													slug,
												);
											const tagClass = isPositive
												? "topic-tag positive"
												: isNegative
													? "topic-tag negative"
													: "topic-tag neutral";
											return `<a href="/on/${slug}" class="${tagClass}">${name}</a>`;
										})
										.join("")}
                                </div>
                            </div>`
									: ""
							}

                            ${
								(item as any).opposite?.length
									? `
                            <div class="meta-row">
                                <div class="soft meta-label">Opposite</div>
                                <div class="inline-tags">
                                    ${(item as any).opposite
										.map((slug: string) => {
											const name = slug
												.split("-")
												.map(
													(w: string) =>
														w
															.charAt(0)
															.toUpperCase() +
														w.slice(1),
												)
												.join(" ");
											const isPositive =
												qualities.positive.includes(
													slug,
												);
											const isNegative =
												qualities.negative.includes(
													slug,
												);
											const tagClass = isPositive
												? "topic-tag positive"
												: isNegative
													? "topic-tag negative"
													: "topic-tag neutral";
											return `<a href="/on/${slug}" class="${tagClass}">${name}</a>`;
										})
										.join("")}
                                </div>
                            </div>`
									: ""
							}
                        </div>
                        `
								: ""
						}

                        <div class="mt-2 text-xs flex items-center gap-2">
                            ${
								item.type === "topic" || item.type === "quality"
									? `
                            <a href="/explorer?focus=${encodeURIComponent(
								item.slug,
							)}&full=1" aria-label="View in explorer" title="View in explorer" class="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--background-color)] text-[var(--link-color)] hover:text-[var(--link-hover-color)] hover:border-[var(--primary-color)] transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] focus-visible:ring-opacity-50">
                                <span class="mt-1">${graphIcon}</span>
                                <span>View in explorer</span>
                            </a>
                            `
									: ""
							}
                        </div>

                    `
							: ""
					}
				</div>
			`
					: `
				<!-- Simile Description (only when expanded) -->
				${
					item.description && isExpanded
						? `
					<div class="mt-2 ml-2 text-sm">
						<div class="text-text">${this.highlight(item.description)}</div>
					</div>
				`
						: ""
				}
			`
			}

			<!-- Use consistent discourse section for all types -->
			${this.renderDiscourseSection(item)}
		</div>
	`;
	}

	private renderDiscourseSection(item: UnifiedContentItem): string {
		const isExpanded = this.expandedItems.has(item.id);
		const discourseCount = item.discourses.length;

		return `
		<div class="discourses-section mt-4">
			${this.renderDiscourseList(item, isExpanded)}
			${!isExpanded ? this.renderExpandButton(item.id, discourseCount) : ""}
		</div>
	`;
	}

	private renderDiscourseList(
		item: UnifiedContentItem,
		isExpanded: boolean,
	): string {
		const discoursesToShow = isExpanded
			? item.discourses
			: item.discourses.slice(0, 3);
		const showDescriptions = isExpanded;

		const scrollContainer = isExpanded
			? `style="max-height: 50vh; overflow-y: auto; position: relative;"`
			: "";

		return `
		<div class="discourse-list" ${scrollContainer}>
			<div class="space-y-3 border-l-2 border-[var(--primary-color)] border-opacity-30 py-1">
				${discoursesToShow
					.map((discourse) =>
						this.renderSingleDiscourse(
							discourse,
							showDescriptions,
							item.type,
						),
					)
					.join("")}
			</div>
			
			${isExpanded ? this.renderStickyCollapseButton(item.id) : ""}
		</div>
	`;
	}

	private renderSingleDiscourse(
		discourse: any,
		showDescription: boolean,
		contentType: string,
	): string {
		return `
		<div class="text-sm rounded-lg px-2 mt-1 w-[fit-content]">
			<a href="/${
				discourse.id
			}" class="text-[var(--link-color)] hover:text-[var(--link-hover-color)] font-medium inline-block mb-1">
				${discourse.id.replace(
					/([a-zA-Z]+)(\d+)/,
					(_: string, chars: string, digits: string) => {
						return `${chars.toUpperCase()} ${digits}`;
					},
				)}
            </a>
            <span>
                ${discourse.title}
            </span>
			${
				discourse.note
					? `
				<div class="mb-2 inline-block ml-1">
					<span class="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">
						${discourse.note}
					</span>
				</div>
			`
					: ""
			}
			${
				showDescription && discourse.description
					? `<p class="text-gray-600 dark:text-gray-400 text-xs leading-relaxed my-1">${discourse.description}</p>`
					: ""
			}
		</div>
	`;
	}

	private renderExpandButton(itemId: string, discourseCount: number): string {
		const buttonText = this.getConsistentButtonText(discourseCount, false);

		return `
		<button 
			onclick="toggleExpanded('${itemId}')" 
			class="flex items-center gap-2 text-sm text-[var(--primary-color)] hover:text-[var(--link-hover-color)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-opacity-50 rounded mt-3 ml-1"
		>
			${buttonText}
		</button>
	`;
	}

	private renderStickyCollapseButton(slug: string): string {
		return `
		<div style="position: sticky; bottom: 0; padding-top: 20px; text-align: left;">
			<button onclick="toggleExpanded('${slug}')" class="flex items-center gap-2 text-sm text-[var(--primary-color)] hover:text-[var(--link-hover-color)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-opacity-50 rounded border border-[color:var(--surface-border)] bg-[var(--surface-elevated)] px-2 py-1 mb-2 ml-1">
				[- Show Less]
			</button>
		</div>
	`;
	}

	private getConsistentButtonText(
		discourseCount: number,
		isExpanded: boolean,
	): string {
		if (isExpanded) {
			return "[- Show Less]";
		}

		return discourseCount <= 3
			? "[+ Show More]"
			: `[+ ${discourseCount - 3} ${
					discourseCount - 3 === 1 ? "discourse" : "discourses"
				} - Show More]`;
	}
}
