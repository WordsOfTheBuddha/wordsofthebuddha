export const prerender = false;
import type { APIRoute } from "astro";
import { app } from "../../../firebase/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { Timestamp } from 'firebase-admin/firestore';
import type { Note } from '../../../types/notes';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
    const auth = getAuth(app);
    const db = getFirestore(app);

    /* Get token from request headers */
    const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
    if (!idToken) {
        return new Response("No token found", { status: 401 });
    }

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data() || {};

        // Get user preferences
        const showPali = userData['preferences.showPali'];
        const theme = userData['preferences.theme'];
        const enablePaliLookup = userData['preferences.enablePaliLookup'] || false;
        let noteId = userData['defaultNoteId'];

        // Create default note if it doesn't exist
        if (!noteId) {
            const noteRef = await db.collection('notes').add({
                author: decodedToken.uid,
                name: 'My Highlights',
                createdAt: Timestamp.now()
            } as Note);

            await db.collection('users').doc(decodedToken.uid).update({
                defaultNoteId: noteRef.id
            });
            noteId = noteRef.id;
        }

        // Create session cookie
        const twoWeeks = 60 * 60 * 24 * 14 * 1000;
        const sessionCookie = await auth.createSessionCookie(idToken, {
            expiresIn: twoWeeks,
        });

        cookies.set("__session", sessionCookie, {
            path: "/",
        });

        // Build redirect URL
        const url = new URL(request.url);
        const returnTo = url.searchParams.get("returnTo");
        const baseRedirectPath = returnTo ? new URL(returnTo, request.url).pathname : "/dashboard";
        const redirectUrl = new URL(baseRedirectPath, request.url);

        redirectUrl.searchParams.append('load-preferences', 'true');
        if (showPali) {
            redirectUrl.searchParams.set('pli', 'true');
        }
        if (theme) {
            redirectUrl.searchParams.set('theme', theme);
        }
        redirectUrl.searchParams.set('enablePaliLookup', enablePaliLookup.toString());
        redirectUrl.searchParams.set('note-id', noteId);

        return redirect(redirectUrl.toString());
    } catch (error) {
        if (error instanceof Error) {
            return new Response(error.message, { status: 401 });
        }
        return new Response("Authentication failed", { status: 401 });
    }
};