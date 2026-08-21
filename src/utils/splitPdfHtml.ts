/**
 * Collection PDF split layout: one row per English/Pāli pair.
 *
 * Isolated from pdfRenderer so unit tests do not load Astro modules.
 */

import { formatBlock, type ContentPair } from "./contentParser";

export type SplitPdfHtmlRenderer = (markdown: string) => string;

function pairRow(
	enHtml: string,
	piHtml: string,
	extraClass = "",
): string {
	const cls = extraClass
		? `pdf-poly-row ${extraClass}`
		: "pdf-poly-row";
	return `<div class="${cls}">
  <div class="pdf-poly-cell pdf-poly-en">${enHtml}</div>
  <div class="pdf-poly-cell pdf-poly-pi">${piHtml}</div>
</div>`;
}

/**
 * Split layout: one grid row per content pair so English and Pāli stay aligned
 * (same logical pairing as `data-pair-id` in MDContent — not two independent columns).
 */
export function buildSplitPdfHtmlFromPairs(
	pairs: ContentPair[],
	renderHtml: SplitPdfHtmlRenderer = (markdown) => markdown,
): string {
	let pairIndex = 0;
	const rows: string[] = [];

	for (const pair of pairs) {
		if (pair.type === "other") {
			rows.push(
				`<div class="pdf-poly-row pdf-poly-row-full"><div class="pdf-poly-full">${pair.english}</div></div>`,
			);
			continue;
		}

		if (pair.english.startsWith("#")) {
			const enRaw = formatBlock(
				pair.english,
				false,
				undefined,
				undefined,
				pair.actualParagraphNumber,
			);
			const piRaw = pair.pali
				? formatBlock(
						pair.pali,
						true,
						undefined,
						undefined,
						pair.actualParagraphNumber,
					)
				: "";
			rows.push(
				pairRow(
					renderHtml(enRaw),
					piRaw
						? renderHtml(piRaw)
						: '<div class="pdf-poly-cell-empty"></div>',
					"pdf-poly-row-heading",
				),
			);
			continue;
		}

		const idx = pairIndex++;
		const enRaw = formatBlock(
			pair.english,
			false,
			idx,
			undefined,
			pair.actualParagraphNumber,
		);
		const piRaw =
			pair.pali !== undefined
				? formatBlock(
						pair.pali,
						true,
						idx,
						undefined,
						pair.actualParagraphNumber,
					)
				: "";

		rows.push(
			pairRow(
				renderHtml(enRaw),
				piRaw
					? renderHtml(piRaw)
					: '<div class="pdf-poly-cell-empty"></div>',
			),
		);
	}

	return `<div class="pdf-poly-split">${rows.join("\n")}</div>`;
}
