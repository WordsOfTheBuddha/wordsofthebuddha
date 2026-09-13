import { FieldValue } from "firebase-admin/firestore";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import { clipResearchJobId } from "./aiAskResearchJob";
import {
	clipResearchReport,
	RESEARCH_REPORT_MAX_CHARS,
} from "./aiAskResearchReport";
import { normalizeAskShareSlug } from "./aiAskShare";
import {
	clipResearchVersionIndex,
	openingResearchVersionMeta,
	versionBodiesToKeep,
	type ResearchVersionMeta,
} from "./aiAskResearchRevise";

const jobBodyMemory = new Map<string, Map<number, string>>();
const shareBodyMemory = new Map<string, Map<number, string>>();

function jobMemKey(uid: string, jobId: string): string {
	return `${uid}:${jobId}`;
}

function jobsCol(uid: string) {
	return db!.collection("users").doc(uid).collection("researchJobs");
}

function jobVersionsCol(uid: string, jobId: string) {
	return jobsCol(uid).doc(jobId).collection("versions");
}

function shareVersionsCol(slug: string) {
	return db!.collection("askShares").doc(slug).collection("versions");
}

function clipBody(report: string): string {
	return clipResearchReport(report, RESEARCH_REPORT_MAX_CHARS);
}

function readMemory(
	store: Map<string, Map<number, string>>,
	key: string,
	n: number,
): string | null {
	const report = store.get(key)?.get(n);
	return typeof report === "string" && report.trim() ? report : null;
}

function writeMemory(
	store: Map<string, Map<number, string>>,
	key: string,
	n: number,
	report: string,
): void {
	const map = store.get(key) || new Map<number, string>();
	map.set(n, report);
	store.set(key, map);
}

export function resetResearchVersionMemoryForTests(): void {
	jobBodyMemory.clear();
	shareBodyMemory.clear();
}

export async function writeResearchVersionBody(options: {
	uid: string;
	jobId: string;
	n: number;
	report: string;
}): Promise<void> {
	const jobId = clipResearchJobId(options.jobId);
	const n = Math.floor(options.n);
	const report = clipBody(options.report);
	if (!options.uid || !jobId || n < 1 || !report) return;
	writeMemory(jobBodyMemory, jobMemKey(options.uid, jobId), n, report);
	if (!isFirebaseInitialized || !db) return;
	await jobVersionsCol(options.uid, jobId)
		.doc(String(n))
		.set(
			{
				n,
				report,
				updatedAt: FieldValue.serverTimestamp(),
			},
			{ merge: true },
		);
}

export async function readResearchVersionBody(options: {
	uid: string;
	jobId: string;
	n: number;
}): Promise<string | null> {
	const jobId = clipResearchJobId(options.jobId);
	const n = Math.floor(options.n);
	if (!options.uid || !jobId || n < 1) return null;
	const mem = readMemory(jobBodyMemory, jobMemKey(options.uid, jobId), n);
	if (mem) return mem;
	if (!isFirebaseInitialized || !db) return null;
	const snap = await jobVersionsCol(options.uid, jobId).doc(String(n)).get();
	if (!snap.exists) return null;
	const report = (snap.data() as { report?: unknown }).report;
	return typeof report === "string" && report.trim() ? clipBody(report) : null;
}

export async function pruneResearchVersionBodies(options: {
	uid: string;
	jobId: string;
	keep: readonly number[];
}): Promise<void> {
	const jobId = clipResearchJobId(options.jobId);
	if (!options.uid || !jobId) return;
	const keep = new Set(
		options.keep.filter((n) => Number.isFinite(n) && n >= 1),
	);
	const key = jobMemKey(options.uid, jobId);
	const mem = jobBodyMemory.get(key);
	if (mem) {
		for (const n of [...mem.keys()]) {
			if (!keep.has(n)) mem.delete(n);
		}
	}
	if (!isFirebaseInitialized || !db) return;
	const snaps = await jobVersionsCol(options.uid, jobId).listDocuments();
	await Promise.all(
		snaps.map(async (ref) => {
			const n = Math.floor(Number(ref.id));
			if (!keep.has(n)) await ref.delete();
		}),
	);
}

export async function seedResearchOpeningVersion(options: {
	uid: string;
	jobId: string;
	report: string;
	existingIndex?: unknown;
	at?: number;
}): Promise<ResearchVersionMeta[] | null> {
	const existing = clipResearchVersionIndex(options.existingIndex);
	if (existing.length > 0) return null;
	const report = clipBody(options.report);
	if (!report) return null;
	const index = [openingResearchVersionMeta(options.at ?? Date.now())];
	await writeResearchVersionBody({
		uid: options.uid,
		jobId: options.jobId,
		n: 1,
		report,
	});
	await pruneResearchVersionBodies({
		uid: options.uid,
		jobId: options.jobId,
		keep: versionBodiesToKeep(index),
	});
	return index;
}

export async function writeShareVersionBody(options: {
	slug: string;
	n: number;
	report: string;
}): Promise<void> {
	const slug = normalizeAskShareSlug(options.slug) || "";
	const n = Math.floor(options.n);
	const report = clipBody(options.report);
	if (!slug || n < 1 || !report) return;
	writeMemory(shareBodyMemory, slug, n, report);
	if (!isFirebaseInitialized || !db) return;
	await shareVersionsCol(slug)
		.doc(String(n))
		.set(
			{
				n,
				report,
				updatedAt: FieldValue.serverTimestamp(),
			},
			{ merge: true },
		);
}

export async function readShareVersionBody(options: {
	slug: string;
	n: number;
}): Promise<string | null> {
	const slug = normalizeAskShareSlug(options.slug) || "";
	const n = Math.floor(options.n);
	if (!slug || n < 1) return null;
	const mem = readMemory(shareBodyMemory, slug, n);
	if (mem) return mem;
	if (!isFirebaseInitialized || !db) return null;
	const snap = await shareVersionsCol(slug).doc(String(n)).get();
	if (!snap.exists) return null;
	const report = (snap.data() as { report?: unknown }).report;
	return typeof report === "string" && report.trim() ? clipBody(report) : null;
}

export async function copyJobVersionsToShare(options: {
	uid: string;
	jobId: string;
	slug: string;
	index: readonly ResearchVersionMeta[];
	currentReport: string;
}): Promise<void> {
	const keep = versionBodiesToKeep(options.index);
	const currentN = keep[keep.length - 1] || 1;
	await Promise.all(
		keep.map(async (n) => {
			const report =
				n === currentN
					? clipBody(options.currentReport)
					: (await readResearchVersionBody({
							uid: options.uid,
							jobId: options.jobId,
							n,
						})) || "";
			if (!report) return;
			await writeShareVersionBody({ slug: options.slug, n, report });
		}),
	);
}
