export const prerender = false;
import type { APIRoute } from "astro";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../../firebase/server";
import type { UserPreferences } from "../../../utils/theme";

export const GET: APIRoute = async ({ cookies }) => {
    const auth = getAuth(app);
    const db = getFirestore(app);

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
            showPali: userData['preferences.showPali']
        };

        return new Response(JSON.stringify(preferences), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        return new Response(error.message || "Something went wrong", { status: 400 });
    }
};
