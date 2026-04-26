import keys from './keys.js';
import { ProtocolError } from '../structures/protocol/Protocol.js';

const defaultErrorResponses = {
    [ProtocolError.UNKNOWN]: keys.api.plugin.errors.status_400,
    [ProtocolError.UNAUTHORIZED]: keys.api.plugin.errors.status_401,
    [ProtocolError.NOT_FOUND]: keys.api.plugin.errors.status_404,
    [ProtocolError.SERVER_ERROR]: keys.api.plugin.errors.status_500,
};

/**
 * Handles the response of a protocol call.
 * @param {?ProtocolResponse} response - The response to handle.
 * @param {Protocol} protocol - The protocol that was called.
 * @param {TranslatedResponses} interaction - The interaction to respond to.
 * @param {Object.<string, MessagePayload>} [errorResponses={}] - The responses to use for each error code string. See {@link ProtocolError} for known codes.
 * @param {...Object.<string, string>[]} [placeholders=[]] - The placeholders to use in the response.
 * @returns {Promise<boolean>} - Whether the response was successful.
 */
export async function handleProtocolResponse(response, protocol, interaction, errorResponses = {}, ...placeholders) {
    placeholders.push({ data: JSON.stringify(response?.data ?? '') });

    if(!response) {
        await interaction.editReplyTl(keys.api.plugin.errors.no_response, ...placeholders);
        return false;
    }
    else if(response.status !== 'success') {
        const responseKey = errorResponses[response.error] ?? defaultErrorResponses[response.error] ?? defaultErrorResponses[ProtocolError.SERVER_ERROR];
        await interaction.editReplyTl(responseKey, ...placeholders);
        return false;
    }

    return true;
}

/**
 * Handles multiple responses of protocol calls.
 * @param {Array<?ProtocolResponse>} responses - The responses to handle.
 * @param {Protocol} protocol - The protocol that was called.
 * @param {TranslatedResponses} interaction - The interaction to respond to.
 * @param {Object.<string, MessagePayload>} [errorResponses={}] - The responses to use for each error code string. See {@link ProtocolError} for known codes.
 * @param {...Object.<string, string>[]} [placeholders=[]] - The placeholders to use in the response.
 * @returns {Promise<boolean>} - Whether all responses were successful.
 */
export async function handleProtocolResponses(responses, protocol, interaction, errorResponses = {}, ...placeholders) {
    for(const response of responses) {
        if(!await handleProtocolResponse(response, protocol, interaction, errorResponses, ...placeholders)) return false;
    }
    return true;
}
