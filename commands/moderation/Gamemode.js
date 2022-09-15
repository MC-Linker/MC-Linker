const Discord = require('discord.js');
const { keys } = require('../../api/messages');
const Command = require('../../structures/Command');

class Gamemode extends Command {

    constructor() {
        super('gamemode');
    }

    async execute(interaction, client, args) {
        const user = interaction.mentions.users.first() ?? args[0];
        const gamemode = args[1];

        if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
            interaction.replyTl(keys.commands.gamemode.warnings.no_permission);
            return;
        }
        else if(!user) {
            interaction.replyTl(keys.commands.gamemode.warnings.no_username);
            return;
        }
        else if(!gamemode) {
            interaction.replyTl(keys.commands.gamemode.warnings.no_gamemode);
            return;
        }

        const mcUsername = user.id ? await utils.getUsername(user.id, interaction) : user;
        if(!mcUsername) return;

        const resp = await plugin.execute(`gamemode ${gamemode} ${mcUsername}`, interaction.guildId, interaction);
        if(!resp) return;

        if(resp.status === 206) interaction.replyTl(keys.commands.gamemode.warnings.response_warning, {
            username: user,
            gamemode: gamemode.cap(),
        });
        else interaction.replyTl(keys.commands.gamemode.success, { username: user, gamemode: gamemode.cap() });
    }
}

module.exports = Gamemode;
