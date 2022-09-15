const Discord = require('discord.js');
const { keys } = require('../../api/messages');
const Command = require('../../structures/Command');

class Ban extends Command {

    constructor() {
        super('ban');
    }

    async execute(interaction, client, args) {
        const user = interaction.mentions.users.first() ?? args[0];
        args.shift(); // Shift user
        let reason = args[0] ? args.join(' ') : 'Banned by an operator.';

        if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.BanMembers)) {
            interaction.replyTl(keys.commands.ban.warnings.no_permission);
            return;
        }
        else if(!user) {
            interaction.replyTl(keys.commands.ban.warnings.no_username);
            return;
        }

        const mcUsername = user.id ? await utils.getUsername(user.id, interaction) : user;
        if(!mcUsername) return;

        const resp = await plugin.execute(`ban ${mcUsername} ${reason}`, interaction.guildId, interaction);
        if(!resp) return;

        if(resp.status === 206) interaction.replyTl(keys.commands.ban.warnings.response_warning, { username: user, reason });
        else interaction.replyTl(keys.commands.ban.success, { username: user, reason });
    }
}

module.exports = Ban;
