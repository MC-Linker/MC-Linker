const { SlashCommandBuilder } = require('@discordjs/builders');
const fs =  require('fs');

module.exports = {
    name: 'disconnect',
    aliases: [],
    usage: 'disconnect ftp/rcon/plugin/user',
    example: '/disconnect ftp **//** /disconnect user',
    description: 'Disconnect your minecraft java edition server or minecraft account from the bot and delete all saved credentials. To connect again, use `/connect` again.',
    data: new SlashCommandBuilder()
            .setName('disconnect')
            .setDescription('Disconnect your minecraft java edition server or minecraft account from the bot.')
            .addSubcommand(subcommand =>
                subcommand.setName('ftp')
                .setDescription('Disconnect from ftp.')
            ).addSubcommand(subcommand =>
                subcommand.setName('plugin')
                .setDescription('Disconnect the minecraft-plugin.')
            ).addSubcommand(subcommand =>
                subcommand.setName('user')
                .setDescription('Disconnect your minecraft-account.')
            ),
    execute(message, args) {
        const mode = args[0];
        if(!mode) {
            console.log(message.member.user.tag + ' executed /disconnect without args in ' + message.guild.name);
            message.reply(':warning: Please set the connection method (ftp/rcon/plugin/user) from which you want to get disconnected.');
        }
        console.log(`${message.member.user.tag} executed /disconnect ${mode} in ${message.guild.name}`);

        let path;
        switch(mode) {
            case 'ftp':
                path = `./ftp/${message.guild.id}.json`;
                break;
            case 'plugin':
                path = `./ftp/${message.guild.id}.json`;
                break;
            case 'user':
                path = `./connections/${message.member.user.id}.json`;
                break;
        }

        fs.rm(path, err => {
            if(err) {
                console.log(`Error trying to delete ${mode} connection-file.`, err);
                message.reply(`:warning: Couldnt disconnect the ${mode.toUpperCase()} connection to this bot. You are most likely **not connected**.`);
                return;
            }
            console.log(`The ${mode} connection to this bot was successfully disconnected.`);
            message.reply(`<:Checkmark:849224496232660992> ${mode.toUpperCase()} connection to this bot was successfully disconnected.`);
        });
	}
}