/**
 * Barrel re-export file for all utility functions.
 * Domain-specific utilities have been split into separate files for organization.
 * All existing `import { X } from '.../utils.js'` continue to work.
 */

import crypto from 'crypto';
import util from 'util';
import { exec } from 'child_process';

// Re-export all domain utilities
export * from './uuid-utils.js';
export * from './minecraft-utils.js';
export * from './nbt-utils.js';
export * from './canvas-utils.js';
export * from './format-utils.js';
export * from './protocol-utils.js';
export * from './discord-utils.js';
export * from './sharding-utils.js';

/**
 * Promisified version of exec.
 * @type {(arg1: string, options: ExecOptions=null) => Promise<{ stdout: string, stderr: string }>}
 */
export const execAsync = util.promisify(exec);

export function createHash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Memoizes a function.
 * @template {Function} K
 * @param {K} fn - The function to memoize.
 * @param {Number=undefined} parameters - The number of parameters to use as key. Defaults to all parameters.
 * @returns {K} - The memoized function.
 */
export function memoize(fn, parameters = undefined) {
    const cache = new Map();
    return function(...args) {
        const key = JSON.stringify(args.slice(0, parameters));
        if(cache.has(key)) return cache.get(key);

        const result = fn(...args);
        if(result instanceof Promise)
            result.then(value => cache.set(key, value));
        else cache.set(key, result);

        return result;
    };
}
