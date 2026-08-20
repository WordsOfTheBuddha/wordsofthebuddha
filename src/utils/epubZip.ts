/**
 * Minimal ZIP writer for EPUB (mimetype must be first and uncompressed).
 */
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

export type ZipEntry = {
	name: string;
	data: string | Buffer;
	/** If true, store uncompressed (required for EPUB mimetype). */
	store?: boolean;
};

function u16(n: number): Buffer {
	const b = Buffer.alloc(2);
	b.writeUInt16LE(n);
	return b;
}

function u32(n: number): Buffer {
	const b = Buffer.alloc(4);
	b.writeUInt32LE(n >>> 0);
	return b;
}

function dosDateTime(d = new Date()): { time: number; date: number } {
	const time =
		Math.floor(d.getSeconds() / 2) |
		(d.getMinutes() << 5) |
		(d.getHours() << 11);
	const date =
		d.getDate() |
		((d.getMonth() + 1) << 5) |
		((d.getFullYear() - 1980) << 9);
	return { time, date };
}

/** Build a ZIP archive with entries in the given order. */
export function buildZip(entries: ZipEntry[]): Buffer {
	const { time, date } = dosDateTime();
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;

	for (const entry of entries) {
		const nameBuf = Buffer.from(entry.name, "utf8");
		const raw = Buffer.isBuffer(entry.data)
			? entry.data
			: Buffer.from(entry.data, "utf8");
		const method = entry.store ? 0 : 8;
		const compressed = entry.store
			? raw
			: deflateRawSync(raw, { level: 6 });
		const checksum = crc32(raw) >>> 0;

		const local = Buffer.concat([
			Buffer.from([0x50, 0x4b, 0x03, 0x04]),
			u16(20),
			u16(0),
			u16(method),
			u16(time),
			u16(date),
			u32(checksum),
			u32(compressed.length),
			u32(raw.length),
			u16(nameBuf.length),
			u16(0),
			nameBuf,
			compressed,
		]);

		const central = Buffer.concat([
			Buffer.from([0x50, 0x4b, 0x01, 0x02]),
			u16(20),
			u16(20),
			u16(0),
			u16(method),
			u16(time),
			u16(date),
			u32(checksum),
			u32(compressed.length),
			u32(raw.length),
			u16(nameBuf.length),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(0),
			u32(offset),
			nameBuf,
		]);

		locals.push(local);
		centrals.push(central);
		offset += local.length;
	}

	const centralDir = Buffer.concat(centrals);
	const eocd = Buffer.concat([
		Buffer.from([0x50, 0x4b, 0x05, 0x06]),
		u16(0),
		u16(0),
		u16(entries.length),
		u16(entries.length),
		u32(centralDir.length),
		u32(offset),
		u16(0),
	]);

	return Buffer.concat([...locals, centralDir, eocd]);
}

/** First local-file filename in a ZIP buffer (for EPUB mimetype checks). */
export function firstZipEntryName(buf: Buffer): string | null {
	if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) return null;
	const nameLen = buf.readUInt16LE(26);
	return buf.subarray(30, 30 + nameLen).toString("utf8");
}

function findEocdOffset(buf: Buffer): number {
	const min = Math.max(0, buf.length - 22 - 0xffff);
	for (let i = buf.length - 22; i >= min; i--) {
		if (buf.readUInt32LE(i) === 0x06054b50) return i;
	}
	return -1;
}

export function listZipEntryNames(buf: Buffer): string[] {
	const eocd = findEocdOffset(buf);
	if (eocd < 0) return [];
	const n = buf.readUInt16LE(eocd + 10);
	let p = buf.readUInt32LE(eocd + 16);
	const names: string[] = [];
	for (let i = 0; i < n; i++) {
		if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break;
		const nameLen = buf.readUInt16LE(p + 28);
		const extraLen = buf.readUInt16LE(p + 30);
		const commentLen = buf.readUInt16LE(p + 32);
		names.push(buf.subarray(p + 46, p + 46 + nameLen).toString("utf8"));
		p += 46 + nameLen + extraLen + commentLen;
	}
	return names;
}

export function extractZipEntry(buf: Buffer, name: string): Buffer | null {
	let p = 0;
	while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
		const method = buf.readUInt16LE(p + 8);
		const compSize = buf.readUInt32LE(p + 18);
		const nameLen = buf.readUInt16LE(p + 26);
		const extraLen = buf.readUInt16LE(p + 28);
		const entryName = buf.subarray(p + 30, p + 30 + nameLen).toString("utf8");
		const dataStart = p + 30 + nameLen + extraLen;
		const data = buf.subarray(dataStart, dataStart + compSize);
		if (entryName === name) {
			if (method === 0) return Buffer.from(data);
			if (method === 8) return inflateRawSync(data);
			return null;
		}
		p = dataStart + compSize;
	}
	return null;
}
