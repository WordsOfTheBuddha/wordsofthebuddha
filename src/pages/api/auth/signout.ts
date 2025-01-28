export const prerender = false;
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, redirect, cookies }) => {
    cookies.delete("__session", {
        path: "/",
    });

    const formData = await request.formData();
    const returnTo = formData.get("returnTo")?.toString() || "/";

    // Only allow redirects to local paths
    const returnPath = new URL(returnTo, request.url).pathname;
    return redirect(returnPath);
};