import type { PdfExportContentOptions, PdfVizImageMode } from "./pdfRenderer";

export type ExportFormat = "pdf" | "epub";

export type PdfImageMode = "none" | "svgPrimaryOnly" | "svgAll";

export type PdfExportParams = {
	downloadDate: string;
	imageMode: PdfImageMode;
	vizImageMode: PdfVizImageMode | undefined;
	pdfContentOptions: PdfExportContentOptions;
};

/** EPUB never includes discourse diagrams, regardless of client query/body. */
export function applyFormatConstraints(
	format: ExportFormat,
	params: PdfExportParams,
): PdfExportParams {
	if (format !== "epub") return params;
	const pali = params.pdfContentOptions.paliOptions;
	return {
		...params,
		imageMode: "none",
		vizImageMode: undefined,
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
