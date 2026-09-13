import { sanitizeResearchReportHtml } from "./researchReportSanitize";

type MermaidApi = {
	initialize: (config: Record<string, unknown>) => void;
	render: (id: string, text: string) => Promise<{ svg: string }>;
};

let mermaidMod: MermaidApi | null = null;
let mermaidTheme = "";

function decodeReportEntities(value: string): string {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&");
}

async function loadMermaid(dark: boolean): Promise<MermaidApi> {
	if (!mermaidMod) {
		const mod = await import("mermaid");
		mermaidMod = (mod.default ?? mod) as MermaidApi;
	}
	const theme = dark ? "dark" : "neutral";
	if (mermaidTheme !== theme) {
		mermaidMod.initialize({
			startOnLoad: false,
			securityLevel: "strict",
			theme,
			flowchart: { htmlLabels: false },
		});
		mermaidTheme = theme;
	}
	return mermaidMod;
}

export async function mermaidSourceToSvg(
	source: string,
	dark = false,
): Promise<string> {
	const text = source.replace(/\r\n/g, "\n").trim();
	if (!text) return "";
	const mermaid = await loadMermaid(dark);
	const id = `ai-mmd-${Math.random().toString(36).slice(2, 10)}`;
	const { svg } = await mermaid.render(id, text);
	return sanitizeResearchReportHtml(svg, { allowStyle: true });
}

export async function replaceMermaidPlaceholdersWithSvg(
	html: string,
	dark = false,
): Promise<string> {
	const re = /<pre class="ai-report-mermaid"[^>]*>([\s\S]*?)<\/pre>/gi;
	const matches = [...html.matchAll(re)];
	if (matches.length === 0) return html;
	let out = html;
	for (const match of matches) {
		const source = decodeReportEntities(match[1] || "").trim();
		if (!source || !match[0]) continue;
		try {
			const svg = await mermaidSourceToSvg(source, dark);
			if (!svg) continue;
			out = out.replace(
				match[0],
				`<div class="ai-report-diagram">${svg}</div>`,
			);
		} catch {
			/* keep the mermaid source listing */
		}
	}
	return out;
}

export async function hydrateResearchReportMermaid(
	root: ParentNode,
): Promise<void> {
	const nodes = [
		...root.querySelectorAll<HTMLElement>(
			"[data-ai-mermaid]:not([data-ai-mermaid-done])",
		),
	];
	if (nodes.length === 0) return;
	const dark =
		typeof document !== "undefined" &&
		document.documentElement.classList.contains("dark");
	for (const node of nodes) {
		node.setAttribute("data-ai-mermaid-done", "1");
		const source = (node.textContent || "").trim();
		if (!source) continue;
		try {
			const svg = await mermaidSourceToSvg(source, dark);
			if (!svg) continue;
			const wrap = document.createElement("div");
			wrap.className = "ai-report-diagram";
			wrap.innerHTML = svg;
			node.replaceWith(wrap);
		} catch {
			node.setAttribute("data-ai-mermaid-done", "error");
		}
	}
}
