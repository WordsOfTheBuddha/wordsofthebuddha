/**
 * Client-side discourse filtering for topic/quality `/on/{slug}` pages.
 * Flat / sectioned lists only — no collection vagga/book grouping.
 */

export function normalizeFilterText(value: string | undefined | null): string {
	return (
		value
			?.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "") || ""
	);
}

export function postMatchesFilter(post: Element, filter: string): boolean {
	const aTag = post.querySelector("a");
	const hrefValue = aTag?.getAttribute("href")?.toLowerCase() || "";
	const content = normalizeFilterText(post.textContent);
	const combinedContent = `${hrefValue} ${content}`;
	return !filter || combinedContent.includes(filter);
}

export function applyOnPageDiscourseFilter(
	discoursesGrid: HTMLElement | null,
	filter: string,
): void {
	if (!discoursesGrid) return;

	const sections = discoursesGrid.querySelectorAll(".on-discourse-section");
	if (sections.length) {
		discoursesGrid.querySelectorAll(".post-item").forEach((post) => {
			post.classList.toggle("hidden", !postMatchesFilter(post, filter));
		});

		sections.forEach((section) => {
			const posts = section.querySelectorAll(".post-item");
			const anyPostVisible = [...posts].some(
				(post) => !post.classList.contains("hidden"),
			);
			section.classList.toggle("hidden", !!filter && !anyPostVisible);
		});
		return;
	}

	discoursesGrid.querySelectorAll(".post-item").forEach((post) => {
		post.classList.toggle("hidden", !postMatchesFilter(post, filter));
	});
}

export function initOnPageDiscourseFilter(options?: {
	gridId?: string;
	filterInputId?: string;
	onAfterFilter?: () => void;
}): {
	applyFilter: (filter: string) => void;
	getActiveFilter: () => string;
} {
	const gridId = options?.gridId ?? "discourses-grid";
	const filterInputId = options?.filterInputId ?? "client-filter";
	const discoursesGrid = document.getElementById(gridId) as HTMLElement | null;

	const applyFilter = (filter: string) => {
		applyOnPageDiscourseFilter(discoursesGrid, filter);
		options?.onAfterFilter?.();
	};

	const getActiveFilter = () => {
		const input = document.getElementById(filterInputId) as
			| HTMLInputElement
			| null;
		return normalizeFilterText(input?.value);
	};

	const input = document.getElementById(filterInputId) as
		| HTMLInputElement
		| null;
	input?.addEventListener("input", (e) => {
		const target = e.target as HTMLInputElement;
		applyFilter(normalizeFilterText(target.value));
	});

	return { applyFilter, getActiveFilter };
}
