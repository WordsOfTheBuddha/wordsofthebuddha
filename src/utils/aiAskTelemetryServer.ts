import { FieldValue } from "firebase-admin/firestore";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import {
	logAiAskTelemetry,
	type AiAskTelemetryAskEvent,
	type AiAskTelemetryFeedbackEvent,
	type AiAskTelemetryReviewEvent,
	type AiAskTelemetryUserReviewEvent,
} from "./aiAskTelemetry";

const COLLECTION = "askTelemetry";

export type AiAskTelemetryEvent =
	| AiAskTelemetryAskEvent
	| AiAskTelemetryFeedbackEvent
	| AiAskTelemetryReviewEvent
	| AiAskTelemetryUserReviewEvent;

/** Best-effort: always log; persist to Firestore when Admin is configured. */
export async function recordAiAskTelemetry(
	event: AiAskTelemetryEvent,
): Promise<{ logged: boolean; stored: boolean }> {
	logAiAskTelemetry(event);
	if (!isFirebaseInitialized || !db) {
		return { logged: true, stored: false };
	}
	try {
		await db.collection(COLLECTION).add({
			...event,
			createdAt: FieldValue.serverTimestamp(),
		});
		return { logged: true, stored: true };
	} catch (error) {
		console.error("[ai-ask] firestore write failed", error);
		return { logged: true, stored: false };
	}
}
