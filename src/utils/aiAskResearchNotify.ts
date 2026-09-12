export const RESEARCH_NOTIFY_TITLE = "Your research is ready";

export function researchNotifyBody(question: string): string {
	return question.replace(/\s+/g, " ").trim().slice(0, 140);
}

export function researchNotifyUrl(jobId: string): string {
	const id = jobId.replace(/\s+/g, "").trim();
	return `/search?mode=research&research=${encodeURIComponent(id)}`;
}

export async function requestResearchNotifyPermission(): Promise<boolean> {
	if (typeof Notification === "undefined") return false;
	if (Notification.permission === "granted") return true;
	if (Notification.permission === "denied") return false;
	try {
		const result = await Notification.requestPermission();
		return result === "granted";
	} catch {
		return false;
	}
}

export async function notifyResearchReady(input: {
	question: string;
	jobId: string;
}): Promise<void> {
	if (typeof Notification === "undefined") return;
	if (Notification.permission !== "granted") return;
	const title = RESEARCH_NOTIFY_TITLE;
	const body = researchNotifyBody(input.question);
	const url = researchNotifyUrl(input.jobId);
	const tag = `research-${input.jobId}`;
	try {
		const registration = await navigator.serviceWorker?.ready;
		if (registration?.showNotification) {
			await registration.showNotification(title, {
				body,
				tag,
				data: { url },
			});
			return;
		}
	} catch {
		/* fall through to page Notification */
	}
	try {
		const note = new Notification(title, { body, tag });
		note.onclick = () => {
			window.focus();
			if (url) window.location.assign(url);
			note.close();
		};
	} catch {
		/* ignore */
	}
}

export function researchHistoryStatusLabel(entry: {
	research?: boolean;
	researchPending?: boolean;
	researchUnread?: boolean;
}): string {
	if (!entry.research) return "";
	if (entry.researchPending) return "Researching…";
	if (entry.researchUnread) return "Research ready";
	return "";
}
