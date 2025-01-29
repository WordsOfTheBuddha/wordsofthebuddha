export const prerender = false;
import type { APIRoute } from "astro";
import { getAuth } from "firebase-admin/auth";
import { app } from "../../../firebase/server";

export const POST: APIRoute = async ({ request, cookies }) => {
    const auth = getAuth(app);

    const sessionCookie = cookies.get("__session")?.value;
    if (!sessionCookie) {
        return new Response("Unauthorized", { status: 401 });
    }

    let formData;
    try {
        formData = await request.formData();
        const data = Object.fromEntries(formData.entries());

        const displayName = data.displayName?.toString();
        const email = data.email?.toString();

        if (!displayName || !email) {
            return new Response("Missing required fields", { status: 400 });
        }

        const decodedCookie = await auth.verifySessionCookie(sessionCookie);

        // Update user profile
        await auth.updateUser(decodedCookie.uid, {
            displayName,
            email
        });

        return new Response(JSON.stringify({
            success: true,
            user: { displayName, email }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        return new Response(
            error.message || "Something went wrong",
            { status: 400 }
        );
    }
};
