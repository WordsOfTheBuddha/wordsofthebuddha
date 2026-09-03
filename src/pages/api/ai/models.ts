export const prerender = false;
import type { APIRoute } from "astro";
import {
	fetchFreeOpenRouterModels,
	getAskPickerDefaultModel,
	getOpenRouterApiKey,
	shouldShowAiModelPicker,
} from "../../../utils/openrouter";

export const GET: APIRoute = async () => {
	try {
		const models = await fetchFreeOpenRouterModels();
		return new Response(
			JSON.stringify({
				success: true,
				configured: Boolean(getOpenRouterApiKey()),
				defaultModel: getAskPickerDefaultModel(),
				showModelPicker: shouldShowAiModelPicker(),
				models,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=300",
				},
			},
		);
	} catch (error) {
		console.error("[ai/models]", error);
		return new Response(
			JSON.stringify({
				success: false,
				configured: Boolean(getOpenRouterApiKey()),
				defaultModel: getAskPickerDefaultModel(),
				showModelPicker: shouldShowAiModelPicker(),
				models: [],
				error: "Could not list free models.",
			}),
			{ status: 502, headers: { "Content-Type": "application/json" } },
		);
	}
};
