const { keys } = require('../../api/messages');
const Discord = require('discord.js');
const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Command = require('../../structures/Command');

class Deop extends Command {

    constructor() {
        super('deop');
    }

    async execute(interaction, client, args) {
        const user = interaction.mentions.users.first() ?? args[0];

        if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
            interaction.replyTl(keys.commands.deop.warnings.no_permission);
            return;
        }
        else if(!user) {
            interaction.replyTl(keys.commands.deop.warnings.no_username);
            return;
        }

        const mcUsername = user.id ? await utils.getUsername(user.id, interaction) : user;
        if(!mcUsername) return;

        const resp = await plugin.execute(`deop ${mcUsername}`, interaction.guildId, interaction);
        if(!resp) return;

        if(resp.status === 206) interaction.replyTl(keys.commands.deop.warnings.response_warning, { username: user });
        else interaction.replyTl(keys.commands.deop.success, { username: user });
    }
}

module.exports = Deop;
