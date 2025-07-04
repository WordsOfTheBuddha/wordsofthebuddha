import type { UnifiedContentItem } from "../types/discover";

export class DiscoverRenderer {
    constructor(
        private expandedItems: Set<string>,
        private toggleExpanded: (itemId: string) => void
    ) { }

    renderResults(filteredData: UnifiedContentItem[], resultsEl: HTMLElement | null): void {
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

    private renderItem(item: UnifiedContentItem): string {
        const isExpanded = this.expandedItems.has(item.id);
        const isSimile = item.type === "simile";
        const qualityType = item.qualityType;

        // Quality type indicators
        const qualityIndicator = qualityType
            ? {
                positive: {
                    emoji: "☀️",
                    text: "quality",
                    type: "bright",
                    class: "bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-100",
                },
                negative: {
                    emoji: "☁️",
                    text: "quality",
                    type: "dark",
                    class: "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-100",
                },
                neutral: {
                    emoji: "💠",
                    text: "quality",
                    type: "neutral",
                    class: "bg-cyan-200 dark:bg-cyan-500 text-cyan-800 dark:text-cyan-100",
                },
            }[qualityType]
            : null;

        // Topic type indicator
        const topicIndicator =
            item.type === "topic"
                ? `
                <span class="inline-block px-2 py-0.5 text-xs rounded-full cursor-help bg-blue-200 dark:bg-blue-500 text-gray-600 dark:text-gray-300 -translate-y-0.5"
                    title="A curated list of discourses on a theme of the Buddha's words.">
                    topic
                </span>
            `
                : "";

        return `
		<div class="post-item relative flex flex-col w-full p-5 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-md dark:shadow-[0_0_10px_rgba(255,255,255,0.1)] hover:shadow-lg dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-shadow duration-200">
			<div class="flex items-start justify-between mb-2">
				<div class="flex items-start flex-grow min-w-0">
					<span class="text-lg mt-1 mb-1">
						${isSimile
                ? `
							<span class="font-normal">${item.title}</span>
                            <span class="inline-block px-2 py-0.5 text-xs rounded-full cursor-help bg-purple-200 dark:bg-purple-500 text-gray-600 dark:text-gray-300 -translate-y-0.5" 
								  title="Metaphor or comparison used by the Buddha to illustrate a teaching concept">
								simile
							</span>
						`
                : `
							<span class="font-normal">${item.title}</span>
							${qualityIndicator
                    ? `
									<span class="inline-block px-2 py-0.5 text-xs rounded-full cursor-help ${qualityIndicator.class} -translate-y-0.5" 
										  title="${qualityIndicator.type === "bright"
                        ? "When a bright quality is cultivated, it brings benefit, clarity of vision, and the growth of wisdom."
                        : qualityIndicator.type === "dark"
                            ? "When a dark quality is maintained or not abandoned, it brings harm, obscured vision, and the decline of wisdom."
                            : "This quality can be either skillful or unskillful depending on how it is applied and the context in which it arises."
                    }">
										${qualityIndicator.text}
									</span>
								`
                    : topicIndicator
                }
						`
            }
					</h3>
				</div>
			</div>

			${!isSimile
                ? `
				<div class="mt-2 ml-2 space-y-2 text-sm">
					${item.description
                    ? `
						<div class="text-text">${item.description}</div>
					`
                    : ""
                }
					
					${item.synonyms && item.synonyms.length > 0
                    ? `
						<div class="text-gray-600 dark:text-gray-400 text-xs">
							Also known as: ${item.synonyms.join(", ")}
						</div>
					`
                    : ""
                }
					
					${item.pali && item.pali.length > 0
                    ? `
						<div class="pali-paragraph font-semibold text-text text-xs">
							Pāli: ${item.pali.join(", ")}
						</div>
					`
                    : ""
                }
				</div>
			`
                : `
				<!-- Simile Description (only when expanded) -->
				${item.description && isExpanded
                    ? `
					<div class="mt-2 ml-2 text-sm">
						<div class="text-text">${item.description}</div>
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

    private renderDiscourseList(item: UnifiedContentItem, isExpanded: boolean): string {
        const discoursesToShow = isExpanded ? item.discourses : item.discourses.slice(0, 3);
        const showDescriptions = isExpanded;

        const scrollContainer = isExpanded
            ? `style="max-height: 50vh; overflow-y: auto; position: relative;"`
            : "";

        return `
		<div class="discourse-list" ${scrollContainer}>
			<div class="space-y-3 border-l-2 border-[var(--primary-color)] border-opacity-30 py-1">
				${discoursesToShow
                .map((discourse) => this.renderSingleDiscourse(discourse, showDescriptions, item.type))
                .join("")}
			</div>
			
			${isExpanded ? this.renderStickyCollapseButton(item.id) : ""}
		</div>
	`;
    }

    private renderSingleDiscourse(discourse: any, showDescription: boolean, contentType: string): string {
        return `
		<div class="text-sm dark:bg-gray-800 rounded-lg px-2 mt-1 w-[fit-content]">
			<a href="/${discourse.id}" class="text-[var(--link-color)] hover:text-[var(--link-hover-color)] font-medium inline-block mb-1">
				${discourse.id.replace(
            /([a-zA-Z]+)(\d+)/,
            (_: string, chars: string, digits: string) => {
                return `${chars.toUpperCase()} ${digits}`;
            }
        )}
            </a>
            <span>
                ${discourse.title}
            </span>
			${discourse.note
                ? `
				<div class="mb-2 inline-block ml-1">
					<span class="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">
						${discourse.note}
					</span>
				</div>
			`
                : ""
            }
			${showDescription && discourse.description
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
            <button onclick="toggleExpanded('${slug}')" class="flex items-center gap-2 text-sm text-[var(--primary-color)] hover:text-[var(--link-hover-color)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-opacity-50 rounded bg-white dark:bg-gray-800 px-1 py-1 mb-2 ml-1">
                [- Show Less]
            </button>
        </div>
    `;
    }

    private getConsistentButtonText(discourseCount: number, isExpanded: boolean): string {
        if (isExpanded) {
            return "[- Show Less]";
        }

        return discourseCount <= 3
            ? "[+ Show More]"
            : `[+ ${discourseCount - 3} ${discourseCount - 3 === 1 ? "discourse" : "discourses"} - Show More]`;
    }
}
