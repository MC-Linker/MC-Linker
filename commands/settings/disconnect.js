const { SlashCommandBuilder } = require('@discordjs/builders');
const fs =  require('fs');
const plugin = require('../../api/plugin');
const utils = require("../../api/utils");

module.exports = {
    name: 'disconnect',
    aliases: [],
    usage: 'disconnect ftp/rcon/plugin/user',
    example: '/disconnect ftp **//** /disconnect account',
    description: 'Disconnect your minecraft java-edition server or minecraft java-edition account from the bot and delete all saved credentials. To connect again, use `/connect` again.',
    data: new SlashCommandBuilder()
            .setName('disconnect')
            .setDescription('Disconnect your minecraft server or minecraft account from the bot.')
            .addSubcommand(subcommand =>
                subcommand.setName('ftp')
                .setDescription('Disconnect from ftp.')
            ).addSubcommand(subcommand =>
                subcommand.setName('plugin')
                .setDescription('Disconnect from the minecraft-plugin.')
            ).addSubcommand(subcommand =>
                subcommand.setName('account')
                .setDescription('Disconnect your minecraft-account.')
            ),
    async execute(message, args) {
        const method = args[0];

        if(!method) {
            console.log(`${message.member.user.tag} executed /disconnect without method in ${message.guild.name}`);
            message.reply(':warning: Please set the connection method (`ftp`, `plugin`, `user`) from which you want to get disconnected.');
            return;
        }
        let path;
        if(method === 'ftp' || method === 'plugin') path = `./serverdata/${message.guild.id}/`;
        else if(method === 'account') path = `./userdata/${message.member.user.id}/`;
        else {
            console.log(`${message.member.user.tag} executed /disconnect with wrong method in ${message.guild.name}`);
            message.reply(':warning: You can only disconnect from `ftp`, `plugin` or `account`.');
            return;
        }

        console.log(`${message.member.user.tag} executed /disconnect ${method} in ${message.guild.name}`);


        if(method === 'plugin' || method === 'ftp') {
            const protocol = await utils.getProtocol(message.guildId, message);
            if(!protocol) return;

            if(protocol !== method) {
                console.log(`Wrong protocol ${protocol}`);
                message.reply(`:warning: Couldn't disconnect from the **${method}** connection because you are **not connected**.`);
                return;
            }
        }

        if(method === 'plugin') {
            const disconnect = await plugin.disconnect(message.guildId, message);
            if(!disconnect) return;
        }

        fs.rm(path, { recursive: true, force: true }, err => {
            if(err) {
                console.log(`Error trying to delete ${method} connection folder.`, err);
                message.reply(`:warning: Couldn't disconnect from the **${method}** connection because you are **not connected**.`);
                return;
            }
            console.log(`The ${method} connection to this bot was successfully disconnected.`);
            message.reply(`<:Checkmark:849224496232660992> The **${method}** connection to this bot was successfully disconnected.`);
        });
	}
}