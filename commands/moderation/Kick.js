const { keys } = require('../../api/messages');
const Discord = require('discord.js');
const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Command = require('../../structures/Command');

class Kick extends Command {

    async execute(interaction, client, args) {
        const user = interaction.mentions.users.first() ?? args[0];
        args.shift(); //Shift user
        let reason = args[0] ? args.join(' ') : 'Kicked by an operator.';

        if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.KickMembers)) {
            interaction.replyTl(keys.commands.kick.warnings.no_permission);
            return;
        }
        else if(!user) {
            interaction.replyTl(keys.commands.kick.warnings.no_username);
            return;
        }

        const mcUsername = user.id ? await utils.getUsername(user.id, interaction) : user;
        if(!mcUsername) return;

        const resp = await plugin.execute(`kick ${mcUsername} ${reason}`, interaction.guildId, interaction);
        if(!resp) return;

        if(resp.status === 206) interaction.replyTl(keys.commands.kick.warnings.response_warning, { username: user, reason });
        else interaction.replyTl(keys.commands.kick.success, { username: user, reason });
    }
}

module.exports = Kick;


