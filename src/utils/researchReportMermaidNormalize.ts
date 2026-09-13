/** Quote flowchart node labels that mermaid would otherwise split or reject. */

export function isMermaidErrorSvg(svg: string): boolean {
	return /Syntax error in text/i.test(svg);
}

/** Make LLM mermaid less likely to hit `;` / `<br/>` parse traps in node labels. */
export function normalizeMermaidSource(source: string): string {
	return source.replace(/\r\n/g, "\n").replace(
		/(\b[A-Za-z][\w-]*)(\s*)\[(?!\[)([^\]]*)\]/g,
		(_full, id: string, space: string, label: string) => {
			let text = label.replace(/<br\s*\/?>/gi, "\n");
			const quoted =
				text.startsWith('"') && text.endsWith('"') && text.length >= 2;
			if (quoted) {
				text = text.slice(1, -1).replace(/#quot;/gi, '"');
			}
			const next =
				!quoted && !/[\n;<>]/.test(text)
					? `[${label}]`
					: `["${text.replace(/"/g, "#quot;")}"]`;
			return `${id}${space}${next}`;
		},
	);
}

export function removeMermaidTempElements(id: string): void {
	if (typeof document === "undefined" || !/^[A-Za-z][\w-]*$/.test(id)) return;
	for (const sel of [`#${id}`, `#d${id}`, `#i${id}`]) {
		document.querySelector(sel)?.remove();
	}
}
