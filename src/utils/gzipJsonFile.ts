import { writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";

/** Write `path.json.gz` next to a generated JSON index for the serverless bundle. */
export async function writeGzipCompanion(
	jsonPath: string,
	json: string,
): Promise<void> {
	await writeFile(`${jsonPath}.gz`, gzipSync(Buffer.from(json, "utf8")));
}

export function decodeMaybeGzip(filePath: string, raw: Buffer): string {
	return filePath.endsWith(".gz")
		? gunzipSync(raw).toString("utf8")
		: raw.toString("utf8");
}
