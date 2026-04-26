import keysJson from '../resources/languages/en_us.json' with { type: 'json' };
import util from 'util';

const pathSymbol = Symbol('key path');

function createKeysProxy(paths) {
    let keys = getKeysFromPath(paths);
    if(typeof keys !== 'object') return keys;

    //Add hidden property to the proxy that contains the full path to the key
    keys[pathSymbol] = paths;

    return new Proxy(keys, {
        get(target, key) {
            if(key === pathSymbol) return target[pathSymbol];

            if(key === Symbol.toPrimitive || key === 'toString' || key === 'valueOf') {
                return () => getLanguageKey(target);
            }

            if(typeof key === 'string') {
                //If path is a number, convert it to a number (e.g. keys[0] instead of keys['0'])
                const intKey = parseInt(key, 10);
                if(key === intKey.toString()) key = intKey;
            }
            return createKeysProxy([...paths, key]);
        },
    });
}

/**
 * Returns the full object path to the language key as an array.
 * @example getObjectPath(keys.commands.chatchannel.success.add) // ['commands', 'chatchannel', 'success', 'add']
 * @param {any} proxy - The proxy object returned by the keys.
 * @returns {Array.<string|number>}
 */
export function getObjectPath(proxy) {
    if(!util.types.isProxy(proxy)) return [];
    return proxy[pathSymbol];
}

/**
 * Returns the json language object that is wrapped in a proxy.
 * @param {any} proxy - The proxy object returned by the keys.
 * @returns {Object}
 */
export function getLanguageKey(proxy) {
    if(!util.types.isProxy(proxy)) return proxy;
    return getKeysFromPath(getObjectPath(proxy));
}

function getKeysFromPath(paths) {
    let key = keysJson;
    for(const path of paths) key = key[path];
    return key;
}

const keys = createKeysProxy([]);
/** @type {typeof keysJson} */
export default keys;
