const { keys } = require('../../api/messages');
const Discord = require('discord.js');
const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Command = require('../../structures/Command');

// noinspection JSClassNamingConvention
class Op extends Command {

    constructor() {
        super('op');
    }

    async execute(interaction, client, args) {
        const user = interaction.mentions.users.first() ?? args[0];

        if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
            interaction.replyTl(keys.commands.op.warnings.no_permission);
            return;
        }
        else if(!user) {
            interaction.replyTl(keys.commands.op.warnings.no_username);
            return;
        }

        const mcUsername = user.id ? await utils.getUsername(user.id, interaction) : user;
        if(!mcUsername) return;

        const resp = await plugin.execute(`op ${mcUsername}`, interaction.guildId, interaction);
        if(!resp) return;

        if(resp.status === 206) interaction.replyTl(keys.commands.op.warnings.response_warning, { username: user });
        else interaction.replyTl(keys.commands.op.success, { username: user });
    }
}

module.exports = Op;


