const { keys } = require('../../api/messages');
const Command = require('../../structures/Command');

class Message extends Command {

    constructor() {
        super({
            name: 'message',
            ephemeral: true,
            requiresConnectedPlugin: true,
            requiresConnectedUser: 0,
            category: 'other',
        });
    }


    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const user = args[0];
        args.shift(); //Remove username from args
        const chatMsg = args?.join(' ').replaceAll(`"`, `\\"`);
        const argPlaceholder = { username: user.username, 'message': chatMsg };

        const resp = await server.protocol.chatPrivate(chatMsg, user.username);
        if(!resp) {
            return interaction.replyTl(keys.api.plugin.errors.no_response);
        }

        if(resp.status === 206) return interaction.replyTl(keys.commands.message.warnings.response_warning, argPlaceholder, { 'response': resp.json.message });
        else return interaction.replyTl(keys.commands.message.success, argPlaceholder);
    }
}

module.exports = Message;
