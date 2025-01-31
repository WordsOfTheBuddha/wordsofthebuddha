export const prerender = false;
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url }) => {
    const word = url.searchParams.get('word');

    if (!word) {
        return new Response('Word parameter is required', { status: 400 });
    }

    try {
        const response = await fetch(`https://dpdict.net/search_json?q=${encodeURIComponent(word)}`);
        const data = await response.json();

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
