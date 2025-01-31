export const prerender = false;
import type { APIRoute } from "astro";
import { getAuth } from "firebase-admin/auth";
import { app, db } from "../../../firebase/server";
import type { UserPreferences } from "../../../utils/theme";

export const GET: APIRoute = async ({ cookies }) => {
    const auth = getAuth(app);

    const sessionCookie = cookies.get("__session")?.value;
    if (!sessionCookie) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const decodedCookie = await auth.verifySessionCookie(sessionCookie);
        const userDoc = await db.collection('users').doc(decodedCookie.uid).get();
        const userData = userDoc.data() || {};

        // Transform flat structure back into nested object
        const preferences: UserPreferences = {
            theme: userData['preferences.theme'],
            showPali: userData['preferences.showPali'],
            enablePaliLookup: userData['preferences.enablePaliLookup'] || false
        };

        return new Response(JSON.stringify(preferences), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        return new Response(error.message || "Something went wrong", { status: 400 });
    }
};
