/** Client-safe JSON object scrape. Keep Node-only imports out of this file. */
export function extractJsonObject(text: string): unknown {
	const stripped = text
		.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
		.replace(/```(?:json)?/gi, "")
		.trim();
	const start = stripped.indexOf("{");
	const end = stripped.lastIndexOf("}");
	if (start === -1 || end <= start) return null;
	try {
		return JSON.parse(stripped.slice(start, end + 1));
	} catch {
		return null;
	}
}
