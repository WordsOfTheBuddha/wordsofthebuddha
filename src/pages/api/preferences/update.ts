export const prerender = false;
import type { APIRoute } from "astro";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../../firebase/server";
import type { Theme } from "../../../utils/theme";

export const POST: APIRoute = async ({ request, cookies }) => {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const sessionCookie = cookies.get("__session")?.value;
    if (!sessionCookie) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const formData = await request.formData();
        const theme = formData.get("theme")?.toString() as Theme;

        if (!theme || !['light', 'dark'].includes(theme)) {
            return new Response("Invalid theme value", { status: 400 });
        }

        const decodedCookie = await auth.verifySessionCookie(sessionCookie);
        await db.collection('users').doc(decodedCookie.uid).set({
            preferences: { theme }
        }, { merge: true });

        return new Response(JSON.stringify({ theme }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        return new Response(error.message || "Something went wrong", { status: 400 });
    }
};
