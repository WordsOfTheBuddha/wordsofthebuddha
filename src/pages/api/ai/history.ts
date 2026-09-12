export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUser } from "../../../middleware/auth";
import {
	loadUserAskHistory,
	removeUserAskHistoryByJobIds,
	removeUserAskHistoryByQuestions,
	syncUserAskHistory,
	upsertUserAskHistoryEntry,
} from "../../../utils/aiAskHistoryServer";
import {
	isAskHistoryDocumentSizeError,
	sanitizeAskHistoryEntries,
	sanitizeAskHistoryEntry,
	type AiAskSessionEntry,
} from "../../../utils/aiAskSession";

function historyResponse(
	body: Record<string, unknown>,
	status = 200,
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function historyWriteErrorResponse(error: unknown): Response {
	console.warn(
		"[ai/history]",
		error instanceof Error ? error.message : error,
	);
	const tooLarge = isAskHistoryDocumentSizeError(error);
	return historyResponse(
		{
			success: false,
			error: tooLarge
				? "History is too large to save."
				: "Could not save history.",
		},
		tooLarge ? 413 : 500,
	);
}

export const GET: APIRoute = async ({ cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies });
	if (!user) {
		return historyResponse({ success: true, signedIn: false, entries: [] });
	}
	try {
		const entries = await loadUserAskHistory(user);
		return historyResponse({ success: true, signedIn: true, entries });
	} catch (error) {
		return historyWriteErrorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies });
	if (!user) {
		return historyResponse(
			{ success: false, error: "Sign in required." },
			401,
		);
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return historyResponse(
			{ success: false, error: "Invalid JSON body." },
			400,
		);
	}

	try {
		if (body.action === "sync") {
			const local = sanitizeAskHistoryEntries(body.entries);
			const entries = await syncUserAskHistory(user, local);
			return historyResponse({ success: true, signedIn: true, entries });
		}

		if (body.action === "delete") {
			const researchJobId =
				typeof body.researchJobId === "string"
					? body.researchJobId.trim()
					: "";
			if (researchJobId) {
				const entries = await removeUserAskHistoryByJobIds(user, [
					researchJobId,
				]);
				return historyResponse({ success: true, signedIn: true, entries });
			}
			const questions = Array.isArray(body.questions)
				? body.questions.filter(
						(item): item is string => typeof item === "string",
					)
				: typeof body.question === "string"
					? [body.question]
					: [];
			if (questions.length === 0) {
				return historyResponse(
					{
						success: false,
						error: "A question is required to delete.",
					},
					400,
				);
			}
			const research = body.research === true;
			const entries = await removeUserAskHistoryByQuestions(
				user,
				questions,
				{ research },
			);
			return historyResponse({ success: true, signedIn: true, entries });
		}

		const entry = sanitizeAskHistoryEntry(body.entry);
		if (!entry) {
			return historyResponse(
				{ success: false, error: "Invalid history entry." },
				400,
			);
		}

		const replaceQuestions = Array.isArray(body.replaceQuestions)
			? body.replaceQuestions.filter(
					(item): item is string => typeof item === "string",
				)
			: [];
		const replaceJobIds = Array.isArray(body.replaceJobIds)
			? body.replaceJobIds.filter(
					(item): item is string => typeof item === "string",
				)
			: [];
		const entries: AiAskSessionEntry[] = await upsertUserAskHistoryEntry(
			user,
			entry,
			replaceQuestions,
			replaceJobIds,
		);
		return historyResponse({ success: true, signedIn: true, entries });
	} catch (error) {
		return historyWriteErrorResponse(error);
	}
};
