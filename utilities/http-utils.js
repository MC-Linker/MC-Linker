import fs from 'fs-extra';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * Fetches and parses a JSON document.
 * @param {string} url - The url to fetch.
 * @returns {Promise<any>} The parsed JSON.
 * @throws {Error} If the response status is not ok.
 */
export async function fetchJson(url) {
    const res = await fetch(url);
    if(!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    return res.json();
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
