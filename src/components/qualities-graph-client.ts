// @ts-nocheck
import cytoscape from "cytoscape";
import { buildGraphFromQualities, slugify } from "../utils/qualitiesGraph";
import { generateContentTagHtml } from "../utils/ContentTagUtils";
// Discourse cards are rendered as raw HTML matching PostCard styles

const RAW = JSON.parse(document.getElementById("qualities-json")!.textContent!);
const TOPICS = JSON.parse(
	document.getElementById("topics-json")?.textContent || "{}"
);
const built = buildGraphFromQualities(RAW, TOPICS);

// Layout tuning knobs
const BASE_LAYOUT = {
	idealEdgeLength: 220,
	nodeRepulsion: 80000,
	gravity: 1.0,
} as const;
const FOCUS_LAYOUT = {
	minNodeSpacing: 18,
	spacingFactor: 1.15,
	animMs: 380,
	padding: 44,
} as const;
const DEFAULT_FOCUS_DEPTH = 1;

const cy = cytoscape({
	container: document.getElementById("cy")!,
	elements: { nodes: built.nodes, edges: built.edges },
	style: [
		// Enable manual z-index ordering for edges; baseline above dim (set in aux styles)
		{
			selector: "edge",
			style: { "z-index-compare": "manual", "z-index": 2 },
		},
		{
			selector: "node",
			style: {
				"background-color": (el) =>
					el.data("polarity") === "positive"
						? "#10b981"
						: el.data("polarity") === "negative"
						? "#ef4444"
						: el.data("polarity") === "topic"
						? "#f59e0b"
						: "#6366f1",
				label: "data(label)",
				"font-size": 15,
				"text-wrap": "wrap",
				"text-max-width": 260,
				"text-valign": "center",
				color: "#111827",
				width: 36,
				height: 36,
				"text-outline-width": 2,
				"text-outline-color": "#ffffff",
				// Make node z-index controllable so focus ring can float above dimmed
				"z-index-compare": "manual",
				"z-index": 2,
			},
		},
		{
			selector:
				"edge[type = 'supportedBy'][?dir], edge[type = 'leadsTo'][?dir], edge[type = 'guardedBy'][?dir]",
			style: {
				"curve-style": "bezier",
				width: 1.4,
				"line-color": (e) =>
					e.data("type") === "supportedBy"
						? "#059669"
						: e.data("type") === "leadsTo"
						? "#2563eb"
						: "#7c3aed",
				"target-arrow-shape": "triangle",
				"target-arrow-color": (e) =>
					e.data("type") === "supportedBy"
						? "#059669"
						: e.data("type") === "leadsTo"
						? "#2563eb"
						: "#7c3aed",
				"arrow-scale": 0.8,
				opacity: 0.9,
			},
		},
		// Perspective overrides for edges adjacent to the focused node
		{
			selector:
				"edge.from-focus[type = 'supportedBy'], edge.from-focus[type = 'leadsTo'], edge.from-focus[type = 'guardedBy']",
			style: {
				"line-color": "#2563eb",
				"target-arrow-color": "#2563eb",
				"z-index": 1000,
			},
		},
		{
			selector:
				"edge.to-focus[type = 'supportedBy'], edge.to-focus[type = 'leadsTo'], edge.to-focus[type = 'guardedBy']",
			style: {
				"line-color": "#059669",
				"target-arrow-color": "#059669",
				"z-index": 1000,
			},
		},
		{
			selector: "edge[type = 'related'], edge[type = 'opposite']",
			style: {
				"curve-style": "bezier",
				width: 1.0,
				"line-style": (e) =>
					e.data("type") === "related"
						? "solid"
						: e.data("type") === "opposite"
						? "dashed"
						: "solid",
				"line-color": (e) =>
					e.data("type") === "related" ? "#eab308" : "#ef4444",
				opacity: 0.6,
				"target-arrow-shape": "none",
			},
		},
		{ selector: ".hidden", style: { display: "none" } },
		{ selector: ".dimmed", style: { opacity: 0.15 } },
		{
			selector: ".highlight",
			style: { "border-width": 3, "border-color": "#111827" },
		},
	],
	// Increase spacing to reduce label collisions in the base layout
	layout: {
		name: "cose",
		animate: false,
		idealEdgeLength: BASE_LAYOUT.idealEdgeLength,
		nodeRepulsion: BASE_LAYOUT.nodeRepulsion,
		gravity: BASE_LAYOUT.gravity,
		nodeDimensionsIncludeLabels: true,
	},
	minZoom: 0.05,
	maxZoom: 4.0,
	wheelSensitivity: 0.22,
});

// Allow node dragging; keep a pointer cursor for discoverability
cy.ready(() => {
	const container = cy.container();
	if (container) {
		cy.on("mouseover", "node", () => {
			(container as HTMLElement).style.cursor = "pointer";
		});
		cy.on("mouseout", "node", () => {
			(container as HTMLElement).style.cursor = "";
		});
	}
});

// ----- Focus/search state + helpers -----
let currentFocusId: string | null = null;
let searchActive = false;

// Load options for focus/depth
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(function loadOpts(): void {
	try {
		const raw =
			document.getElementById("qualities-map-options")?.textContent ||
			"{}";
		(window as any).__QUAL_MAP_OPTS__ = JSON.parse(raw);
	} catch {
		/* noop */
	}
})();

function toAscii(s: string): string {
	return (s || "")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

// Diacritic-insensitive search index (label + non-relation lines + context + Pāli + id + slug)
type SearchEntry = {
	id: string;
	slug: string;
	label: string;
	ascii: string;
	tokens: string[];
};
// Prefer a primary node for ambiguous synonyms (keys/values are ASCII-normalized)
const PREFERRED_SYNONYM_TARGET: Record<string, string> = {
	// concentration appears under both collectedness and one-pointedness; prefer collectedness
	[toAscii("concentration")]: toAscii("collectedness"),
};
const SEARCH_INDEX: SearchEntry[] = (() => {
	const entries: SearchEntry[] = [];
	built.nodes.forEach((n: any) => {
		const id = n.data.id as string;
		const label = (n.data.label || id) as string;
		const slug = slugify(id);
		const m = built.meta[id] || { lines: [], context: "" };
		const lines: string[] = Array.isArray(m.lines) ? m.lines : [];
		const tokens: string[] = [];
		// label/id/slug
		tokens.push(label, id, slug);
		// context
		if (m.context) tokens.push(String(m.context));
		// parse lines: keep non-rel as synonyms; extract Pāli terms from [..]
		for (const raw of lines) {
			const s = String(raw).trim();
			if (!s) continue;
			if (
				/^\s*(Supported by|Leads to|Related|Related to|Opposite|Guarded by|Context)\s*:/i.test(
					s
				)
			)
				continue;
			const pm = s.match(/^\s*\[([^\]]+)\]\s*$/);
			if (pm) {
				pm[1].split(",").forEach((t) => tokens.push(t.trim()));
				continue;
			}
			// split comma-separated synonyms into individual tokens as well as full phrase
			tokens.push(s);
			if (s.includes(","))
				s.split(",").forEach((p) => tokens.push(p.trim()));
		}
		const ascii = toAscii(tokens.join(" "));
		entries.push({ id, slug, label, ascii, tokens: tokens.map(toAscii) });
	});
	return entries;
})();

function searchEntries(query: string): SearchEntry[] {
	const q = toAscii(query || "");
	if (!q) return [];
	console.debug("[QM][search] query=", query, "ascii=", q);
	// exact token match first
	const exact = SEARCH_INDEX.filter((e) => e.tokens.includes(q));
	if (exact.length) {
		console.debug(
			"[QM][search] exact token hits=",
			exact.map((e) => e.id)
		);
		return exact;
	}
	// starts-with token priority
	const starts = SEARCH_INDEX.filter((e) =>
		e.tokens.some((t) => t.startsWith(q))
	);
	if (starts.length) {
		console.debug(
			"[QM][search] starts-with hits=",
			starts.map((e) => e.id)
		);
		return starts;
	}
	// contains in ascii blob
	const contains = SEARCH_INDEX.filter((e) => e.ascii.includes(q));
	if (contains.length) {
		console.debug(
			"[QM][search] contains hits=",
			contains.map((e) => e.id)
		);
		return contains;
	}
	// fuzzy (edit distance <= 1) on tokens
	const d1: SearchEntry[] = [];
	for (const e of SEARCH_INDEX) {
		if (
			e.tokens.some(
				(t) =>
					t === q ||
					(Math.abs(t.length - q.length) <= 1 &&
						editDistanceLe1(t, q))
			)
		) {
			d1.push(e);
		}
	}
	if (d1.length)
		console.debug(
			"[QM][search] fuzzy<=1 hits=",
			d1.map((e) => e.id)
		);
	return d1;
}

function pickPreferredIfAmbiguous(
	query: string,
	results: SearchEntry[]
): SearchEntry | null {
	const q = toAscii(query);
	const preferred = PREFERRED_SYNONYM_TARGET[q];
	if (!preferred) return null;
	// Try to find a result whose label or slug matches the preferred target
	const hit = results.find(
		(e) =>
			toAscii(e.label) === preferred ||
			toAscii(e.slug) === preferred ||
			toAscii(e.id) === preferred
	);
	return hit || null;
}

// Fast predicate: true if Levenshtein distance <= 1
function editDistanceLe1(a: string, b: string): boolean {
	if (a === b) return true;
	const la = a.length,
		lb = b.length;
	if (Math.abs(la - lb) > 1) return false;
	// ensure a is shorter or equal
	if (la > lb) return editDistanceLe1(b, a);
	let i = 0,
		j = 0,
		edits = 0;
	while (i < la && j < lb) {
		if (a[i] === b[j]) {
			i++;
			j++;
			continue;
		}
		edits++;
		if (edits > 1) return false;
		if (la === lb) {
			i++;
			j++;
		} // substitution
		else {
			j++;
		} // insertion into a (or deletion from b)
	}
	// tail chars
	if (j < lb || i < la) edits++;
	return edits <= 1;
}
function getUrlFocus(): string | null {
	try {
		return new URL(location.href).searchParams.get("focus");
	} catch {
		return null;
	}
}
function setUrlFocus(slug: string | null, push = false) {
	try {
		const u = new URL(location.href);
		if (slug) u.searchParams.set("focus", slug);
		else u.searchParams.delete("focus");
		if (push) history.pushState({ focus: slug }, "", u.toString());
		else history.replaceState({ focus: slug }, "", u.toString());
	} catch {
		/* noop */
	}
}
function getUrlExpanded(): boolean {
	try {
		const u = new URL(location.href);
		const v = (
			u.searchParams.get("full") ||
			u.searchParams.get("expanded") ||
			""
		).toLowerCase();
		return v === "1" || v === "true" || v === "yes";
	} catch {
		return false;
	}
}
function setUrlExpanded(full: boolean, push = false) {
	try {
		const u = new URL(location.href);
		if (full) u.searchParams.set("full", "1");
		else u.searchParams.delete("full");
		if (push) history.pushState({ full }, "", u.toString());
		else history.replaceState({ full }, "", u.toString());
	} catch {
		/* noop */
	}
}
function installAuxStyles() {
	cy.style()
		.selector(".hidden-by-filter")
		.style({ display: "none" })
		.selector(".dim")
		.style({ opacity: 0.12, "z-index": 1 }) // dimmed nodes below active nodes
		.selector("edge.dim")
		.style({ "z-index": 0 }) // dimmed edges below dimmed nodes for easier node selection
		// All in-focus neighborhood (focus + ring) should stack above dimmed
		.selector(".focus-ring")
		.style({ "z-index": 600 })
		.selector(".focus-node")
		.style({ "border-width": 3, "border-color": "#111827", "z-index": 999 })
		.update();
}
installAuxStyles();

// sidepanel collapse
const sidepanel = document.getElementById("sidepanel")!;
const zoomBar = document.querySelector(".zoom-bar") as HTMLElement | null;
const spCollapse = document.getElementById("sp-collapse") as HTMLButtonElement;
// Restore persisted collapse state so it survives focus navigation or reloads
try {
	const saved = localStorage.getItem("qm.sidebar");
	if (saved === "collapsed") sidepanel.classList.add("collapsed");
	const expanded = !sidepanel.classList.contains("collapsed");
	spCollapse?.setAttribute("aria-expanded", expanded ? "true" : "false");
	if (spCollapse) spCollapse.textContent = expanded ? "\u27e8" : "\u27e9";
	if (zoomBar) zoomBar.classList.toggle("horizontal", expanded);
	// Clear bootstrap class on <html> if present (we now control state)
	try {
		document.documentElement.classList.remove("qm-collapsed");
		document.documentElement.classList.remove("qm-boot");
	} catch {}
} catch {}

// Focus helper to run after expansion; retries to beat transitions/layout
function focusSearchAfterExpand() {
	const attempt = (n: number) => {
		try {
			if (!q) return;
			q.focus({ preventScroll: true } as any);
			q.select?.();
			if (document.activeElement !== q && n < 3)
				setTimeout(() => attempt(n + 1), 60);
		} catch {}
	};
	requestAnimationFrame(() => requestAnimationFrame(() => attempt(0)));
}

// If panel starts expanded, focus the search input on load
if (!sidepanel.classList.contains("collapsed")) {
	setTimeout(() => {
		try {
			q?.focus({ preventScroll: true } as any);
			q?.select?.();
		} catch {}
	}, 0);
}
spCollapse?.addEventListener("click", () => {
	sidepanel.classList.toggle("collapsed");
	const expanded = !sidepanel.classList.contains("collapsed");
	spCollapse.setAttribute("aria-expanded", expanded ? "true" : "false");
	spCollapse.textContent = expanded ? "⟨" : "⟩";
	if (zoomBar) zoomBar.classList.toggle("horizontal", expanded);
	try {
		localStorage.setItem("qm.sidebar", expanded ? "open" : "collapsed");
	} catch {}
	if (expanded) focusSearchAfterExpand();
});

// Also handle keyboard-triggered expansion or delayed layouts
sidepanel?.addEventListener("transitionend", (ev) => {
	const te = ev as TransitionEvent;
	if (!te || te.propertyName !== "width") return;
	const expanded = !sidepanel.classList.contains("collapsed");
	if (expanded) focusSearchAfterExpand();
});

// toggles
const showRelated = document.getElementById("show-related") as HTMLInputElement;
const showOpposite = document.getElementById(
	"show-opposite"
) as HTMLInputElement;
const showSupported = document.getElementById(
	"show-supported"
) as HTMLInputElement;
const showLeads = document.getElementById("show-leads") as HTMLInputElement;
function applyEdgeToggles() {
	cy.edges("[type='related']").toggleClass("hidden", !showRelated.checked);
	cy.edges("[type='opposite']").toggleClass("hidden", !showOpposite.checked);
	cy.edges("[type='supportedBy']").toggleClass(
		"hidden",
		!showSupported.checked
	);
	cy.edges("[type='leadsTo']").toggleClass("hidden", !showLeads.checked);
}
[showRelated, showOpposite, showSupported, showLeads].forEach((el) =>
	el?.addEventListener("change", applyEdgeToggles)
);
// Initialize toggles using server-provided defaults
try {
	const opts = JSON.parse(
		document.getElementById("qualities-map-options")?.textContent || "{}"
	);
	if (opts?.flags) {
		if (typeof opts.flags.related === "boolean")
			showRelated.checked = !!opts.flags.related;
		if (typeof opts.flags.opposite === "boolean")
			showOpposite.checked = !!opts.flags.opposite;
	}
} catch {}
applyEdgeToggles();

// Node filters (checkboxes) for Wholesome/Unwholesome/Neutral with live counts
const nodeShowBright = document.getElementById(
	"node-show-bright"
) as HTMLInputElement;
const nodeShowDark = document.getElementById(
	"node-show-dark"
) as HTMLInputElement;
const nodeShowNeutral = document.getElementById(
	"node-show-neutral"
) as HTMLInputElement;
const nodeShowTopic = document.getElementById(
	"node-show-topic"
) as HTMLInputElement;
const countBright = document.getElementById("count-bright");
const countDark = document.getElementById("count-dark");
const countNeutral = document.getElementById("count-neutral");
const countTopic = document.getElementById("count-topic");
function applyNodeFilters() {
	const showPos = !!nodeShowBright?.checked;
	const showNeg = !!nodeShowDark?.checked;
	const showNeu = !!nodeShowNeutral?.checked;
	const showTopic = !!nodeShowTopic?.checked;
	cy.nodes().forEach((n) => {
		const pol = n.data("polarity");
		const isTopic = n.data("isTopic");

		const isPos = pol === "positive";
		const isNeg = pol === "negative";
		const isNeu = pol === "neutral";
		const isTop = pol === "topic" || isTopic;

		const visible =
			(isPos && showPos) ||
			(isNeg && showNeg) ||
			(isNeu && showNeu) ||
			(isTop && showTopic);

		n.toggleClass("hidden", !visible);
	});
	// hide edges if either endpoint hidden
	cy.edges().forEach((e) => {
		const sHidden = e.source().hasClass("hidden");
		const tHidden = e.target().hasClass("hidden");
		e.toggleClass("hidden", sHidden || tHidden);
	});
	if (countBright)
		countBright.textContent = String(
			cy.nodes("[polarity = 'positive']").not(".hidden").length
		);
	if (countDark)
		countDark.textContent = String(
			cy.nodes("[polarity = 'negative']").not(".hidden").length
		);
	if (countNeutral)
		countNeutral.textContent = String(
			cy.nodes("[polarity = 'neutral']").not(".hidden").length
		);
	if (countTopic)
		countTopic.textContent = String(
			cy
				.nodes()
				.filter(
					(n) =>
						(n.data("polarity") === "topic" || n.data("isTopic")) &&
						!n.hasClass("hidden")
				).length
		);
}
nodeShowBright?.addEventListener("change", () => {
	applyNodeFilters();
	const vis = cy.elements().not(".hidden");
	if (vis.nonempty()) cy.fit(vis, 80);
});
nodeShowDark?.addEventListener("change", () => {
	applyNodeFilters();
	const vis = cy.elements().not(".hidden");
	if (vis.nonempty()) cy.fit(vis, 80);
});
nodeShowNeutral?.addEventListener("change", () => {
	applyNodeFilters();
	const vis = cy.elements().not(".hidden");
	if (vis.nonempty()) cy.fit(vis, 80);
});
nodeShowTopic?.addEventListener("change", () => {
	applyNodeFilters();
	const vis = cy.elements().not(".hidden");
	if (vis.nonempty()) cy.fit(vis, 80);
});
applyNodeFilters();

function findNodeByFocusKey(key: string) {
	const ak = toAscii(key);
	// try slugified id
	let cand = cy.nodes().filter((n) => toAscii(slugify(n.id())) === ak);
	if (cand.nonempty()) return cand[0];
	cand = cy.nodes().filter((n) => toAscii(n.id()) === ak);
	if (cand.nonempty()) return cand[0];
	cand = cy.nodes().filter((n) => toAscii(n.data("label")) === ak);
	if (cand.nonempty()) return cand[0];
	cand = cy.nodes().filter((n) => toAscii(n.data("label")).includes(ak));
	return cand.nonempty() ? cand[0] : null;
}
function highlightNeighborhood(node: cytoscape.NodeSingular, depth: number) {
	cy.batch(() => {
		cy.elements().removeClass(
			"dim focus-node from-focus to-focus focus-ring"
		);
		node.addClass("focus-node");
		if (depth <= 0) return;
		let coll = node.closedNeighborhood();
		for (let i = 1; i < depth; i++) coll = coll.closedNeighborhood();
		const keep = new Set(coll.map((e) => e.id()));
		cy.elements().forEach((e) => {
			if (!keep.has(e.id())) e.addClass("dim");
		});
		// Raise z-index on all in-focus nodes
		coll.nodes().addClass("focus-ring");
		// Mark incoming/outgoing edges relative to focus node
		const edges = node.connectedEdges();
		edges.forEach((e) => {
			if (e.source().id() === node.id()) e.addClass("from-focus");
			if (e.target().id() === node.id()) e.addClass("to-focus");
		});
	});
}
// Run an overlap-avoiding concentric layout on the focused neighborhood to clarify labels
function layoutFocusArea(node: cytoscape.NodeSingular, depth: number) {
	try {
		// Build rings by hop distance up to depth
		const dist = new Map<string, number>();
		dist.set(node.id(), 0);
		let frontier: cytoscape.NodeCollection = node.collection();
		for (let d = 1; d <= depth; d++) {
			const next = cy.collection();
			frontier.forEach((n) => {
				n.neighborhood("node").forEach((m) => {
					if (!dist.has(m.id())) {
						dist.set(m.id(), d);
						next.merge(m);
					}
				});
			});
			frontier = next;
		}
		const nodes = cy
			.collection(
				Array.from(dist.keys()).map((id) => cy.getElementById(id))
			)
			.nodes();
		if (nodes.length < 2) return Promise.resolve();
		return new Promise<void>((resolve) => {
			const maxDepth = Math.max(...Array.from(dist.values()));
			// Constrain layout inside viewport to prevent flinging nodes far away
			const pad = FOCUS_LAYOUT.padding;
			const bbox = {
				x1: pad,
				y1: pad,
				w: cy.width() - pad * 2,
				h: cy.height() - pad * 2,
			} as any;
			const layout = nodes.layout({
				name: "concentric",
				animate: true,
				animationDuration: FOCUS_LAYOUT.animMs,
				animationEasing: "ease-in-out-cubic",
				fit: false,
				boundingBox: bbox,
				avoidOverlap: true,
				minNodeSpacing: FOCUS_LAYOUT.minNodeSpacing,
				spacingFactor: FOCUS_LAYOUT.spacingFactor,
				nodeDimensionsIncludeLabels: true,
				concentric: (n: any) => {
					const d = dist.get(n.id()) ?? maxDepth;
					// Higher values go closer to the centre; ensure focus has the highest value
					return maxDepth - d + 1;
				},
				levelWidth: () => 1,
			} as any);
			layout.on("layoutstop", () => resolve());
			layout.run();
		});
	} catch {
		return Promise.resolve();
	}
}

// --- Simple block-then-equal-angle focus layout -----------------------------------------------
// Groups neighbors by relation (leadsTo, opposite, supportedBy, related, other),
// sorts each group alphabetically (diacritic-insensitive), concatenates in a fixed
// clockwise order, and spaces all nodes in the ring with equal angles around 360°.
// This guarantees full-circle utilization and predictable block placement with
// Leads→ starting at 0° (east), Opposite after Leads→, Supported by after Opposite,
// then Related, then Other.
function collateAscii(a: string, b: string) {
	const aa = toAscii(a || ""),
		bb = toAscii(b || "");
	return aa < bb ? -1 : aa > bb ? 1 : 0;
}
function relFromFocus(
	focus: cytoscape.NodeSingular,
	n: cytoscape.NodeSingular
): "leadsTo" | "supportedBy" | "related" | "opposite" | "other" {
	const between = focus.edgesWith(n);
	// Directional precedence
	if (
		between.some(
			(e) =>
				e.data("type") === "leadsTo" && e.source().id() === focus.id()
		)
	)
		return "leadsTo";
	if (
		between.some(
			(e) =>
				e.data("type") === "leadsTo" && e.target().id() === focus.id()
		)
	)
		return "supportedBy";
	if (
		between.some(
			(e) =>
				e.data("type") === "supportedBy" &&
				e.target().id() === focus.id()
		)
	)
		return "supportedBy";
	if (
		between.some(
			(e) =>
				e.data("type") === "supportedBy" &&
				e.source().id() === focus.id()
		)
	)
		return "leadsTo";
	if (between.some((e) => e.data("type") === "related")) return "related";
	if (between.some((e) => e.data("type") === "opposite")) return "opposite";
	return "other";
}
function layoutFocusAreaBlock360(node: cytoscape.NodeSingular, depth: number) {
	try {
		const maxDepth = Math.max(1, depth | 0);
		// Build rings by hop distance up to depth
		const dist = new Map<string, number>();
		dist.set(node.id(), 0);
		let frontier: cytoscape.NodeCollection = node.collection();
		for (let d = 1; d <= maxDepth; d++) {
			const next = cy.collection();
			frontier.forEach((n) => {
				n.neighborhood("node").forEach((m) => {
					if (!dist.has(m.id())) {
						dist.set(m.id(), d);
						next.merge(m);
					}
				});
			});
			frontier = next;
		}
		const rings = new Map<number, string[]>();
		dist.forEach((d, id) => {
			if (d > 0 && d <= maxDepth) {
				const arr = rings.get(d) || [];
				arr.push(id);
				rings.set(d, arr);
			}
		});
		if (!rings.size) return Promise.resolve();

		// Constrain layout inside viewport
		const pad = FOCUS_LAYOUT.padding;
		const bbox = {
			x1: pad,
			y1: pad,
			w: cy.width() - pad * 2,
			h: cy.height() - pad * 2,
		} as any;
		const cx = bbox.x1 + bbox.w / 2;
		const cyy = bbox.y1 + bbox.h / 2;
		const maxR = Math.min(bbox.w, bbox.h) / 2 - 12;
		const ringStep = Math.max(88, maxR / (maxDepth + 1));
		const toXY = (deg: number, r: number) => {
			const rad = (deg * Math.PI) / 180;
			return { x: cx + r * Math.cos(rad), y: cyy + r * Math.sin(rad) };
		};

		const positions: Record<string, { x: number; y: number }> = {};
		positions[node.id()] = { x: cx, y: cyy };

		// Place each ring independently with equal-angle spacing
		rings.forEach((ids, d) => {
			if (!ids.length) return;
			// Build groups
			const groups = {
				leadsTo: [] as cytoscape.NodeSingular[],
				opposite: [] as cytoscape.NodeSingular[],
				supportedBy: [] as cytoscape.NodeSingular[],
				related: [] as cytoscape.NodeSingular[],
				other: [] as cytoscape.NodeSingular[],
			};
			ids.forEach((id) => {
				const n = cy.getElementById(id);
				const rel = relFromFocus(node, n);
				groups[rel].push(n);
			});
			// Sort alphabetically within each group
			(Object.keys(groups) as (keyof typeof groups)[]).forEach((k) => {
				groups[k].sort((a, b) =>
					collateAscii(
						String(a.data("label") || a.id()),
						String(b.data("label") || b.id())
					)
				);
			});
			// Global clockwise order: Leads→, Opposite, Supported by, Related, Other
			const ordered = [
				...groups.leadsTo,
				...groups.opposite,
				...groups.supportedBy,
				...groups.related,
				...groups.other,
			];
			if (!ordered.length) return;
			const count = ordered.length;
			const stepDeg = 360 / count;
			const startDeg = 0; // east: leadsTo begins in right hemisphere
			const r = ringStep * d;
			ordered.forEach((n, i) => {
				const deg = startDeg + i * stepDeg;
				const p = toXY(deg, r);
				positions[n.id()] = p;
			});
		});

		// After computing positions, skew the whole set slightly to avoid vertical label stacking
		try {
			const rad = (30 * Math.PI) / 180; // +30°
			const cos = Math.cos(rad),
				sin = Math.sin(rad);
			Object.keys(positions).forEach((id) => {
				const p = positions[id];
				if (!p) return;
				const dx = p.x - cx;
				const dy = p.y - cyy;
				positions[id] = {
					x: cx + dx * cos - dy * sin,
					y: cyy + dx * sin + dy * cos,
				};
			});
		} catch {
			/* noop */
		}

		// Run preset layout
		return new Promise<void>((resolve) => {
			const nodes = cy.collection(
				Object.keys(positions).map((id) => cy.getElementById(id))
			);
			const layout = nodes.layout({
				name: "preset",
				positions: (ele: any) => positions[ele.id()],
				fit: false,
				animate: true,
				animationDuration: FOCUS_LAYOUT.animMs,
				animationEasing: "ease-in-out-cubic",
				boundingBox: bbox,
			} as any);
			layout.on("layoutstop", () => resolve());
			layout.run();
		});
	} catch {
		return Promise.resolve();
	}
}
function fitAroundNode(node: cytoscape.NodeSingular, depth: number) {
	let eles: cytoscape.CollectionReturnValue = node;
	if (depth > 0) {
		let c = node.closedNeighborhood();
		for (let i = 1; i < depth; i++) c = c.closedNeighborhood();
		eles = c;
	}
	cy.animate(
		{ fit: { eles, padding: FOCUS_LAYOUT.padding } },
		{ duration: 280, easing: "ease-in-out" }
	);
}
function defaultFocusedView() {
	// pick highest-degree node
	let pick: any = null,
		best = -1;
	cy.nodes().forEach((n) => {
		const d = n.degree(false);
		if (d > best) {
			best = d;
			pick = n;
		}
	});
	if (pick) setFocus(pick, { openDrawer: false, updateUrl: false });
}
function applyInitialFocus() {
	try {
		const opts = JSON.parse(
			document.getElementById("qualities-map-options")?.textContent ||
				"{}"
		);
		const key = getUrlFocus() || String(opts?.focus || "").trim();
		if (key) {
			const n = findNodeByFocusKey(key);
			if (n) {
				setFocus(n, {
					openDrawer: false,
					updateUrl: true,
					pushUrl: false,
				});
				return;
			}
			// Fallback: treat unknown focus key as a search term
			try {
				runSearchForTerm(key, {
					fromUrl: false,
					allowUrlRewrite: true,
				});
				return;
			} catch {
				/* noop */
			}
		}
	} catch {}
	defaultFocusedView();
}
function clearSearchFilters() {
	searchActive = false;
	cy.batch(() => {
		cy.elements().removeClass("hidden-by-filter");
	});
}
function effectiveDepth(input?: number): number {
	const fromOpts = (window as any).__QUAL_MAP_OPTS__?.depth;
	const d =
		typeof input === "number"
			? input
			: typeof fromOpts === "number"
			? fromOpts
			: undefined;
	return d && d > 0 ? d : DEFAULT_FOCUS_DEPTH;
}

function setFocus(
	node: cytoscape.NodeSingular,
	opts?: {
		openDrawer?: boolean;
		updateUrl?: boolean;
		pushUrl?: boolean;
		depth?: number;
	}
) {
	const depth = effectiveDepth(opts?.depth);
	currentFocusId = node.id();
	searchActive = false;
	highlightNeighborhood(node, depth);
	// Use the simple block-then-equal-angle layout; fallback to concentric if needed
	(layoutFocusAreaBlock360(node, depth) || Promise.resolve())
		.catch(() => layoutFocusArea(node, depth))
		.then(() => fitAroundNode(node, depth));
	const slug = slugify(node.id());
	if (opts?.updateUrl !== false) setUrlFocus(slug, !!opts?.pushUrl);
	// If caller explicitly asked to open, open/update the drawer.
	// Otherwise, if the drawer is already open, update it to the new focus.
	try {
		const drw = document.getElementById("drawer");
		const isOpen = !!drw && drw.classList.contains("open");
		if (opts?.openDrawer || isOpen) {
			renderDrawer(node.id());
		}
	} catch {
		/* noop */
	}
}
function installPopstateFocus() {
	window.addEventListener("popstate", () => {
		// Sync fullscreen state from URL
		try {
			const shouldFull = getUrlExpanded();
			const nowFull =
				document.documentElement.classList.contains("qm-full");
			if (shouldFull !== nowFull) applyVpToggleState(shouldFull);
		} catch {}
		const key = getUrlFocus();
		if (!key) {
			currentFocusId = null;
			cy.elements().removeClass("dim focus-node");
			clearSearchFilters();
			defaultFocusedView();
			return;
		}
		const n = findNodeByFocusKey(key);
		if (n) {
			setFocus(n, { openDrawer: false, updateUrl: false });
			return;
		}
		// Fallback to treating the key as a search term, but do not rewrite URL during popstate
		try {
			runSearchForTerm(key, { fromUrl: false, allowUrlRewrite: false });
		} catch {
			/* noop */
		}
	});
}
// Initialize fullscreen class from URL before focusing/layout
try {
	if (getUrlExpanded()) document.documentElement.classList.add("qm-full");
} catch {}
applyInitialFocus();
installPopstateFocus();

// ASCII normalization for Pali terms (e.g., jhāna -> jhana, paññā -> panna)
function paliAscii(s: string): string {
	if (!s) return s;
	const base = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip diacritics
	return base
		.replace(/[āĀ]/g, "a")
		.replace(/[īĪ]/g, "i")
		.replace(/[ūŪ]/g, "u")
		.replace(/[ñÑ]/g, "n")
		.replace(/[ṇṆ]/g, "n")
		.replace(/[ṅṄ]/g, "n")
		.replace(/[ṭṬ]/g, "t")
		.replace(/[ḍḌ]/g, "d")
		.replace(/[ṃṁṂṀ]/g, "m")
		.replace(/[śŚṣṢ]/g, "s")
		.replace(/[ḥḤ]/g, "h");
}

// search (diacritic-insensitive), center + zoom; fade others, highlight neighborhood of depth hops
const q = document.getElementById("q") as HTMLInputElement;
const qGo = document.getElementById("q-go") as HTMLButtonElement | null;
// Long-press to convert base chars into single Pāli diacritic variant (simple, no popup)
(() => {
	if (!q) return;
	const MAP: Record<string, string> = {
		a: "ā",
		i: "ī",
		u: "ū",
		n: "ñ",
		t: "ṭ",
		d: "ḍ",
		m: "ṃ",
		h: "ḥ",
		N: "Ñ",
		A: "Ā",
		I: "Ī",
		U: "Ū",
		T: "Ṭ",
		D: "Ḍ",
		M: "Ṃ",
		H: "Ḥ",
	};
	let pressTimer: number | null = null;
	let lastKey: string | null = null;
	let lastPos: number | null = null;
	let replacedOnLongPress = false;
	const LONG_MS = 380; // threshold for long-press

	q.addEventListener("keydown", (ev: KeyboardEvent) => {
		// Only letters we care about; skip modifier combos and navigation keys
		if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
		const k = ev.key;
		if (!MAP[k]) {
			lastKey = null;
			if (pressTimer) {
				clearTimeout(pressTimer);
				pressTimer = null;
			}
			return;
		}
		// Stop OS/browser key repeat from inserting aaaaa...
		if ((ev as any).repeat) {
			ev.preventDefault();
			return;
		}
		lastKey = k;
		// record caret before key is applied
		lastPos = q.selectionStart ?? q.value.length;
		if (pressTimer) clearTimeout(pressTimer);
		pressTimer = window.setTimeout(() => {
			// On long press: replace the last typed base char with diacritic
			try {
				// If user moved caret or selection, bail
				const curEnd = q.selectionEnd ?? q.value.length;
				const curStart = q.selectionStart ?? q.value.length;
				// If there is a selection, we won't auto-replace to avoid surprises
				if (curStart !== curEnd) return;
				const pos = curEnd;
				// We expect the base char to be just before caret
				const pre = q.value.slice(0, pos);
				if (!pre) return;
				const base = pre.slice(-1);
				const repl = MAP[base];
				if (!repl) return;
				const before = pre.slice(0, -1);
				const after = q.value.slice(pos);
				q.value = before + repl + after;
				const newPos = before.length + repl.length;
				try {
					q.setSelectionRange(newPos, newPos);
				} catch {}
				q.dispatchEvent(new Event("input", { bubbles: true }));
				replacedOnLongPress = true;
			} finally {
				if (pressTimer) {
					clearTimeout(pressTimer);
					pressTimer = null;
				}
				lastKey = null;
				lastPos = null;
			}
		}, LONG_MS);
	});
	// Cancel long-press on keyup unless it already fired; if a short press, do nothing extra
	q.addEventListener("keyup", () => {
		if (pressTimer) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
		lastKey = null;
		lastPos = null;
		// If we already replaced on long-press, suppress any residual character effects
		if (replacedOnLongPress) {
			replacedOnLongPress = false;
		}
	});
	// Also cancel on blur
	q.addEventListener("blur", () => {
		if (pressTimer) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
		lastKey = null;
		lastPos = null;
	});
})();
function maybeCollapsePanelOnSmallViewport(singleExact: boolean) {
	try {
		const vpSmall = window.matchMedia("(max-width: 600px)").matches;
		if (!vpSmall) return;
		if (!singleExact) return; // collapse only on exact single-focus
		const panel = document.getElementById("sidepanel");
		const btn = document.getElementById(
			"sp-collapse"
		) as HTMLButtonElement | null;
		if (panel && !panel.classList.contains("collapsed")) {
			panel.classList.add("collapsed");
			btn?.setAttribute("aria-expanded", "false");
			if (btn) btn.textContent = "⟩";
			try {
				localStorage.setItem("qm.sidebar", "collapsed");
			} catch {}
			console.debug("[QM][panel] auto-collapsed on small viewport");
		}
	} catch {}
}
function clearSearchVisual() {
	cy.elements().removeClass("dimmed highlight dim focus-node");
	clearSearchFilters();
	setUrlFocus(null, false);
	currentFocusId = null;
}

function getDepthNeighborhood(seedIds: Set<string>, depth: number) {
	if (!depth || depth <= 0) return cy.collection();
	let frontier = new Set(seedIds);
	let seen = new Set(seedIds);
	let nodesCol = cy.collection();
	for (let d = 0; d < depth; d++) {
		const next = new Set<string>();
		frontier.forEach((id) => {
			const n = cy.getElementById(id);
			nodesCol = nodesCol.union(n);
			n.connectedEdges().forEach((e) => {
				const u = e.source().id();
				const v = e.target().id();
				if (!seen.has(u)) {
					seen.add(u);
					next.add(u);
				}
				if (!seen.has(v)) {
					seen.add(v);
					next.add(v);
				}
			});
		});
		frontier = next;
	}
	return nodesCol.union(nodesCol.connectedEdges());
}
q.addEventListener("keydown", (ev: KeyboardEvent) => {
	if (ev.key !== "Enter") return;
	const term = (q.value || "").trim();
	if (!term) return;
	const wasOpen = !!document
		.getElementById("drawer")
		?.classList.contains("open");
	console.debug("[QM][enter] term=", term);
	// Gather matches from index (diacritic + synonyms + context + id/slug)
	const results = searchEntries(term).slice(0, 50);
	// If we have exactly one unique node, treat it as a direct label match and focus normally
	const uniqIds = Array.from(new Set(results.map((r) => r.id)));
	// If multiple, check if there's a preferred alias target for this query
	if (uniqIds.length > 1) {
		const preferred = pickPreferredIfAmbiguous(term, results);
		if (preferred) {
			const node = cy.getElementById(preferred.id);
			if (node && node.nonempty && node.nonempty()) {
				console.debug("[QM][enter] pref-target focus=", preferred.id);
				// Clear multi-match filters so the node is visible
				clearSearchFilters();
				setFocus(node as any, {
					openDrawer: wasOpen,
					updateUrl: true,
					pushUrl: true,
				});
				maybeCollapsePanelOnSmallViewport(true);
				return;
			}
		}
	}
	if (uniqIds.length === 1) {
		const node = cy.getElementById(uniqIds[0]);
		if (node && node.nonempty && node.nonempty()) {
			console.debug(
				"[QM][enter] single-result focus=",
				uniqIds[0],
				"preserveDrawerOpen=",
				wasOpen
			);
			clearSearchFilters();
			setFocus(node as any, {
				openDrawer: wasOpen,
				updateUrl: true,
				pushUrl: true,
			});
			maybeCollapsePanelOnSmallViewport(true);
			return;
		}
		const fallback = findNodeByFocusKey(term);
		if (fallback) {
			console.debug(
				"[QM][enter] fallback direct focus preserveDrawerOpen=",
				wasOpen
			);
			clearSearchFilters();
			setFocus(fallback, {
				openDrawer: wasOpen,
				updateUrl: true,
				pushUrl: true,
			});
			maybeCollapsePanelOnSmallViewport(true);
			return;
		}
	}
	// Otherwise, handle multi-match mode
	if (!results.length) return;
	// Build visible set: matches + neighbors, capped at 20 total
	const ids: string[] = Array.from(new Set(results.map((r) => r.id)));
	const matchNodes = cy.collection(ids.map((id) => cy.getElementById(id)));
	let pool = matchNodes;
	// Auto-focus search when expanded on load
	const expanded = !sidepanel.classList.contains("collapsed");
	if (expanded) {
		setTimeout(() => {
			try {
				q?.focus();
				q?.select?.();
			} catch {}
		}, 0);
	}
	matchNodes.forEach((m) => {
		pool = pool.union(m.neighborhood("node"));
	});
	const visibleNodeIds = new Set<string>();
	matchNodes.forEach((m) => visibleNodeIds.add(m.id()));
	const poolArr = pool
		.nodes()
		.toArray()
		.sort((a, b) => b.degree(false) - a.degree(false));
	for (const n of poolArr) {
		if (visibleNodeIds.size >= 20) break;
		visibleNodeIds.add(n.id());
	}
	searchActive = true;
	currentFocusId = null;
	setUrlFocus(null, false);
	cy.batch(() => {
		// Auto-focus when expanded via toggle
		if (expanded) {
			setTimeout(() => {
				try {
					q?.focus();
					q?.select?.();
				} catch {}
			}, 0);
		}
		cy.nodes().forEach((n) => {
			if (visibleNodeIds.has(n.id())) n.removeClass("hidden-by-filter");
			else n.addClass("hidden-by-filter");
		});
		cy.edges().forEach((e) => {
			const sVis = !e.source().hasClass("hidden-by-filter");
			const tVis = !e.target().hasClass("hidden-by-filter");
			if (sVis && tVis) e.removeClass("hidden-by-filter");
			else e.addClass("hidden-by-filter");
		});
		cy.elements().removeClass("dim focus-node");
	});
	// Do not change drawer state in multi-match mode; preserve user context
	const vis = cy.elements().filter((e) => !e.hasClass("hidden-by-filter"));
	console.debug("[QM][enter] multi-match ids=", Array.from(visibleNodeIds));
	cy.animate(
		{ fit: { eles: vis, padding: FOCUS_LAYOUT.padding } },
		{ duration: 260 }
	);
});

// Programmatic search runner used by URL fallback when no focus node is found.
// Options:
// - fromUrl: invoked due to a URL 'focus' that didn't match a node
// - allowUrlRewrite: when true, replace the URL's focus to the resolved slug on exact match
function runSearchForTerm(
	term: string,
	opts?: { fromUrl?: boolean; allowUrlRewrite?: boolean }
) {
	try {
		if (q) {
			q.value = term;
			if (qGo) qGo.classList.toggle("hidden", !(term || "").trim());
		}
	} catch {}
	// If the query maps to a preferred canonical quality (e.g., jhana -> collectedness), focus it directly.
	try {
		const pref = PREFERRED_SYNONYM_TARGET[toAscii(term || "")];
		if (pref) {
			// Try by id, then by slug/label matching
			let node = cy.getElementById(pref);
			if (!node || !(node as any).nonempty || !(node as any).nonempty()) {
				const bySlug = cy
					.nodes()
					.filter(
						(n) =>
							toAscii(slugify(n.id())) === pref ||
							toAscii(n.data("label")) === pref ||
							toAscii(n.id()) === pref
					);
				if (
					bySlug &&
					(bySlug as any).nonempty &&
					(bySlug as any).nonempty()
				)
					node = (bySlug as any)[0];
			}
			if (node && (node as any).nonempty && (node as any).nonempty()) {
				clearSearchFilters();
				setFocus(node as any, {
					openDrawer: false,
					updateUrl: true,
					pushUrl: !!opts?.fromUrl,
				});
				if (opts?.allowUrlRewrite)
					setUrlFocus(slugify((node as any).id()), false);
				maybeCollapsePanelOnSmallViewport(true);
				return;
			}
		}
	} catch {
		/* noop */
	}
	const wasOpen = !!document
		.getElementById("drawer")
		?.classList.contains("open");
	const results = searchEntries(term).slice(0, 50);
	const uniqIds = Array.from(new Set(results.map((r) => r.id)));
	// Prefer synonym target if ambiguous
	if (uniqIds.length > 1) {
		const preferred = pickPreferredIfAmbiguous(term, results);
		if (preferred) {
			const node = cy.getElementById(preferred.id);
			if (node && (node as any).nonempty && (node as any).nonempty()) {
				clearSearchFilters();
				setFocus(node as any, {
					openDrawer: wasOpen,
					updateUrl: true,
					pushUrl: !!opts?.fromUrl,
				});
				if (opts?.allowUrlRewrite)
					setUrlFocus(slugify(preferred.id), false);
				maybeCollapsePanelOnSmallViewport(true);
				return;
			}
		}
	}
	if (uniqIds.length === 1) {
		const node = cy.getElementById(uniqIds[0]);
		if (node && (node as any).nonempty && (node as any).nonempty()) {
			clearSearchFilters();
			setFocus(node as any, {
				openDrawer: wasOpen,
				updateUrl: true,
				pushUrl: !!opts?.fromUrl,
			});
			if (opts?.allowUrlRewrite) setUrlFocus(slugify(uniqIds[0]), false);
			maybeCollapsePanelOnSmallViewport(true);
			return;
		}
		const fb = findNodeByFocusKey(term);
		if (fb) {
			clearSearchFilters();
			setFocus(fb as any, {
				openDrawer: wasOpen,
				updateUrl: true,
				pushUrl: !!opts?.fromUrl,
			});
			if (opts?.allowUrlRewrite) setUrlFocus(slugify(fb.id()), false);
			maybeCollapsePanelOnSmallViewport(true);
			return;
		}
	}
	if (!results.length) return;
	// Multi-match: reveal results + neighbors
	const ids: string[] = Array.from(new Set(results.map((r) => r.id)));
	const matchNodes = cy.collection(ids.map((id) => cy.getElementById(id)));
	let pool = matchNodes;
	matchNodes.forEach((m) => {
		pool = pool.union(m.neighborhood("node"));
	});
	const visibleNodeIds = new Set<string>();
	matchNodes.forEach((m) => visibleNodeIds.add(m.id()));
	const poolArr = pool
		.nodes()
		.toArray()
		.sort((a, b) => b.degree(false) - a.degree(false));
	for (const n of poolArr) {
		if (visibleNodeIds.size >= 20) break;
		visibleNodeIds.add(n.id());
	}
	searchActive = true;
	currentFocusId = null;
	setUrlFocus(null, false);
	cy.batch(() => {
		cy.nodes().forEach((n) => {
			if (visibleNodeIds.has(n.id())) n.removeClass("hidden-by-filter");
			else n.addClass("hidden-by-filter");
		});
		cy.edges().forEach((e) => {
			const sVis = !e.source().hasClass("hidden-by-filter");
			const tVis = !e.target().hasClass("hidden-by-filter");
			if (sVis && tVis) e.removeClass("hidden-by-filter");
			else e.addClass("hidden-by-filter");
		});
		cy.elements().removeClass("dim focus-node");
	});
	const vis = cy.elements().filter((e) => !e.hasClass("hidden-by-filter"));
	cy.animate(
		{ fit: { eles: vis, padding: FOCUS_LAYOUT.padding } },
		{ duration: 260 }
	);
}

// Click on enter icon should behave like pressing Enter, with mobile collapse logic
qGo?.addEventListener("click", () => {
	const term = (q?.value || "").trim();
	if (!term) return;
	const wasOpen = !!document
		.getElementById("drawer")
		?.classList.contains("open");
	console.debug("[QM][enter-icon] term=", term);
	const results = searchEntries(term).slice(0, 50);
	const uniqIds = Array.from(new Set(results.map((r) => r.id)));
	if (uniqIds.length > 1) {
		const preferred = pickPreferredIfAmbiguous(term, results);
		if (preferred) {
			const node = cy.getElementById(preferred.id);
			if (node && node.nonempty && node.nonempty()) {
				console.debug(
					"[QM][enter-icon] pref-target focus=",
					preferred.id
				);
				clearSearchFilters();
				setFocus(node as any, {
					openDrawer: wasOpen,
					updateUrl: true,
					pushUrl: true,
				});
				// Do not collapse panel automatically for icon path in multi-match; but this is an exact pref
				return;
			}
		}
	}
	if (uniqIds.length === 1) {
		const node = cy.getElementById(uniqIds[0]);
		if (node && node.nonempty && node.nonempty()) {
			console.debug(
				"[QM][enter-icon] single-result focus=",
				uniqIds[0],
				"preserveDrawerOpen=",
				wasOpen
			);
			clearSearchFilters();
			setFocus(node as any, {
				openDrawer: wasOpen,
				updateUrl: true,
				pushUrl: true,
			});
			maybeCollapsePanelOnSmallViewport(true);
			return;
		}
		const fallback = findNodeByFocusKey(term);
		if (fallback) {
			console.debug(
				"[QM][enter-icon] fallback direct focus preserveDrawerOpen=",
				wasOpen
			);
			clearSearchFilters();
			setFocus(fallback, {
				openDrawer: wasOpen,
				updateUrl: true,
				pushUrl: true,
			});
			maybeCollapsePanelOnSmallViewport(true);
			return;
		}
	}
	if (!results.length) return;
	// Multi-match mode: same as Enter path, but do not collapse the panel
	const ids: string[] = Array.from(new Set(results.map((r) => r.id)));
	const matchNodes = cy.collection(ids.map((id) => cy.getElementById(id)));
	let pool = matchNodes;
	matchNodes.forEach((m) => {
		pool = pool.union(m.neighborhood("node"));
	});
	const visibleNodeIds = new Set<string>();
	matchNodes.forEach((m) => visibleNodeIds.add(m.id()));
	const poolArr = pool
		.nodes()
		.toArray()
		.sort((a, b) => b.degree(false) - a.degree(false));
	for (const n of poolArr) {
		if (visibleNodeIds.size >= 20) break;
		visibleNodeIds.add(n.id());
	}
	searchActive = true;
	currentFocusId = null;
	setUrlFocus(null, false);
	cy.batch(() => {
		cy.nodes().forEach((n) => {
			if (visibleNodeIds.has(n.id())) n.removeClass("hidden-by-filter");
			else n.addClass("hidden-by-filter");
		});
		cy.edges().forEach((e) => {
			const sVis = !e.source().hasClass("hidden-by-filter");
			const tVis = !e.target().hasClass("hidden-by-filter");
			if (sVis && tVis) e.removeClass("hidden-by-filter");
			else e.addClass("hidden-by-filter");
		});
		cy.elements().removeClass("dim focus-node");
	});
	const vis = cy.elements().filter((e) => !e.hasClass("hidden-by-filter"));
	console.debug(
		"[QM][enter-icon] multi-match ids=",
		Array.from(visibleNodeIds)
	);
	cy.animate(
		{ fit: { eles: vis, padding: FOCUS_LAYOUT.padding } },
		{ duration: 260 }
	);
});

// Show/hide Enter icon based on input content
q?.addEventListener("input", () => {
	const has = !!(q?.value || "").trim();
	if (qGo) qGo.classList.toggle("hidden", !has);
});
// Initialize icon visibility
(() => {
	try {
		const has = !!(q?.value || "").trim();
		if (qGo) qGo.classList.toggle("hidden", !has);
	} catch {}
})();

// Accessibility: collapse the panel when Esc is pressed while focus is within sidepanel
document
	.getElementById("sidepanel")
	?.addEventListener("keydown", (ev: KeyboardEvent) => {
		if (ev.key !== "Escape") return;
		// If the drawer is open, close it first (higher priority), matching normal mode
		const drw = document.getElementById("drawer");
		if (drw?.classList?.contains("open")) {
			drw.classList.remove("open");
			ev.stopPropagation();
			return;
		}
		ev.stopPropagation();
		const panel = document.getElementById("sidepanel");
		if (!panel) return;
		if (!panel.classList.contains("collapsed")) {
			panel.classList.add("collapsed");
			spCollapse?.setAttribute("aria-expanded", "false");
			if (spCollapse) spCollapse.textContent = "⟩";
			try {
				localStorage.setItem("qm.sidebar", "collapsed");
			} catch {}
			console.debug("[QM][panel] collapsed via Escape in sidepanel");
		}
	});
// Hide labels when zoomed out to reduce clutter
cy.on("zoom", () => {
	const z = cy.zoom();
	const opacity = z > 0.45 ? 1 : 0;
	cy.style().selector("node").style("text-opacity", opacity).update();
});

// Zoom controls
const zoomIn = document.getElementById("zoom-in") as HTMLButtonElement;
const zoomOut = document.getElementById("zoom-out") as HTMLButtonElement;
const zoomReset = document.getElementById("zoom-reset") as HTMLButtonElement;
const vpToggle = document.getElementById(
	"vp-toggle"
) as HTMLButtonElement | null;
function zoom(delta: number) {
	const z = cy.zoom();
	const center = { x: cy.width() / 2, y: cy.height() / 2 };
	cy.zoom({ level: z * delta, renderedPosition: center });
}
zoomIn?.addEventListener("click", () => zoom(1.2));
zoomOut?.addEventListener("click", () => zoom(1 / 1.2));
zoomReset?.addEventListener("click", () => {
	// Clear search filters and focus, then default view
	cy.elements().removeClass("dim focus-node");
	clearSearchFilters();
	currentFocusId = null;
	setUrlFocus(null, false);
	const nodes = cy.nodes();
	if (nodes.length === 0) return;
	// Default focused-like view
	let pick: any = null,
		best = -1;
	nodes.forEach((n) => {
		const d = n.degree(false);
		if (d > best) {
			best = d;
			pick = n;
		}
	});
	if (pick) setFocus(pick, { openDrawer: false, updateUrl: false });
	else cy.fit(cy.elements(), 80);
});

// Viewport fullscreen toggle
let prevView: { zoom: number; pan: { x: number; y: number } } | null = null;
function applyVpToggleState(full: boolean) {
	const root = document.documentElement;
	root.classList.toggle("qm-full", full);
	if (vpToggle) {
		vpToggle.textContent = full ? "⤡" : "⤢";
		const label = full ? "Collapse to normal view" : "Expand to fullscreen";
		vpToggle.setAttribute("aria-label", label);
		vpToggle.title = label;
	}
	// Fit/relayout when entering fullscreen; also relayout when leaving for smooth transition
	if (full) {
		try {
			prevView = { zoom: cy.zoom(), pan: cy.pan() };
		} catch {
			prevView = null;
		}
		if (currentFocusId) {
			const node = cy.getElementById(currentFocusId);
			const depth = effectiveDepth();
			(layoutFocusAreaBlock360(node as any, depth) || Promise.resolve())
				.catch(() => layoutFocusArea(node as any, depth))
				.then(() => fitAroundNode(node as any, depth));
		} else {
			const vis = cy
				.elements()
				.filter(
					(e) =>
						!e.hasClass("hidden") && !e.hasClass("hidden-by-filter")
				);
			if (vis.nonempty && vis.nonempty()) cy.fit(vis, 40);
			else cy.fit(cy.elements(), 40);
		}
	} else {
		// On returning to in-page layout, recompute positions and fit to the reduced viewport
		if (currentFocusId) {
			const node = cy.getElementById(currentFocusId);
			const depth = effectiveDepth();
			(layoutFocusAreaBlock360(node as any, depth) || Promise.resolve())
				.catch(() => layoutFocusArea(node as any, depth))
				.then(() => fitAroundNode(node as any, depth));
		} else {
			const vis = cy
				.elements()
				.filter(
					(e) =>
						!e.hasClass("hidden") && !e.hasClass("hidden-by-filter")
				);
			if (vis.nonempty && vis.nonempty()) cy.fit(vis, 80);
			else cy.fit(cy.elements(), 80);
		}
		prevView = null;
	}
}
vpToggle?.addEventListener("click", () => {
	const full = !document.documentElement.classList.contains("qm-full");
	applyVpToggleState(full);
	setUrlExpanded(full, true);
});
// Note: In fullscreen, Escape should NOT exit fullscreen. It only closes
// the drawer (global handler below) or the explorer panel when focus is
// within it (handled on the sidepanel element).

// On load, sync the toggle button state with initial class
if (vpToggle) {
	const full = document.documentElement.classList.contains("qm-full");
	vpToggle.textContent = full ? "⤡" : "⤢";
	vpToggle.setAttribute(
		"aria-label",
		full ? "Collapse to normal view" : "Expand to fullscreen"
	);
	vpToggle.title = full ? "Collapse to normal view" : "Expand to fullscreen";
}

// drawer
const drawer = document.getElementById("drawer")!;
const closeBtn = document.getElementById("close-drawer")!;
const titleEl = document.getElementById("drawer-title") as HTMLAnchorElement;
const polTag = document.getElementById("drawer-pol-tag")!;
const ctxEl = document.getElementById("drawer-context")!;
const alsoText = document.getElementById("drawer-also-text") as HTMLElement;
const paliText = document.getElementById("drawer-pali-text") as HTMLElement;
const supWrap = document.getElementById("drawer-supported") as HTMLElement;
const supRow = document.getElementById("drawer-supported-row")!;
const leadsWrap = document.getElementById("drawer-leads") as HTMLElement;
const leadsRow = document.getElementById("drawer-leads-row")!;
const relWrap = document.getElementById("drawer-related") as HTMLElement;
const relRow = document.getElementById("drawer-related-row")!;
const guardWrap = document.getElementById("drawer-guarded") as HTMLElement;
const guardRow = document.getElementById("drawer-guarded-row")!;
const oppWrap = document.getElementById("drawer-opposite") as HTMLElement;
const oppRow = document.getElementById("drawer-opposite-row")!;
const discCards = document.getElementById("drawer-disc-cards")!;

// helpers mirrored from server utils (lightweight)
function transformId(id: string): string {
	if (typeof id !== "string") return "";
	const keyMap: Record<string, string> = {
		dhp: "The Path of Dhamma",
		mn: "Middle Length Discourses",
		ud: "Inspired Utterances",
		sn: "Linked Discourses",
		snp: "The Buddha's Ancient Discourses",
		an: "Numerical Discourses",
		iti: "As It Was Said",
		kp: "Minor Passages",
		anthologies: "Anthologies",
		"noble-truths-noble-path": "Noble Truths, Noble Path",
		"in-the-buddhas-words": "In the Buddha's Words",
	};
	// Strip hash and following characters
	id = id.split("#")[0];
	id = keyMap[id] || id;
	const transformed = id.replace(
		/([a-zA-Z]+)(\d+)/,
		(_: any, chars: string, digits: string) =>
			`${chars.toUpperCase()} ${digits}`
	);
	if (transformed === id) {
		const decoded = decodeURIComponent(id);
		return decoded.charAt(0).toUpperCase() + decoded.slice(1);
	}
	return transformed;
}
function updatePostLinks(container: HTMLElement) {
	const paliMode = localStorage.getItem("paliMode") === "true";
	const layout = localStorage.getItem("layout") || "interleaved";
	const links = container.querySelectorAll("a.post-link");
	links.forEach((link) => {
		const baseHref =
			(link as HTMLAnchorElement).getAttribute("data-base-href") ||
			(link as HTMLAnchorElement).href;
		const params = new URLSearchParams();
		if (paliMode) params.set("pli", "true");
		if (layout === "split") params.set("layout", layout);
		(link as HTMLAnchorElement).href = params.toString()
			? `${baseHref}?${params.toString()}`
			: baseHref || "";
	});
}

closeBtn.addEventListener("click", () => drawer.classList.remove("open"));

// Close drawer on Escape
document.addEventListener("keydown", (ev) => {
	if (ev.key === "Escape") {
		if (drawer?.classList?.contains("open"))
			drawer.classList.remove("open");
	}
});

function discourseCardHtml(d: any): string {
	const note = d.note ? String(d.note) : "";
	return `
		<div class="post-item relative flex flex-col w-full p-5 rounded-lg border border-[color:var(--surface-border)] bg-[var(--surface-elevated)] text-[var(--surface-ink)] shadow-md">
			<div class="flex items-start justify-between">
				<div class="flex items-start flex-grow">
					<div class="min-w-0 pr-4">
						<h2 class="text-base sm:text-lg font-semibold text-text mt-2 mb-2">
							<a href="/${
								d.id
							}" class="post-link text-gray-500 hover:text-link-color id mr-2 font-normal" data-base-href="/${
		d.id
	}">
								${transformId(d.id)}&nbsp;<span style="color:var(--text-color)">${
		d.title
	}</span>
							</a>
							${
								note
									? `<span class="px-2 py-1 text-xs rounded-full font-normal bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap inline-block align-bottom -translate-y-0.5 mt-1">${note}</span>`
									: ""
							}
						</h2>
					</div>
				</div>
			</div>
			<p class="mt-2 text-text text-sm sm:text-base">${(d.description || "").replace(
				/\[([^\]]+)\]\(([^)]+)\)/g,
				'<a href="$2" class="text-blue-600 hover:underline">$1</a>'
			)}</p>
		</div>`;
}

function renderDiscourseSections(list: any[]) {
	if (!Array.isArray(list) || !list.length) {
		discCards.innerHTML = `<div class="soft">No discourses found.</div>`;
		return;
	}
	const featured = list.filter((d) => d.isFeatured);
	const others = list.filter((d) => !d.isFeatured);
	const sections: string[] = [];
	const sectionHtml = (title: string, items: any[]) =>
		`${items.map(discourseCardHtml).join("")}`;
	if (featured.length)
		sections.push(sectionHtml("Featured discourses", featured));
	if (others.length) sections.push(sectionHtml("Further discourses", others));
	const html =
		sections.join("") || `<div class="soft">No discourses found.</div>`;
	discCards.innerHTML = html;
	updatePostLinks(discCards as HTMLElement);
}

function tagHtmlForQuality(slug: string): string {
	const s = String(slug);
	const isPos = RAW.positive?.includes(s);
	const isNeg = RAW.negative?.includes(s);
	const isTopic = TOPICS[s];
	const cls = isPos
		? "topic-tag positive"
		: isNeg
		? "topic-tag negative"
		: isTopic
		? "topic-tag topic"
		: "topic-tag neutral";
	const label = s
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
	return `<a href="?focus=${s}" class="${cls}" data-focus="${s}">${label}</a>`;
}

function renderDrawer(nodeId: string) {
	const n = cy.getElementById(nodeId);
	const id = n.id();
	const label = n.data("label");
	const pol = n.data("polarity");
	const meta = built.meta[id] || { lines: [] };
	const slug = slugify(id);
	titleEl.textContent = label;
	titleEl.href = `/on/${slug}`;

	// Check if it's a topic directly or via synonym
	let isTopic = !!TOPICS[slug];
	if (!isTopic) {
		// Check if this ID is a synonym for any topic
		const idLower = id.toLowerCase();
		for (const [topicSlug, topicData] of Object.entries(TOPICS)) {
			const tData = topicData as any;
			if (
				tData.synonyms &&
				tData.synonyms.some((s: string) => s.toLowerCase() === idLower)
			) {
				isTopic = true;
				break;
			}
		}
	}

	const isQuality =
		RAW.positive.includes(id) ||
		RAW.negative.includes(id) ||
		RAW.neutral.includes(id);

	let tagsHtml = "";
	if (isTopic) {
		tagsHtml += generateContentTagHtml("topic", { tooltipPos: "bottom" });
	}

	if (isQuality) {
		let qType = "neutral-quality";
		if (RAW.positive.includes(id)) qType = "bright-quality";
		else if (RAW.negative.includes(id)) qType = "negative-quality";

		tagsHtml += generateContentTagHtml(qType as any, {
			tooltipPos: "bottom",
		});
	}

	if (!tagsHtml) {
		const polType =
			pol === "positive"
				? "bright-quality"
				: pol === "negative"
				? "negative-quality"
				: pol === "topic"
				? "topic"
				: "neutral-quality";
		tagsHtml = generateContentTagHtml(polType as any, {
			tooltipPos: "bottom",
		});
	}
	polTag.innerHTML = tagsHtml;
	ctxEl.textContent = meta.context || "";

	// parse structured lists from lines
	const lines: string[] = meta.lines || [];
	const getList = (label: RegExp) => {
		return lines
			.map((l) => l.match(label))
			.filter(Boolean)
			.map((m: any) => m[1])
			.flatMap((body: string) =>
				body
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			);
	};
	const stripBrackets = (s: string) => s.replace(/[{}\[\]]/g, "").trim();
	const alsoKnown = lines
		.filter(
			(l) =>
				!/^(Supported by|Leads to|Related|Related to|Opposite|Context)\s*:/i.test(
					l
				) && !/^\[.*\]$/.test(l)
		)
		.map(stripBrackets)
		.filter(Boolean);
	const pali = lines
		.map((l) => l.match(/^\s*\[([^\]]+)\]\s*$/))
		.filter(Boolean)
		.flatMap((m: any) => m[1].split(",").map((s: string) => s.trim()))
		.filter(Boolean);
	const supported = getList(/^\s*Supported by\s*:\s*\{([^}]*)\}/i);
	const guardedBy = getList(/^\s*Guarded by\s*:\s*\{([^}]*)\}/i);
	const leadsTo = getList(/^\s*Leads to\s*:\s*\{([^}]*)\}/i);
	const related = getList(/^\s*(?:Related|Related to)\s*:\s*\{([^}]*)\}/i);
	const opposite = getList(/^\s*Opposite\s*:\s*\{([^}]*)\}/i);

	if (alsoText) {
		if (alsoKnown.length) {
			alsoText.style.display = "";
			alsoText.textContent = `Also known as: ${alsoKnown.join(", ")}`;
		} else {
			alsoText.style.display = "none";
		}
	}
	if (paliText) {
		if (pali.length) {
			paliText.style.display = "";
			paliText.textContent = `Pāli: ${pali.join(", ")}`;
		} else {
			paliText.style.display = "none";
		}
	}
	// Order: Related, Supported by, Guarded by, Leads to, Opposite. Hide row if empty
	const setRow = (wrap: HTMLElement, row: HTMLElement, arr: string[]) => {
		if (!wrap || !row) return;
		if (arr.length) {
			wrap.style.display = "";
			row.innerHTML = arr.map(tagHtmlForQuality).join("");
		} else {
			wrap.style.display = "none";
			row.innerHTML = "";
		}
	};
	setRow(relWrap, relRow as HTMLElement, related);
	setRow(supWrap, supRow as HTMLElement, supported);
	setRow(guardWrap, guardRow as HTMLElement, guardedBy);
	setRow(leadsWrap, leadsRow as HTMLElement, leadsTo);
	setRow(oppWrap, oppRow as HTMLElement, opposite);

	discCards.innerHTML = `<div class="soft">Loading…</div>`;
	drawer.classList.add("open");
	// Build locally for offline support using the embedded JSON in the page bundle
	import("../utils/discover-data")
		.then((mod) => {
			const items = mod.buildUnifiedContent({
				include: ["topics", "qualities"],
				filter: slug,
			});
			const item = (items || []).find((x: any) => {
				return (
					String(x.slug).toLowerCase() === slug.toLowerCase() ||
					String(x.slug).toLowerCase() ===
						slug.replaceAll("-", " ").toLowerCase()
				);
			});
			let disc = item?.discourses || [];
			// Sort discourses: featured first, then by priority/collection
			disc.sort((a: any, b: any) => {
				const fa = a.isFeatured ? 0 : 1;
				const fb = b.isFeatured ? 0 : 1;
				if (fa !== fb) return fa - fb;
				// Maintain original order for featured items if possible, or rely on buildUnifiedContent sort
				return 0;
			});
			renderDiscourseSections(disc);
		})
		.catch((e) => {
			console.error("Failed to build local discover data:", e);
			discCards.innerHTML = `<div class="soft">Could not load discourses.</div>`;
		});
}

// In-drawer tag navigation: focus graph instead of reloading (use capture to beat default handlers)
document.getElementById("drawer")?.addEventListener(
	"click",
	(ev) => {
		const el = (ev.target as HTMLElement)?.closest("a");
		if (!el) return;
		const a = el as HTMLAnchorElement;
		const slug =
			a.getAttribute("data-focus") ||
			(a.search && new URLSearchParams(a.search).get("focus")) ||
			undefined;
		const mouse = ev as MouseEvent;
		const altOpen = mouse?.metaKey || mouse?.ctrlKey || mouse?.button === 1;
		console.debug("[QM][drawer-click]", {
			slug,
			altOpen,
			href: a.getAttribute("href"),
		});
		if (slug && !altOpen) {
			ev.preventDefault();
			ev.stopPropagation();
			ev.stopImmediatePropagation?.();
			const n = findNodeByFocusKey(slug);
			if (n) {
				console.debug("[QM][drawer-click] focus", slug);
				setFocus(n, {
					openDrawer: true,
					updateUrl: true,
					pushUrl: true,
				});
			} else {
				console.debug("[QM][drawer-click] node not found for", slug);
			}
		}
	},
	true
);

// Helpers for details opening and panel expansion
function openDetailsFor(node?: cytoscape.NodeSingular | null) {
	try {
		const id = node?.id?.() || currentFocusId;
		if (!id) return;
		renderDrawer(id);
	} catch {}
}
function openExplorerPanel() {
	try {
		if (!sidepanel) return;
		if (!sidepanel.classList.contains("collapsed")) {
			// Already open: focus search immediately
			try {
				q?.focus({ preventScroll: true } as any);
				q?.select?.();
			} catch {}
			return;
		}
		sidepanel.classList.remove("collapsed");
		spCollapse?.setAttribute("aria-expanded", "true");
		if (spCollapse) spCollapse.textContent = "⟨";
		if (zoomBar) zoomBar.classList.add("horizontal");
		try {
			localStorage.setItem("qm.sidebar", "open");
		} catch {}
		focusSearchAfterExpand();
	} catch {}
}
function isEditableTarget(ev: KeyboardEvent) {
	const t = ev.target as HTMLElement | null;
	if (!t) return false;
	const tag = t.tagName?.toLowerCase();
	const editable = (t as any).isContentEditable;
	return (
		editable || tag === "input" || tag === "textarea" || tag === "select"
	);
}

// Tap behavior: single tap focuses only; double‑tap opens drawer; long‑press opens drawer
let lastTap = { id: null as string | null, t: 0 };
cy.on("tap", (e) => {
	// If the tap is on/near overlapping nodes, prefer the top-most non-dim node
	const pos =
		e.position ||
		(e.renderedPosition
			? cy
					.renderer()
					.projectIntoViewport(
						e.renderedPosition.x,
						e.renderedPosition.y
					)
			: null);
	// Fallback: if cytoscape already targeted a node, use that
	let target =
		e.target && (e.target as any).isNode && (e.target as any).isNode()
			? (e.target as any)
			: null;
	if (!target && pos) {
		const candidates = cy.elementsAtPoint(pos.x, pos.y).filter("node");
		if (candidates.nonempty()) {
			const visibleFirst = candidates.filter(
				(n) => !n.hasClass("hidden-by-filter") && !n.hasClass("hidden")
			);
			const nonDim = visibleFirst.filter((n) => !n.hasClass("dim"));
			target = (
				nonDim.nonempty()
					? nonDim[0]
					: visibleFirst.nonempty()
					? visibleFirst[0]
					: candidates[0]
			) as any;
		}
	}
	if (target && target.isNode && target.isNode()) {
		const now = performance.now();
		const id = target.id();
		// Double‑tap detection (within 350ms on same node)
		if (lastTap.id === id && now - lastTap.t < 350) {
			setFocus(target as any, {
				openDrawer: false,
				updateUrl: true,
				pushUrl: true,
			});
			openDetailsFor(target as any);
			lastTap = { id: null, t: 0 };
			return;
		}
		// Single tap → focus only
		setFocus(target as any, {
			openDrawer: false,
			updateUrl: true,
			pushUrl: true,
		});
		lastTap = { id, t: now };
	}
});

// Long‑press (taphold) opens drawer
cy.on("taphold", "node", (ev) => {
	const n = ev.target as any;
	setFocus(n, { openDrawer: false, updateUrl: true, pushUrl: true });
	openDetailsFor(n);
});

// Keyboard shortcuts: 'o' to open details, 'e' to open explorer/sidepanel
document.addEventListener("keydown", (ev) => {
	try {
		if (isEditableTarget(ev)) return;
		const k = ev.key?.toLowerCase?.();
		if (k === "o") {
			if (!currentFocusId) return;
			ev.preventDefault();
			openDetailsFor(null);
			return;
		}
		if (k === "e") {
			ev.preventDefault();
			openExplorerPanel();
			return;
		}
	} catch {}
});
