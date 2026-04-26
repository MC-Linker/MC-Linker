import nbt from 'prismarine-nbt';
import mojangson from 'mojangson';
import keys from './keys.js';
import { ph } from './messages.js';
import { stripColorCodes } from './format-utils.js';

/**
 * Creates a JS object from an nbt buffer.
 * @param {Buffer} buffer - The nbt buffer to create the object from.
 * @param {?TranslatedResponses} interaction - The interaction to respond to in case of an error.
 * @returns {Promise<object|undefined>} - The created object or undefined if an error occurred.
 */
export async function nbtBufferToObject(buffer, interaction) {
    try {
        const object = await nbt.parse(buffer, 'big');
        return nbt.simplify(object.parsed);
    }
    catch(err) {
        await interaction?.editReplyTl(keys.api.ftp.errors.could_not_parse, ph.error(err));
        return undefined;
    }
}

/**
 * Creates a JS object from a snbt string. This will also strip extra color codes from the string.
 * @param {string} string - The snbt string to create the object from.
 * @param {?TranslatedResponses} interaction - The interaction to respond to in case of an error.
 * @returns {Promise<object|undefined>} - The created object or undefined if an error occurred.
 */
export function nbtStringToObject(string, interaction) {
    try {
        const object = mojangson.parse(stripColorCodes(string));
        //remove empty inventory/ender-items to prevent error (please fix this mojangson)
        if(!object.value?.Inventory?.value?.value) delete object.value.Inventory;
        if(!object.value?.EnderItems?.value?.value) delete object.value.EnderItems;
        const simplified = mojangson.simplify(object);
        // re-add empty inventory/ender-items
        if(!simplified.Inventory) simplified.Inventory = [];
        if(!simplified.EnderItems) simplified.EnderItems = [];
        return simplified;
    }
    catch(err) {
        interaction?.editReplyTl(keys.api.ftp.errors.could_not_parse, ph.error(err));
        return undefined;
    }
}
