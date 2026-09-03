export const prerender = false;
import type { APIRoute } from "astro";
import { safeAuthReturnUrl } from "../../../utils/authReturnTo";

export const POST: APIRoute = async ({ request, redirect, cookies }) => {
	cookies.delete("__session", {
		path: "/",
	});

	const formData = await request.formData();
	const returnTo = formData.get("returnTo")?.toString() || "/";
	const returnUrl = safeAuthReturnUrl(returnTo, request.url, "/");
	return redirect(`${returnUrl.pathname}${returnUrl.search}`);
};
