import ociCore from 'oci-core';
import { securityListId } from '../oci/constants.json' with { type: 'json' };
import ociCommon from 'oci-common';

const provider = new ociCommon.ConfigFileAuthenticationDetailsProvider('./oci/config');

/**
 * Exposes ports in this VM for custom bots.
 * @param {number} minPort - The minimum port number to expose.
 * @param {number} maxPort - The maximum port number to expose.
 * @returns {Promise<void>}
 */
export async function exposeCustomBotPorts(minPort, maxPort) {
    const vcnClient = new ociCore.VirtualNetworkClient({
        authenticationDetailsProvider: provider,
    });

    const previousSecurityList = await vcnClient.getSecurityList({
        securityListId,
    });
    console.log(previousSecurityList.securityList.ingressSecurityRules);
    const customBotRuleIndex = previousSecurityList.securityList.ingressSecurityRules.findIndex(rule => rule.description === 'Custom Bots');
    previousSecurityList.securityList.ingressSecurityRules.splice(customBotRuleIndex, 1);
    previousSecurityList.securityList.ingressSecurityRules.push({
        description: 'Custom Bots',
        protocol: 'tcp',
        source: '0.0.0.0/0',
        tcpOptions: {
            destinationPortRange: {
                min: minPort,
                max: maxPort,
            },
        },
    });

    console.log(previousSecurityList.securityList.ingressSecurityRules);

    /*    await vcnClient.updateSecurityList({
            securityListId,
            updateSecurityListDetails: {
                ingressSecurityRules: previousSecurityList.securityList.ingressSecurityRules,
            },
        });*/

    await vcnClient.close();
}