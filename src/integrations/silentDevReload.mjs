import { join } from "node:path";

function isFullReloadPayload(payload) {
	const msg =
		typeof payload === "string"
			? (() => {
					try {
						return JSON.parse(payload);
					} catch {
						return null;
					}
				})()
			: payload;
	return msg?.type === "full-reload";
}

function patchReloadSender(server, send, notify) {
	if (!send || send.__silentDevReloadPatched) return send;

	const upstream = send.bind(server);
	const patched = function patchedSend(payload, ...rest) {
		if (isFullReloadPayload(payload)) {
			notify();
			return;
		}
		return upstream(payload, ...rest);
	};
	patched.__silentDevReloadPatched = true;
	return patched;
}

function installReloadSuppression(server) {
	let notifyTimer = null;
	const notify = () => {
		if (notifyTimer) clearTimeout(notifyTimer);
		notifyTimer = setTimeout(() => {
			notifyTimer = null;
			server.config.logger.info(
				"Content updated — reload the page when ready",
				{ timestamp: true },
			);
		}, 500);
	};

	const clientHot = server.environments?.client?.hot;
	if (clientHot?.send) {
		clientHot.send = patchReloadSender(server, clientHot.send, notify);
	}

	if (server.ws?.send) {
		server.ws.send = patchReloadSender(server, server.ws.send, notify);
	}
}

/**
 * Dev-only: keep processing content/file changes on the server, but do not push
 * browser reloads over HMR. Reload manually when you want to see updates.
 *
 * Astro 7 still emits `full-reload` over the client hot channel when content
 * changes, so `server.hmr: false` alone is not enough.
 *
 * Set ASTRO_HOT_RELOAD=1 to restore automatic full-page reload on save.
 */
export function silentDevReload() {
	const hotReloadEnabled = process.env.ASTRO_HOT_RELOAD === "1";

	return {
		name: "silent-dev-reload",
		hooks: {
			"astro:config:setup": ({ updateConfig, command }) => {
				if (command !== "serve" || hotReloadEnabled) return;

				updateConfig({
					vite: {
						server: { hmr: false },
						plugins: [
							{
								name: "silent-dev-reload-suppress",
								enforce: "post",
								configureServer(server) {
									// Run after Astro patches client.hot.send in createViteLoader.
									return () => {
										installReloadSuppression(server);
									};
								},
							},
						],
					},
				});
			},
		},
	};
}

export function silentDevReloadViteConfig() {
	if (process.env.ASTRO_HOT_RELOAD === "1") return {};
	return { server: { hmr: false } };
}
