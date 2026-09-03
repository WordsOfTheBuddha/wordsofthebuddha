/**
 * Web Speech Recognition reports one SpeechRecognitionResult per phrase.
 * Interim results replace the last item; finals accumulate. Reading only
 * `results[results.length - 1]` looks like the earlier words were erased.
 */
export interface SpeechTranscriptResult {
	0?: { transcript?: string };
	isFinal?: boolean;
}

export function assembleSpeechTranscript(
	results: ArrayLike<SpeechTranscriptResult>,
): string {
	let text = "";
	for (let i = 0; i < results.length; i++) {
		text += results[i]?.[0]?.transcript || "";
	}
	return text.replace(/[ \t]+/g, " ").replace(/\n+/g, " ").trimStart();
}

export function lastSpeechResultIsFinal(
	results: ArrayLike<SpeechTranscriptResult>,
): boolean {
	if (results.length === 0) return false;
	return results[results.length - 1]?.isFinal === true;
}
