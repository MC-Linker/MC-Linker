const Command = require('../../structures/Command');
const { keys } = require('../../api/keys');
const Protocol = require('../../structures/Protocol');
const path = require('path');
const Discord = require('discord.js');
const utils = require('../../api/utils');
const { getEmbed } = require('../../api/messages');


class ServerInfo extends Command {

    constructor() {
        super({
            name: 'serverinfo',
            category: 'other',
        });
    }


    async execute(interaction, client, args, server) {
        if(!super.execute(interaction, client, args, server)) return;

        const serverPath = path.dirname(server.path); //TODO add serverpath property to connections
        let serverProperties = await server.protocol.get(Protocol.FilePath.ServerProperties(serverPath), `./serverdata/connections/${server.id}/server.properties`);
        let levelDat = await server.protocol.get(Protocol.FilePath.LevelDat(server.path), `./serverdata/connections/${server.id}/level.dat`);
        let serverIcon = await server.protocol.get(Protocol.FilePath.ServerIcon(serverPath), `./serverdata/connections/${server.id}/server-icon.png`);
        //TODO add method to perform multiple get requests at once (for ftp efficiency)

        if(!await utils.handleProtocolResponses([serverProperties, levelDat, serverIcon], server.protocol, interaction, {
            404: keys.api.command.errors.could_not_download,
        })) return;

        const datObject = await utils.nbtBufferToObject(levelDat.data, interaction);
        if(!datObject) return;
        const propertiesObject = utils.parseProperties(serverProperties.data.toString('utf-8'));

        console.log(datObject, propertiesObject);

        const iconAttachment = new Discord.AttachmentBuilder(serverIcon.data, {
            name: 'server-icon.png',
            description: 'Server Icon',
        });
        return interaction.replyOptions({
            embeds: [getEmbed(keys.commands.serverinfo.success, { server_name: propertiesObject['server-name'] })],
            files: [iconAttachment],
        });

    }
}

module.exports = ServerInfo;
