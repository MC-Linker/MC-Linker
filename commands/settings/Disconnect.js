const fs = require('fs-extra');
const { keys } = require('../../api/messages');
const Discord = require('discord.js');
const Command = require('../../structures/Command');

class Disconnect extends Command {

    constructor() {
        super('disconnect');
    }


    async execute(interaction, client, args) {
        const method = args[0];

        if(!method) {
            interaction.replyTl(keys.commands.disconnect.warnings.no_method);
            return;
        }

        let path;
        if(method === 'ftp' || method === 'plugin') path = `./serverdata/connections/${interaction.guild.id}/`;
        else if(method === 'account') path = `./userdata/connections/${interaction.member.user.id}/`;
        else {
            interaction.replyTl(keys.commands.disconnect.warnings.invalid_method);
            return;
        }

        if(method === 'plugin' || method === 'ftp') {
            if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
                interaction.replyTl(keys.commands.disconnect.warnings.no_permission);
                return;
            }

            const protocol = await utils.getProtocol(interaction.guildId, interaction);
            if(!protocol) return;

            if(protocol !== method) {
                interaction.replyTl(keys.commands.disconnect.warnings.invalid_protocol, { method });
                return;
            }
        }

        if(method === 'plugin') {
            const disconnect = await plugin.disconnect(interaction.guildId, interaction.client, interaction);
            if(!disconnect) return;
        }

        fs.remove(path, err => {
            if(err) {
                interaction.replyTl(keys.commands.disconnect.errors.could_not_remove_folder);
                return;
            }

            interaction.replyTl(keys.commands.disconnect.success, { method, 'method_cap': method.cap() });
        });
    }
}

module.exports = Disconnect;
