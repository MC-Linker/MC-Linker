const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Discord = require('discord.js');
const { keys } = require('../../api/messages');
const Command = require('../../structures/Command');

class Unban extends Command {

    constructor() {
        super('unban');
    }

    async execute(interaction, client, args) {
        const user = interaction.mentions.users.first() ?? args[0];

        if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.BanMembers)) {
            interaction.replyTl(keys.commands.unban.warnings.no_permission);
            return;
        }
        else if(!user) {
            interaction.replyTl(keys.commands.unban.warnings.no_username);
            return;
        }

        const mcUsername = user.id ? await utils.getUsername(user.id, interaction) : user;
        if(!mcUsername) return;

        const resp = await plugin.execute(`pardon ${mcUsername}`, interaction.guildId, interaction);
        if(!resp) return;

        if(resp.status === 206) interaction.replyTl(keys.commands.unban.warnings.response_warning, { username: user });
        else interaction.replyTl(keys.commands.unban.success, { username: user });
    }
}

module.exports = Unban;
