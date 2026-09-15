/** Zoom / pan controls for rendered Mermaid diagrams in research reports. */

export const DIAGRAM_ZOOM_STEP = 1.25;
export const DIAGRAM_MIN_ZOOM = 0.2;
export const DIAGRAM_MAX_ZOOM = 5;

const FULLSCREEN_BODY_CLASS = "ai-diagram-fullscreen-open";

type ViewerState = {
	root: HTMLElement;
	viewport: HTMLElement;
	scroll: HTMLElement;
	canvas: HTMLElement;
	svg: SVGSVGElement;
	naturalWidth: number;
	naturalHeight: number;
	scale: number;
	fitScale: number;
	fullscreen: boolean;
};

const viewers = new WeakMap<HTMLElement, ViewerState>();

const ICON_ZOOM_OUT =
	'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15ZM7.5 10.5h6"/></svg>';
const ICON_ZOOM_IN =
	'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15ZM10.5 7.5v6M7.5 10.5h6"/></svg>';
const ICON_FULLSCREEN =
	'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
const ICON_EXIT_FULLSCREEN =
	'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3H5a2 2 0 0 0-2 2v4m18-4V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4m10-6v6a2 2 0 0 0 2 2h4M15 3h4a2 2 0 0 1 2 2v4"/></svg>';

export function clampDiagramZoom(scale: number): number {
	return Math.min(DIAGRAM_MAX_ZOOM, Math.max(DIAGRAM_MIN_ZOOM, scale));
}

export function computeDiagramFitScale(
	naturalWidth: number,
	viewportWidth: number,
	padding = 16,
): number {
	if (naturalWidth <= 0 || viewportWidth <= 0) return 1;
	const inner = Math.max(1, viewportWidth - padding * 2);
	// Fit shrinks wide diagrams to the viewport; never upscale past 1:1.
	return clampDiagramZoom(Math.min(1, inner / naturalWidth));
}

export function readSvgNaturalSize(svg: SVGSVGElement): {
	width: number;
	height: number;
} {
	const viewBox = svg.viewBox?.baseVal;
	if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
		return { width: viewBox.width, height: viewBox.height };
	}
	const attrW = Number.parseFloat(svg.getAttribute("width") || "");
	const attrH = Number.parseFloat(svg.getAttribute("height") || "");
	if (attrW > 0 && attrH > 0) {
		return { width: attrW, height: attrH };
	}
	try {
		const box = svg.getBBox();
		if (box.width > 0 && box.height > 0) {
			return { width: box.width, height: box.height };
		}
	} catch {
		/* not in layout yet */
	}
	return { width: 800, height: 480 };
}

function toolbarButton(
	action: string,
	label: string,
	icon: string,
): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "ai-diagram-btn";
	btn.dataset.diagramAction = action;
	btn.setAttribute("aria-label", label);
	btn.title = label;
	btn.innerHTML = icon;
	return btn;
}

function applyView(state: ViewerState): void {
	const { canvas, scroll, naturalWidth, naturalHeight, scale } = state;
	canvas.style.width = `${naturalWidth}px`;
	canvas.style.height = `${naturalHeight}px`;
	canvas.style.transform = `scale(${scale})`;
	scroll.style.width = `${naturalWidth * scale}px`;
	scroll.style.height = `${naturalHeight * scale}px`;
}

function updateFitScale(state: ViewerState): number {
	const width = state.viewport.clientWidth || state.root.clientWidth;
	state.fitScale = computeDiagramFitScale(state.naturalWidth, width);
	return state.fitScale;
}

function setScale(state: ViewerState, scale: number): void {
	state.scale = clampDiagramZoom(scale);
	applyView(state);
}

function fitView(state: ViewerState): void {
	setScale(state, updateFitScale(state));
	state.viewport.scrollLeft = 0;
	state.viewport.scrollTop = 0;
}

function zoomBy(state: ViewerState, factor: number): void {
	const viewport = state.viewport;
	const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
	const centerY = viewport.scrollTop + viewport.clientHeight / 2;
	const prev = state.scale;
	const next = clampDiagramZoom(prev * factor);
	if (next === prev) return;
	const ratio = next / prev;
	setScale(state, next);
	viewport.scrollLeft = centerX * ratio - viewport.clientWidth / 2;
	viewport.scrollTop = centerY * ratio - viewport.clientHeight / 2;
}

function syncFullscreenButton(state: ViewerState): void {
	const btn = state.root.querySelector<HTMLButtonElement>(
		'[data-diagram-action="fullscreen"]',
	);
	if (!btn) return;
	const full = state.fullscreen;
	btn.innerHTML = full ? ICON_EXIT_FULLSCREEN : ICON_FULLSCREEN;
	const label = full ? "Exit fullscreen" : "Fullscreen";
	btn.setAttribute("aria-label", label);
	btn.title = label;
	btn.setAttribute("aria-pressed", full ? "true" : "false");
}

function setFullscreen(state: ViewerState, full: boolean): void {
	state.fullscreen = full;
	state.root.classList.toggle("is-fullscreen", full);
	document.body.classList.toggle(FULLSCREEN_BODY_CLASS, full);
	syncFullscreenButton(state);
	requestAnimationFrame(() => fitView(state));
}

function onToolbarClick(state: ViewerState, action: string): void {
	switch (action) {
		case "zoom-in":
			zoomBy(state, DIAGRAM_ZOOM_STEP);
			break;
		case "zoom-out":
			zoomBy(state, 1 / DIAGRAM_ZOOM_STEP);
			break;
		case "fullscreen":
			setFullscreen(state, !state.fullscreen);
			break;
	}
}

function attachViewer(diagram: HTMLElement, svg: SVGSVGElement): void {
	if (diagram.dataset.diagramViewer === "1") return;
	const { width, height } = readSvgNaturalSize(svg);

	const toolbar = document.createElement("div");
	toolbar.className = "ai-diagram-toolbar";
	toolbar.setAttribute("role", "toolbar");
	toolbar.setAttribute("aria-label", "Diagram view");
	toolbar.append(
		toolbarButton("zoom-out", "Zoom out", ICON_ZOOM_OUT),
		toolbarButton("zoom-in", "Zoom in", ICON_ZOOM_IN),
		toolbarButton("fullscreen", "Fullscreen", ICON_FULLSCREEN),
	);

	const viewport = document.createElement("div");
	viewport.className = "ai-diagram-viewport";
	viewport.tabIndex = 0;

	const scroll = document.createElement("div");
	scroll.className = "ai-diagram-scroll";

	const canvas = document.createElement("div");
	canvas.className = "ai-diagram-canvas";
	canvas.append(svg);

	scroll.append(canvas);
	viewport.append(scroll);
	diagram.replaceChildren(toolbar, viewport);

	diagram.classList.add("has-diagram-viewer");
	diagram.dataset.diagramViewer = "1";

	const state: ViewerState = {
		root: diagram,
		viewport,
		scroll,
		canvas,
		svg,
		naturalWidth: width,
		naturalHeight: height,
		scale: 1,
		fitScale: 1,
		fullscreen: false,
	};
	viewers.set(diagram, state);

	toolbar.addEventListener("click", (event) => {
		const btn = (event.target as Element | null)?.closest<HTMLButtonElement>(
			"[data-diagram-action]",
		);
		if (!btn) return;
		event.preventDefault();
		onToolbarClick(state, btn.dataset.diagramAction || "");
	});

	viewport.addEventListener(
		"wheel",
		(event) => {
			if (!event.ctrlKey && !event.metaKey) return;
			event.preventDefault();
			const factor = event.deltaY < 0 ? DIAGRAM_ZOOM_STEP : 1 / DIAGRAM_ZOOM_STEP;
			zoomBy(state, factor);
		},
		{ passive: false },
	);

	viewport.addEventListener("keydown", (event) => {
		if (event.key !== "Escape" || !state.fullscreen) return;
		event.preventDefault();
		setFullscreen(state, false);
	});

	if (typeof ResizeObserver !== "undefined") {
		const ro = new ResizeObserver(() => {
			const prevFit = state.fitScale;
			updateFitScale(state);
			if (Math.abs(state.scale - prevFit) < 0.02) {
				setScale(state, state.fitScale);
			}
		});
		ro.observe(viewport);
	}

	requestAnimationFrame(() => fitView(state));
}

/** Wrap rendered `.ai-report-diagram` blocks with zoom and fullscreen controls. */
export function enhanceResearchReportDiagrams(root: ParentNode): void {
	if (typeof document === "undefined") return;
	for (const diagram of root.querySelectorAll<HTMLElement>(
		".ai-report-diagram:not([data-diagram-viewer])",
	)) {
		const svg = diagram.querySelector("svg");
		if (!svg) continue;
		attachViewer(diagram, svg);
	}
}
