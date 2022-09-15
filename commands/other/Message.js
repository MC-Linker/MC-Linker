const plugin = require('../../api/plugin');
const utils = require('../../api/utils');
const { keys } = require('../../api/messages');
const Command = require('../../structures/Command');

class Message extends Command {

    constructor() {
        super('message', true, true);
    }


    async execute(interaction, client, args) {
        const username = interaction.mentions.users.first() ?? args[0];
        args.shift(); //Remove username from args
        const chatMsg = args?.join(' ').replaceAll(`"`, `\\"`);
        const argPlaceholder = { username, 'message': chatMsg };

        if(!username) {
            interaction.replyTl(keys.commands.message.warnings.no_username);
            return;
        }
        else if(!chatMsg) {
            interaction.replyTl(keys.commands.message.warnings.no_message);
            return;
        }

        const mcUsername = username.id ? await utils.getUsername(username.id, interaction) : username;
        if(!mcUsername) return;

        const resp = await plugin.chatPrivate(chatMsg, interaction.guildId, interaction.member.user.tag, mcUsername, interaction);
        if(!resp) return;

        if(resp.status === 206) interaction.replyTl(keys.commands.message.warnings.response_warning, argPlaceholder, { 'response': resp.json.message });
        else interaction.replyTl(keys.commands.message.success, argPlaceholder);
    }
}

module.exports = Message;
