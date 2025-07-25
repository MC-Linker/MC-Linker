import ociCore from 'oci-core';
import ociCommon from 'oci-common';
import ociConstants from '../oci/constants.json' with { type: 'json' };
import logger from './logger.js';

const provider = new ociCommon.ConfigFileAuthenticationDetailsProvider('./oci/config');

/**
 * Exposes ports in this VM for custom bots.
 * @param {number} minPort - The minimum port number to expose.
 * @param {number} maxPort - The maximum port number to expose.
 * @returns {Promise<void>}
 */
export async function exposeCustomBotPorts(minPort, maxPort) {
    const newPortRange = {
        min: minPort,
        max: maxPort,
    };

    const vcnClient = new ociCore.VirtualNetworkClient({
        authenticationDetailsProvider: provider,
    });

    const previousSecurityList = await vcnClient.getSecurityList({
        securityListId: ociConstants.securityListId,
    });
    const customBotRuleIndex = previousSecurityList.securityList.ingressSecurityRules.findIndex(rule => rule.description === 'Custom Bots');
    if(previousSecurityList.securityList.ingressSecurityRules[customBotRuleIndex].tcpOptions.destinationPortRange === newPortRange)
        return logger.debug('[OCI] Custom Bot ports already exposed.');
    previousSecurityList.securityList.ingressSecurityRules[customBotRuleIndex].tcpOptions.destinationPortRange = {
        min: minPort,
        max: maxPort,
    };

    await vcnClient.updateSecurityList({
        securityListId: ociConstants.securityListId,
        updateSecurityListDetails: {
            ingressSecurityRules: previousSecurityList.securityList.ingressSecurityRules,
        },
    });

    logger.debug('[OCI] Custom Bot ports updated to ' + JSON.stringify(newPortRange));

    await vcnClient.close();
}