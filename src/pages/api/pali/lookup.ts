export const prerender = false;
import type { APIRoute } from "astro";
import { db } from '../../../firebase/server';
import { JSDOM } from 'jsdom';

function cleanupDpdHtml(html: string): string {

    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Remove unnecessary elements
    const selectorsToRemove = [
        '.box-footer',         // Remove footer
        '.comments',           // Remove comments section
        '.button-box',         // Remove button box
        'script',             // Remove any scripts
        'style',              // Remove inline styles
        '.metadata',          // Remove metadata
        '.box-title',         // Remove title box
        // Dictionary-specific elements
        '[id^="grammar_dhamma_"]',
        '[id^="examples_dhamma_"]',
        '[id^="declension_dhamma_"]',
        '[id^="family_root_dhamma_"]',
        '[id^="family_compound_dhamma_"]',
        '[id^="family_idiom_dhamma_"]',
        '[id^="frequency_dhamma_"]',
        '[id^="feedback_dhamma_"]',
        '.button_box',
    ];

    selectorsToRemove.forEach(selector => {
        doc.querySelectorAll(selector).forEach((el: Element) => el.remove());
    });

    return doc.body.innerHTML;
}

export const GET: APIRoute = async ({ url }) => {
    const word = url.searchParams.get('word');

    if (!word) {
        return new Response('Word parameter is required', { status: 400 });
    }

    try {
        // Check cache first
        const cacheRef = db.collection('dpd').doc(word);
        try {
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
        } catch (cacheError: any) {
            console.error('Cache access error:', cacheError);
            return new Response(JSON.stringify({
                error: 'Cache access failed',
                details: cacheError.message
            }), { status: 500 });
        }

        // If not in cache, fetch from API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 18000); // 18 second timeout

        try {
            const response = await fetch(
                `https://dpdict.net/search_json?q=${encodeURIComponent(word)}`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Clean up HTML before caching if it exists
            if (data.dpd_html) {
                data.dpd_html = cleanupDpdHtml(data.dpd_html);
            }

            // Try to store in cache
            try {
                await cacheRef.set(data);
            } catch (cacheError: any) {
                console.error('Cache write failed. Document size:', JSON.stringify(data).length);
            }

            return new Response(JSON.stringify(data), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (error: any) {
            clearTimeout(timeoutId);
            console.error('Dictionary API error:', error.name);

            if (error.name === 'AbortError') {
                return new Response(JSON.stringify({
                    error: 'Dictionary API timeout',
                    word: word,
                }), { status: 504 });
            }

            return new Response(JSON.stringify({
                error: 'Dictionary API error',
                word: word
            }), { status: 502 });
        }
    } catch (error: any) {
        console.error('Unexpected error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            word: word
        }), { status: 500 });
    }
};
