import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { gunzip, gunzipSync, gzipSync } from "node:zlib";

const gunzipAsync = promisify(gunzip);

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

/** Like decodeMaybeGzip, but inflates on the libuv threadpool. */
export async function decodeMaybeGzipAsync(
	filePath: string,
	raw: Buffer,
): Promise<string> {
	return filePath.endsWith(".gz")
		? (await gunzipAsync(raw)).toString("utf8")
		: raw.toString("utf8");
}
