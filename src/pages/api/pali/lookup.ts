export const prerender = false;
import type { APIRoute } from "astro";
import { db } from '../../../firebase/server';

export const GET: APIRoute = async ({ url }) => {
    const word = url.searchParams.get('word');

    if (!word) {
        return new Response('Word parameter is required', { status: 400 });
    }

    try {
        // Check cache first
        const cacheRef = db.collection('dpd').doc(word);
        const cacheDoc = await cacheRef.get();

        if (cacheDoc.exists) {
            return new Response(JSON.stringify(cacheDoc.data()), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // If not in cache, fetch from API
        const response = await fetch(`https://dpdict.net/search_json?q=${encodeURIComponent(word)}`);
        const data = await response.json();

        // Store in cache
        await cacheRef.set(data);

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response('Failed to fetch dictionary data', { status: 500 });
    }
};
