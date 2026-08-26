/** Minimal SW container surface used by the offline download handshake. */
export type ServiceWorkerControlHost = {
	controller?: { postMessage: (message: unknown) => void } | null;
	getRegistration?: () => Promise<
		| {
				active?: { postMessage: (message: unknown) => void } | null;
		  }
		| null
		| undefined
	>;
	addEventListener?: (
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	) => void;
};

/**
 * Wait until this page is controlled by a service worker, or until `timeoutMs`.
 *
 * Must not await `serviceWorker.ready`: with no registration (astro dev
 * unregisters workers) that promise never settles, so a timeout after it
 * would never run.
 */
export async function waitForServiceWorkerControl(
	sw: ServiceWorkerControlHost | null | undefined,
	timeoutMs = 5000,
): Promise<boolean> {
	if (sw?.controller) return true;
	try {
		sw?.getRegistration?.()
			.then((reg) => {
				if (reg?.active && !sw?.controller) {
					reg.active.postMessage({ type: "PING" });
				}
			})
			.catch(() => {});
	} catch {}
	return new Promise((resolve) => {
		let done = false;
		const finish = (ok: boolean) => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			resolve(ok);
		};
		const timer = setTimeout(() => finish(!!sw?.controller), timeoutMs);
		sw?.addEventListener?.(
			"controllerchange",
			() => finish(true),
			{ once: true } as AddEventListenerOptions,
		);
	});
}
