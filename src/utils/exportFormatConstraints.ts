import type { PdfExportContentOptions, PdfVizImageMode } from "./pdfRenderer";

export type ExportFormat = "pdf" | "epub";

export type PdfImageMode = "none" | "svgPrimaryOnly" | "svgAll";

/** EPUB paper profile; not offered on PDF (thermal stays printer-only). */
export type EpubVizImageMode = "light" | "dark" | "eink";

export type ExportVizImageMode = PdfVizImageMode | "eink";

export type PdfExportParams = {
	downloadDate: string;
	imageMode: PdfImageMode;
	vizImageMode: ExportVizImageMode | undefined;
	pdfContentOptions: PdfExportContentOptions;
};

/** Thermal is a printer profile; EPUB keeps light, dark, or e-ink. */
export function epubVizImageMode(
	mode: ExportVizImageMode | undefined,
): EpubVizImageMode | undefined {
	if (mode === "light" || mode === "dark" || mode === "eink") return mode;
	if (mode === "thermal") return "eink";
	return undefined;
}

/** PDF has no e-ink CSS; treat it as light paper. */
export function pdfVizImageMode(
	mode: ExportVizImageMode | undefined,
): PdfVizImageMode | undefined {
	if (mode === "eink") return "light";
	return mode;
}

/** EPUB: keep diagrams intact (not PDF-sliced); force interleaved Pāli. */
export function applyFormatConstraints(
	format: ExportFormat,
	params: PdfExportParams,
): PdfExportParams {
	if (format !== "epub") {
		if (params.vizImageMode !== "eink") return params;
		return { ...params, vizImageMode: "light" };
	}
	const pali = params.pdfContentOptions.paliOptions;
	return {
		...params,
		vizImageMode: epubVizImageMode(params.vizImageMode),
		pdfContentOptions: {
			includeKeyTermsSection:
				params.pdfContentOptions.includeKeyTermsSection,
			keepSvgIntact: true,
			paliOptions: pali?.enabled
				? { enabled: true, layout: "interleaved" }
				: undefined,
		},
	};
}
