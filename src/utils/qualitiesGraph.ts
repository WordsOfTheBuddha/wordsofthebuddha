// src/utils/qualitiesGraph.ts
export type Polarity = "positive" | "negative" | "neutral";
export type EdgeType = "supportedBy" | "leadsTo" | "related" | "opposite" | "guardedBy";

export interface QualityGraphNode {
    data: {
        id: string;            // e.g. "humility"
        label: string;         // "Humility"
        slug: string;          // "humility" (kebab)
        polarity: Polarity;
    };
}

export interface QualityGraphEdge {
    data: {
        id: string;
        source: string;
        target: string;
        type: EdgeType;
        dir?: boolean; // true for directed edges (supportedBy, leadsTo, guardedBy)
    };
}

export interface BuildResult {
    nodes: QualityGraphNode[];
    edges: QualityGraphEdge[];
    meta: Record<string, {
        lines: string[];       // raw lines from synonyms[]
        context?: string;      // "Context: …"
    }>;
    searchIndex: Record<string, Set<string>>; // token -> nodeIds
}

const TYPES: EdgeType[] = ["supportedBy", "leadsTo", "related", "opposite", "guardedBy"];

const LINE_LABEL: Record<EdgeType, string> = {
    supportedBy: "Supported by",
    leadsTo: "Leads to",
    related: "Related",     // accepts "Related" or "Related to"
    opposite: "Opposite",
    guardedBy: "Guarded by",
};

export function slugify(s: string): string {
    return s
        .trim()
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

function ucWords(s: string) {
    return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

function parseList(line: string, type: EdgeType): string[] {
    const label = type === "related" ? "(?:Related|Related to)" : LINE_LABEL[type];
    const rx = new RegExp(`^\\s*${label}\\s*:?\\s*\\{([^}]*)\\}\\s*$`, "i");
    const m = rx.exec(line);
    if (!m) return [];
    return m[1].split(",").map((x) => x.trim()).filter(Boolean);
}

function isRelationLine(line: string): boolean {
    const checks = [
        /^\s*Supported by\s*:/i,
        /^\s*Leads to\s*:/i,
        /^\s*(?:Related|Related to)\s*:/i,
        /^\s*Opposite\s*:/i,
        /^\s*Guarded by\s*:/i,
    ];
    return checks.some((rx) => rx.test(line));
}

export function buildGraphFromQualities(qualities: any): BuildResult {
    const pol: Record<string, Polarity> = {};
    for (const id of qualities.positive || []) pol[id] = "positive";
    for (const id of qualities.negative || []) pol[id] = "negative";
    for (const id of qualities.neutral || []) pol[id] = "neutral";

    const nodes: QualityGraphNode[] = [];
    const nodeSet = new Set<string>();
    const meta: BuildResult["meta"] = {};
    const edges: QualityGraphEdge[] = [];
    const edgeKeys = new Set<string>(); // to dedupe for non-causal (related/opposite/guardedBy)
    // For causal relationships (supportedBy/leadsTo) we unify into a single directed edge per pair
    // Keyed by `${supporter}->${supported}` (i.e., X supports Y OR X leads to Y both map to X->Y)
    const causalMap = new Map<string, { source: string; target: string; type: 'supportedBy' | 'leadsTo' }>();

    function ensureNode(id: string) {
        if (!id) return;
        if (nodeSet.has(id)) return;
        nodeSet.add(id);
        nodes.push({
            data: {
                id,
                label: ucWords(id),
                slug: slugify(id),
                polarity: pol[id] || "neutral",
            },
        });
    }

    // base nodes from polarity lists
    Object.keys(pol).forEach(ensureNode);

    // edges + meta from synonyms section
    const syn = qualities.qualities || {};
    for (const [src, arr] of Object.entries(syn) as [string, string[]][]) {
        ensureNode(src);
        const lines = Array.isArray(arr) ? arr : [];
        meta[src] = { lines };

        // Context extraction
        const ctxLine = lines.find((l) => /^Context\s*:/.test(l));
        if (ctxLine) meta[src].context = ctxLine.replace(/^Context\s*:\s*/i, "").trim();

        for (const line of lines) {
            for (const t of TYPES) {
                const targets = parseList(line, t);
                if (!targets.length) continue;

                for (const rawDst of targets) {
                    const dst = rawDst.replace(/[{}]/g, "").trim();
                    if (!dst) continue;
                    ensureNode(dst);

                    if (t === "guardedBy") {
                        const key = `${dst}->${src}:${t}`;
                        if (!edgeKeys.has(key)) {
                            edgeKeys.add(key);
                            edges.push({ data: { id: key, source: dst, target: src, type: t, dir: true } });
                        }
                    } else if (t === "supportedBy") {
                        const supporter = dst; // B supports A => B -> A
                        const supported = src;
                        const k = `${supporter}->${supported}`;
                        const existing = causalMap.get(k);
                        if (!existing) causalMap.set(k, { source: supporter, target: supported, type: 'supportedBy' });
                        else if (existing.type === 'leadsTo') causalMap.set(k, { source: supporter, target: supported, type: 'supportedBy' });
                    } else if (t === "leadsTo") {
                        const supporter = src; // A leads to B => A -> B (same direction as supporter->supported)
                        const supported = dst;
                        const k = `${supporter}->${supported}`;
                        const existing = causalMap.get(k);
                        if (!existing) causalMap.set(k, { source: supporter, target: supported, type: 'leadsTo' });
                        // if supportedBy already present, keep supportedBy as preferred
                    } else {
                        // undirected-ish: one canonical direction (a<b ? a->b : b->a), styled without arrows
                        const [a, b] = [src, dst].sort((x, y) => (x < y ? -1 : 1));
                        const key = `${a}<->${b}:${t}`;
                        if (!edgeKeys.has(key)) {
                            edgeKeys.add(key);
                            edges.push({ data: { id: key, source: a, target: b, type: t, dir: false } });
                        }
                    }
                }
            }
        }
    }

    // Emit unified causal edges
    for (const [k, e] of causalMap.entries()) {
        const id = `${e.source}->${e.target}:${e.type}`;
        edges.push({ data: { id, source: e.source, target: e.target, type: e.type, dir: true } });
    }

    // naive search index (label + non-relation synonym lines + context)
    const searchIndex: BuildResult["searchIndex"] = {};
    function addToken(tok: string, id: string) {
        const k = tok.toLowerCase();
        if (!k) return;
        (searchIndex[k] ??= new Set()).add(id);
    }
    for (const n of nodes) {
        addToken(n.data.label, n.data.id);
        const m = meta[n.data.id];
        if (!m) continue;
        for (const line of m.lines) {
            if (isRelationLine(line)) continue;
            addToken(line.replace(/\[.*\]/g, ""), n.data.id);
        }
        if (m.context) addToken(m.context, n.data.id);
    }

    return { nodes, edges, meta, searchIndex };
}

export function buildCytoscapeElements(qualities: any) {
    const built = buildGraphFromQualities(qualities);
    return { elements: { nodes: built.nodes, edges: built.edges }, meta: built.meta };
}

export function buildSearchIndex(qualities: any) {
    const built = buildGraphFromQualities(qualities);
    // Structure docs suitable for Fuse.js
    const docs = built.nodes.map((n) => {
        const m = built.meta[n.data.id] || { lines: [] as string[] };
        const lines = (m.lines || []).filter((l) => !isRelationLine(l));
        return {
            id: n.data.id,
            label: n.data.label,
            context: m.context || "",
            lines,
            slug: n.data.slug,
            polarity: n.data.polarity as Polarity,
        };
    });
    return { docs, meta: built.meta };
}