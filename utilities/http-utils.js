import fs from 'fs-extra';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * Fetches and parses a JSON document.
 * @param {string} url - The url to fetch.
 * @returns {Promise<any>} The parsed JSON.
 * @throws {Error} If the request fails, the response is not successful or empty, or it contains invalid JSON.
 */
export async function fetchJson(url) {
    const res = await fetch(url);
    if(!res.ok) throw new Error(`GET ${url} → ${res.status}`);

    const body = await res.text();
    if(!body.trim()) throw new Error(`GET ${url} → ${res.status}: empty JSON response`);

    try {
        return JSON.parse(body);
    }
    catch(err) {
        throw new Error(`GET ${url} → ${res.status}: invalid JSON response`, { cause: err });
    }
}

/**
 * Streams a url to a file on disk (`fetch` follows redirects automatically).
 * @param {string} url - The url to download.
 * @param {string} dest - The destination file path.
 * @returns {Promise<void>}
 * @throws {Error} If the response status is not ok or has no body.
 */
export async function downloadFile(url, dest) {
    const res = await fetch(url);
    if(!res.ok || !res.body) throw new Error(`GET ${url} → ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest));
}
