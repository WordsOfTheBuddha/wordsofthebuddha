export const prerender = false;
import type { APIRoute } from "astro";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../../firebase/server";

// Preference validators and their document paths
const preferenceValidators = {
    theme: (value: string) => {
        if (!['light', 'dark'].includes(value)) {
            throw new Error("Theme must be 'light' or 'dark'");
        }
        return value as 'light' | 'dark';
    },
    showPali: (value: string) => {
        const boolValue = value.toLowerCase() === 'true';
        return boolValue;
    },
    fontSize: (value: string) => {
        if (!['large', 'larger'].includes(value)) {
            throw new Error("Font size must be 'large' or 'larger'");
        }
        return value as 'large' | 'larger';
    },
    enablePaliLookup: (value: string) => {
        const boolValue = value.toLowerCase() === 'true';
        return boolValue;
    }
} as const;

export const POST: APIRoute = async ({ request, cookies }) => {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const sessionCookie = cookies.get("__session")?.value;
    if (!sessionCookie) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const formData = await request.formData();
        const updates: Record<string, any> = {};
        let hasValidUpdate = false;

        // Process each known preference key
        (Object.keys(preferenceValidators) as Array<keyof typeof preferenceValidators>).forEach(key => {
            const value = formData.get(key)?.toString();
            if (value !== undefined && value !== null) {
                try {
                    updates[`preferences.${key}`] = preferenceValidators[key](value);
                    hasValidUpdate = true;
                } catch (error: any) {
                    throw new Error(`Invalid ${key}: ${error.message}`);
                }
            }
        });

        if (!hasValidUpdate) {
            return new Response("No valid preference updates provided", { status: 400 });
        }

        const decodedCookie = await auth.verifySessionCookie(sessionCookie);
        await db.collection('users')
            .doc(decodedCookie.uid)
            .set(updates, { merge: true });

        return new Response(JSON.stringify(updates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        return new Response(error.message || "Something went wrong", { status: 400 });
    }
};
