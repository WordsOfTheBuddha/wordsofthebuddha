export const prerender = false;
import type { APIRoute } from "astro";
import { app, db } from "../../../firebase/server";
import { getAuth } from "firebase-admin/auth";

export const POST: APIRoute = async ({ params, request, cookies }) => {
    try {
        const auth = getAuth(app);
        const sessionCookie = cookies.get("__session")?.value;

        if (!sessionCookie) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const decodedCookie = await auth.verifySessionCookie(sessionCookie);
        const { isActive } = await request.json();
        const slug = params.slug;
        if (!slug) {
            return new Response(JSON.stringify({ error: "Missing slug param" }), { status: 400 });
        }

        const saveRef = db
            .collection('users')
            .doc(decodedCookie.uid)
            .collection('saves')
            .doc(slug);

        if (isActive) {
            await saveRef.set({
                savedAt: new Date()
            });
        } else {
            await saveRef.delete();
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200
        });
    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500
        });
    }
};
