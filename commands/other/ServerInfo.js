const Command = require('../../structures/Command');
const { keys } = require('../../api/keys');
const Protocol = require('../../structures/Protocol');
const path = require('path');
const Discord = require('discord.js');
const utils = require('../../api/utils');
const { getEmbed, addPh } = require('../../api/messages');


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

        //TODO add method to perform multiple requests at once (for ftp efficiency)
        if(!await utils.handleProtocolResponses([serverProperties, levelDat], server.protocol, interaction, {
            404: addPh(keys.api.command.errors.could_not_download, { category: 'server-info' }),
        })) return;

        const datObject = await utils.nbtBufferToObject(levelDat.data, interaction);
        if(!datObject) return;
        const propertiesObject = utils.parseProperties(serverProperties.data.toString('utf-8'));

        let onlinePlayers = server.hasPluginProtocol() ? await server.protocol.getOnlinePlayers() : null;
        if(onlinePlayers === null || onlinePlayers.status !== 200) onlinePlayers = 0;
        else onlinePlayers = onlinePlayers.data.length;


        const serverIp = propertiesObject['server-ip'] !== '' ? propertiesObject['server-ip'] : server.protocol.ip;
        const iconAttachment = serverIcon.status === 200 ? [new Discord.AttachmentBuilder(serverIcon.data, {
            name: 'server-icon.png',
            description: 'Server Icon',
        })] : [];
        return interaction.replyOptions({
            embeds: [getEmbed(keys.commands.serverinfo.success, {
                server_name: propertiesObject['server-name'] ?? keys.commands.serverinfo.warnings.unknown_server_name,
                motd: propertiesObject['motd'],
                max_players: propertiesObject['max-players'],
                online_players: onlinePlayers,
                ip: serverIp,
                version: datObject.Data.Version.Name,
            })],
            files: iconAttachment,
        });

    }
}

module.exports = ServerInfo;
