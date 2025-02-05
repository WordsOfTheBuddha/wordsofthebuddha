import type { APIRoute } from "astro";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { app } from "../../../firebase/server";
import { formatDate } from "../../../components/PostCard.astro";
import type { Highlight } from "../../../types/notes";

interface HighlightResponse extends Omit<Highlight, 'updatedAt'> {
    updatedAt: number;
}

export const prerender = false;

async function getUserNoteId(userId: string): Promise<string> {
    const db = getFirestore(app);
    const userDoc = await db.collection('users').doc(userId).get();
    const noteId = userDoc.data()?.defaultNoteId;

    if (!noteId) {
        throw new Error('No default note found for user');
    }

    return noteId;
}

export const GET: APIRoute = async ({ cookies }) => {
    const opId = `list-${Date.now()}`;
    console.log(`[${opId}] Starting highlights list operation`);

    try {
        const auth = getAuth(app);
        const db = getFirestore(app);

        const sessionCookie = cookies.get("__session")?.value;
        if (!sessionCookie) throw new Error('No session');

        const decodedCookie = await auth.verifySessionCookie(sessionCookie);
        const noteId = await getUserNoteId(decodedCookie.uid);

        console.log(`[${opId}] Fetching highlights for noteId: ${noteId}`);

        const highlightsRef = db.collection('notes')
            .doc(noteId)
            .collection('highlights');

        const highlights = await highlightsRef.orderBy('updatedAt', 'desc').get();
        console.log(`[${opId}] Found ${highlights.docs.length} highlight documents`);

        const processedHighlights = highlights.docs.map(doc => {
            const data = doc.data() as Highlight;
            const updatedDate = data.updatedAt.toDate();

            const processedHighlight: HighlightResponse = {
                slug: data.slug,
                title: data.slug === '/' ? 'Home' : data.title,
                description: data.description,
                rangyHash: data.rangyHash,
                highlightSegments: data.highlightSegments,
                updatedAt: data.updatedAt.toMillis(),
                formattedDate: formatDate(updatedDate)
            };

            return processedHighlight;
        });

        const validHighlights = processedHighlights
            .filter(Boolean)
            .sort((a, b) => b.updatedAt - a.updatedAt);

        console.log(`[${opId}] Returning ${validHighlights.length} processed highlights`);

        return new Response(JSON.stringify({
            highlights: validHighlights,
            opId
        }));
    } catch (error: any) {
        console.error(`[${opId}] Error in list operation:`, error);
        return new Response(JSON.stringify({
            error: error.message,
            opId
        }), { status: 401 });
    }
};
