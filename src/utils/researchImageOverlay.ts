import type { ResearchContextImage } from "./aiAskComposition";

const MIME_EXTENSIONS: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
};

export function researchContextImageDataUrl(
	image: Pick<ResearchContextImage, "mime" | "data">,
): string {
	return `data:${image.mime};base64,${image.data}`;
}

export function researchContextImageFilename(
	image: Pick<ResearchContextImage, "mime">,
	index = 0,
): string {
	const ext = MIME_EXTENSIONS[image.mime] || "png";
	return `research-image-${index + 1}.${ext}`;
}

export const IMAGE_OVERLAY_ZOOM_MIN = 1;
export const IMAGE_OVERLAY_ZOOM_MAX = 4;
export const IMAGE_OVERLAY_ZOOM_STEP = 1.25;

export function stepImageOverlayZoom(
	current: number,
	direction: "in" | "out",
): number {
	const round = (value: number): number =>
		Math.round(value * 1000) / 1000;
	if (direction === "in") {
		return Math.min(
			IMAGE_OVERLAY_ZOOM_MAX,
			round(current * IMAGE_OVERLAY_ZOOM_STEP),
		);
	}
	return Math.max(
		IMAGE_OVERLAY_ZOOM_MIN,
		round(current / IMAGE_OVERLAY_ZOOM_STEP),
	);
}

let activeOverlay: HTMLElement | null = null;
let activeKeydown: ((event: KeyboardEvent) => void) | null = null;
let activeResize: (() => void) | null = null;

function removeActiveOverlay(): void {
	if (activeKeydown) {
		document.removeEventListener("keydown", activeKeydown);
		activeKeydown = null;
	}
	if (activeResize) {
		window.removeEventListener("resize", activeResize);
		activeResize = null;
	}
	activeOverlay?.remove();
	activeOverlay = null;
	document.documentElement.classList.remove("ai-image-overlay-open");
}

async function copyImageDataUrl(dataUrl: string, mime: string): Promise<boolean> {
	if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
		return false;
	}
	try {
		const blob = await fetch(dataUrl).then((response) => response.blob());
		await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
		return true;
	} catch {
		return false;
	}
}

function downloadImageDataUrl(dataUrl: string, filename: string): void {
	const link = document.createElement("a");
	link.href = dataUrl;
	link.download = filename;
	link.rel = "noopener";
	document.body.append(link);
	link.click();
	link.remove();
}

const ZOOM_OUT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM13.5 10.5h-6"/></svg>`;
const ZOOM_IN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6"/></svg>`;
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" aria-hidden="true"><rect x="8.25" y="8.25" width="11.5" height="11.5" rx="1.5"/><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 15.75H5.25a1.5 1.5 0 0 1-1.5-1.5V5.25A1.5 1.5 0 0 1 5.25 3.75h9a1.5 1.5 0 0 1 1.5 1.5V6.75"/></svg>`;
const DOWNLOAD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 11.25 12 15.75m0 0 4.5-4.5M12 15.75V3"/></svg>`;
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>`;

export function openResearchImageOverlay(
	image: ResearchContextImage,
	options?: { filename?: string; alt?: string },
): void {
	if (typeof document === "undefined") return;
	removeActiveOverlay();

	const dataUrl = researchContextImageDataUrl(image);
	const filename =
		options?.filename?.trim() ||
		researchContextImageFilename(image);
	const alt = options?.alt?.trim() || filename;

	const overlay = document.createElement("div");
	overlay.className = "ai-image-overlay";
	overlay.setAttribute("role", "dialog");
	overlay.setAttribute("aria-modal", "true");
	overlay.setAttribute("aria-label", "Image preview");
	const toolbar = document.createElement("div");
	toolbar.className = "ai-image-overlay-toolbar";
	toolbar.innerHTML = `
		<button type="button" class="ai-image-overlay-btn" data-ai-image-zoom-out title="Zoom out" aria-label="Zoom out">${ZOOM_OUT_ICON}</button>
		<button type="button" class="ai-image-overlay-btn" data-ai-image-zoom-in title="Zoom in" aria-label="Zoom in">${ZOOM_IN_ICON}</button>
		<button type="button" class="ai-image-overlay-btn" data-ai-image-copy title="Copy image" aria-label="Copy image">${COPY_ICON}</button>
		<button type="button" class="ai-image-overlay-btn" data-ai-image-download title="Download image" aria-label="Download image">${DOWNLOAD_ICON}</button>
		<button type="button" class="ai-image-overlay-btn" data-ai-image-close title="Close" aria-label="Close">${CLOSE_ICON}</button>
	`;
	const stage = document.createElement("div");
	stage.className = "ai-image-overlay-stage";
	const img = document.createElement("img");
	img.className = "ai-image-overlay-img";
	img.src = dataUrl;
	img.alt = alt;
	img.draggable = false;
	stage.append(img);
	overlay.append(toolbar, stage);

	let zoom = IMAGE_OVERLAY_ZOOM_MIN;
	let baseWidth = 0;
	let baseHeight = 0;
	const zoomOutBtn = overlay.querySelector(
		"[data-ai-image-zoom-out]",
	) as HTMLButtonElement | null;
	const zoomInBtn = overlay.querySelector(
		"[data-ai-image-zoom-in]",
	) as HTMLButtonElement | null;

	const syncZoomButtons = (): void => {
		if (zoomOutBtn) zoomOutBtn.disabled = zoom <= IMAGE_OVERLAY_ZOOM_MIN;
		if (zoomInBtn) zoomInBtn.disabled = zoom >= IMAGE_OVERLAY_ZOOM_MAX;
	};

	const computeBaseFit = (): void => {
		const naturalWidth = img.naturalWidth || 1;
		const naturalHeight = img.naturalHeight || 1;
		const maxW = Math.max(stage.clientWidth, 1);
		const maxH = Math.max(stage.clientHeight, 1);
		const fit = Math.min(maxW / naturalWidth, maxH / naturalHeight, 1);
		baseWidth = naturalWidth * fit;
		baseHeight = naturalHeight * fit;
	};

	const applyZoom = (): void => {
		img.style.width = `${baseWidth * zoom}px`;
		img.style.height = `${baseHeight * zoom}px`;
		syncZoomButtons();
	};

	const setZoom = (next: number): void => {
		zoom = Math.min(
			IMAGE_OVERLAY_ZOOM_MAX,
			Math.max(IMAGE_OVERLAY_ZOOM_MIN, next),
		);
		applyZoom();
	};

	const measureAndFit = (): void => {
		computeBaseFit();
		applyZoom();
	};

	const layoutImage = (): void => {
		if (img.naturalWidth <= 0) return;
		measureAndFit();
	};

	const close = (): void => {
		removeActiveOverlay();
	};

	overlay.querySelector("[data-ai-image-close]")?.addEventListener("click", close);
	overlay.addEventListener("click", (event) => {
		if (event.target === overlay) close();
	});
	stage.addEventListener("click", (event) => {
		event.stopPropagation();
	});

	zoomOutBtn?.addEventListener("click", () => {
		setZoom(stepImageOverlayZoom(zoom, "out"));
	});
	zoomInBtn?.addEventListener("click", () => {
		setZoom(stepImageOverlayZoom(zoom, "in"));
	});

	const copyBtn = overlay.querySelector(
		"[data-ai-image-copy]",
	) as HTMLButtonElement | null;
	copyBtn?.addEventListener("click", () => {
		void copyImageDataUrl(dataUrl, image.mime).then((ok) => {
			if (!copyBtn) return;
			copyBtn.title = ok ? "Copied" : "Copy failed";
			copyBtn.setAttribute("aria-label", copyBtn.title);
			window.setTimeout(() => {
				if (!copyBtn.isConnected) return;
				copyBtn.title = "Copy image";
				copyBtn.setAttribute("aria-label", "Copy image");
			}, 1600);
		});
	});

	overlay
		.querySelector("[data-ai-image-download]")
		?.addEventListener("click", () => {
			downloadImageDataUrl(dataUrl, filename);
		});

	activeKeydown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			close();
			return;
		}
		if (event.key === "+" || event.key === "=") {
			event.preventDefault();
			setZoom(stepImageOverlayZoom(zoom, "in"));
			return;
		}
		if (event.key === "-" || event.key === "_") {
			event.preventDefault();
			setZoom(stepImageOverlayZoom(zoom, "out"));
		}
	};
	document.addEventListener("keydown", activeKeydown);

	document.body.append(overlay);
	activeOverlay = overlay;
	document.documentElement.classList.add("ai-image-overlay-open");

	const onResize = (): void => {
		if (!activeOverlay) return;
		layoutImage();
	};
	activeResize = onResize;
	window.addEventListener("resize", onResize);

	if (img.complete) requestAnimationFrame(layoutImage);
	else {
		img.addEventListener("load", () => requestAnimationFrame(layoutImage), {
			once: true,
		});
	}
}

export function closeResearchImageOverlay(): void {
	removeActiveOverlay();
}
