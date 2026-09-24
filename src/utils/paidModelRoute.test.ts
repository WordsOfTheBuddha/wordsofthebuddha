import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
	DEEPSEEK_V4_1_FLASH_MODEL,
	PAID_ROUTE_CATALOG_TTL_MS,
	PAID_ROUTE_EXPECTED_OUTPUT,
	PAID_ROUTE_GLM_MODEL,
	estimatePaidRouteInputTokens,
	formatPaidRouteLine,
	isEligiblePaidRoute,
	loadPaidRouteCatalog,
	paidRouteAttempts,
	paidRouteTokensInBudget,
	parseEndpointPayload,
	rankPaidRoutes,
	resetPaidRouteCatalogCacheForTests,
	type PaidRouteEndpoint,
} from "./paidModelRoute";

function perMillion(dollars: number): number {
	return dollars / 1_000_000;
}

function endpoint(
	partial: Partial<PaidRouteEndpoint> &
		Pick<PaidRouteEndpoint, "modelId" | "providerTag">,
): PaidRouteEndpoint {
	return {
		promptPerToken: perMillion(0.1),
		completionPerToken: perMillion(0.3),
		throughput: 40,
		uptime1d: 99.9,
		status: 0,
		...partial,
	};
}

const relace = endpoint({
	modelId: DEEPSEEK_V4_1_FLASH_MODEL,
	providerTag: "relace",
	promptPerToken: perMillion(0.06),
	completionPerToken: perMillion(0.32),
	throughput: 52,
});

const wafer = endpoint({
	modelId: DEEPSEEK_V4_1_FLASH_MODEL,
	providerTag: "wafer",
	promptPerToken: perMillion(0.059),
	completionPerToken: perMillion(0.6),
	throughput: 70,
});

const glmDeepInfra = endpoint({
	modelId: PAID_ROUTE_GLM_MODEL,
	providerTag: "deepinfra",
	promptPerToken: perMillion(0.075),
	completionPerToken: perMillion(0.25),
	throughput: 18,
});

describe("paid route eligibility", () => {
	it("requires uptime above 99, at least 10 tps, and a healthy status", () => {
		assert.equal(isEligiblePaidRoute(relace), true);
		assert.equal(isEligiblePaidRoute({ ...relace, uptime1d: 99 }), false);
		assert.equal(isEligiblePaidRoute({ ...relace, uptime1d: null }), false);
		assert.equal(isEligiblePaidRoute({ ...relace, throughput: 9 }), false);
		assert.equal(isEligiblePaidRoute({ ...relace, throughput: 0 }), false);
		assert.equal(isEligiblePaidRoute({ ...relace, status: -2 }), false);
		assert.equal(
			isEligiblePaidRoute({ ...relace, promptPerToken: 0 }),
			false,
		);
	});
});

describe("rankPaidRoutes", () => {
	const catalog = [wafer, glmDeepInfra, relace];

	it("prefers the cheaper mix for a typical ask", () => {
		const ranked = rankPaidRoutes(catalog, { inputTokens: 12_000, kind: "ask" });
		assert.equal(ranked[0]?.providerTag, "relace");
		assert.equal(ranked[0]?.modelId, DEEPSEEK_V4_1_FLASH_MODEL);
	});

	it("lets a large ask input change the winner toward cheaper prompt price", () => {
		const cheapPrompt = endpoint({
			modelId: DEEPSEEK_V4_1_FLASH_MODEL,
			providerTag: "cheap-prompt",
			promptPerToken: perMillion(0.02),
			completionPerToken: perMillion(0.5),
			throughput: 40,
		});
		const cheapCompletion = endpoint({
			modelId: PAID_ROUTE_GLM_MODEL,
			providerTag: "cheap-completion",
			promptPerToken: perMillion(0.1),
			completionPerToken: perMillion(0.1),
			throughput: 20,
		});
		const hosts = [cheapPrompt, cheapCompletion];
		assert.equal(
			rankPaidRoutes(hosts, { inputTokens: 2_000, kind: "ask" })[0]?.providerTag,
			"cheap-completion",
		);
		assert.equal(
			rankPaidRoutes(hosts, { inputTokens: 40_000, kind: "ask" })[0]
				?.providerTag,
			"cheap-prompt",
		);
	});

	it("picks a host within 20% of the cheapest when it is at least twice as fast", () => {
		const ranked = rankPaidRoutes(catalog, {
			inputTokens: 6_000,
			kind: "report",
		});
		assert.equal(PAID_ROUTE_EXPECTED_OUTPUT.report, 8_000);
		assert.equal(ranked[0]?.providerTag, "relace");
		assert.equal(
			rankPaidRoutes(catalog, { inputTokens: 20_000, kind: "revise" })[0]
				?.providerTag,
			"relace",
		);
	});

	it("upgrades a revise host only when the usual pick cannot finish in time", () => {
		const slow = endpoint({
			modelId: PAID_ROUTE_GLM_MODEL,
			providerTag: "slow",
			promptPerToken: perMillion(0.05),
			completionPerToken: perMillion(0.25),
			throughput: 19,
		});
		const fast = endpoint({
			modelId: DEEPSEEK_V4_1_FLASH_MODEL,
			providerTag: "fast",
			promptPerToken: perMillion(0.09),
			completionPerToken: perMillion(0.45),
			throughput: 60,
		});
		assert.ok(paidRouteTokensInBudget(150_000, 19) < 4_000);
		assert.equal(
			rankPaidRoutes([slow, fast], {
				inputTokens: 6_000,
				kind: "revise",
				budgetMs: 150_000,
			})[0]?.providerTag,
			"fast",
		);
		assert.equal(
			rankPaidRoutes([slow, fast], {
				inputTokens: 6_000,
				kind: "revise",
			})[0]?.providerTag,
			"slow",
		);
		const quickEnough = endpoint({
			...slow,
			providerTag: "quick-enough",
			throughput: 52,
		});
		assert.ok(paidRouteTokensInBudget(150_000, 52) >= 4_000);
		assert.equal(
			rankPaidRoutes([quickEnough, fast], {
				inputTokens: 6_000,
				kind: "revise",
				budgetMs: 150_000,
			})[0]?.providerTag,
			"quick-enough",
		);
	});

	it("keeps the cheapest host when the faster one is outside the cost band", () => {
		const slowCheap = endpoint({
			modelId: PAID_ROUTE_GLM_MODEL,
			providerTag: "slow",
			promptPerToken: perMillion(0.05),
			completionPerToken: perMillion(0.2),
			throughput: 12,
		});
		const fastDear = endpoint({
			modelId: DEEPSEEK_V4_1_FLASH_MODEL,
			providerTag: "fast",
			promptPerToken: perMillion(0.2),
			completionPerToken: perMillion(0.8),
			throughput: 80,
		});
		const ranked = rankPaidRoutes([slowCheap, fastDear], {
			inputTokens: 6_000,
			kind: "report",
		});
		assert.equal(ranked[0]?.providerTag, "slow");
	});

	it("keeps the cheapest host when the faster one is inside the band but under 2x", () => {
		const slowCheap = endpoint({
			modelId: PAID_ROUTE_GLM_MODEL,
			providerTag: "slow",
			promptPerToken: perMillion(0.05),
			completionPerToken: perMillion(0.25),
			throughput: 20,
		});
		const slightlyFaster = endpoint({
			modelId: DEEPSEEK_V4_1_FLASH_MODEL,
			providerTag: "bit-faster",
			promptPerToken: perMillion(0.055),
			completionPerToken: perMillion(0.27),
			throughput: 30,
		});
		const ranked = rankPaidRoutes([slowCheap, slightlyFaster], {
			inputTokens: 6_000,
			kind: "report",
		});
		assert.equal(ranked[0]?.providerTag, "slow");
	});
});

describe("paidRouteAttempts", () => {
	it("pins the winner, then one alternate, then GLM price sort", () => {
		const attempts = paidRouteAttempts([relace, wafer, glmDeepInfra], {
			inputTokens: 12_000,
			kind: "ask",
		});
		assert.equal(attempts[0]?.pinned, true);
		assert.deepEqual(attempts[0]?.provider, {
			only: ["relace"],
			allow_fallbacks: false,
		});
		assert.equal(attempts[1]?.pinned, true);
		assert.notEqual(
			attempts[1]?.provider && "only" in attempts[1].provider
				? attempts[1].provider.only[0]
				: "",
			"relace",
		);
		assert.deepEqual(attempts[2]?.provider, {
			sort: "price",
			allow_fallbacks: true,
		});
		assert.equal(attempts[2]?.model, PAID_ROUTE_GLM_MODEL);
		assert.match(
			formatPaidRouteLine(attempts[0]!),
			/kind=ask in=12000 model=deepseek\/deepseek-v4\.1-flash provider=relace est=0\.001040 tps=52/,
		);
	});

	it("falls back to GLM price sort when the catalog is missing or nobody qualifies", () => {
		const missing = paidRouteAttempts(null, { inputTokens: 100, kind: "ask" });
		assert.equal(missing.length, 1);
		assert.deepEqual(missing[0]?.provider, {
			sort: "price",
			allow_fallbacks: true,
		});
		const quiet = paidRouteAttempts(
			[{ ...relace, uptime1d: 90, throughput: 4 }],
			{ inputTokens: 100, kind: "report" },
		);
		assert.equal(quiet.length, 1);
		assert.equal(quiet[0]?.pinned, false);
	});
});

describe("parseEndpointPayload", () => {
	it("reads per-token prices, tag, uptime, and p50 throughput", () => {
		const rows = parseEndpointPayload(DEEPSEEK_V4_1_FLASH_MODEL, {
			data: {
				endpoints: [
					{
						tag: "relace",
						pricing: { prompt: "0.00000006", completion: "0.00000032" },
						uptime_last_1d: 100,
						throughput_last_30m: { p50: 52 },
						status: 0,
					},
					{ provider_name: "No Tag" },
				],
			},
		});
		assert.equal(rows.length, 1);
		assert.equal(rows[0]?.providerTag, "relace");
		assert.equal(rows[0]?.promptPerToken, 0.00000006);
		assert.equal(rows[0]?.throughput, 52);
	});
});

describe("estimatePaidRouteInputTokens", () => {
	it("uses message text length divided by 4", () => {
		assert.equal(
			estimatePaidRouteInputTokens([
				{ content: "a".repeat(10) },
				{ content: [{ type: "text", text: "b".repeat(6) }] },
			]),
			4,
		);
		assert.equal(estimatePaidRouteInputTokens([{ content: "" }]), 1);
	});
});

describe("loadPaidRouteCatalog", () => {
	afterEach(() => {
		resetPaidRouteCatalogCacheForTests();
	});

	it("caches a successful snapshot and does not cache a total failure", async () => {
		assert.equal(PAID_ROUTE_CATALOG_TTL_MS, 600_000);
		let calls = 0;
		const failing: typeof fetch = async () => {
			calls += 1;
			return new Response("no", { status: 503 });
		};
		assert.equal(await loadPaidRouteCatalog({ fetchImpl: failing }), null);
		assert.equal(calls, 3);
		assert.equal(await loadPaidRouteCatalog({ fetchImpl: failing }), null);
		assert.equal(calls, 6);

		calls = 0;
		const ok: typeof fetch = async () => {
			calls += 1;
			return Response.json({
				endpoints: [
					{
						tag: "relace",
						pricing: { prompt: "0.00000006", completion: "0.00000032" },
						uptime_last_1d: 100,
						throughput_last_30m: { p50: 52 },
						status: 0,
					},
				],
			});
		};
		const first = await loadPaidRouteCatalog({ fetchImpl: ok });
		assert.equal(first?.length, 3);
		assert.equal(calls, 3);
		const second = await loadPaidRouteCatalog({ fetchImpl: ok });
		assert.equal(second, first);
		assert.equal(calls, 3);
	});

	it("shares one in-flight fetch across concurrent callers", async () => {
		let calls = 0;
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const slow: typeof fetch = async () => {
			calls += 1;
			await gate;
			return Response.json({
				endpoints: [
					{
						tag: "relace",
						pricing: { prompt: "0.00000006", completion: "0.00000032" },
						uptime_last_1d: 100,
						throughput_last_30m: { p50: 52 },
					},
				],
			});
		};
		const pending = Promise.all([
			loadPaidRouteCatalog({ fetchImpl: slow }),
			loadPaidRouteCatalog({ fetchImpl: slow }),
		]);
		release();
		const [a, b] = await pending;
		assert.equal(a, b);
		assert.equal(calls, 3);
	});
});
