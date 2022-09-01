const { Base } = require('discord.js');

class Protocol extends Base {

    /**
     * @typedef {PluginProtocolData|FtpProtocolData} ProtocolData - The data for a protocol.
     */

    /**
     * Creates a new protocol.
     * @param {MCLinker} client - The client to create the protocol for.
     */
    constructor(client) {
        super(client);
    }
}

module.exports = Protocol;
