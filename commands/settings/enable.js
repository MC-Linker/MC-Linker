const fs = require('fs');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'enable',
    aliases: [],
    usage: 'enable commands/stats/advancements <command/stat/advancement>',
    example: '/enable commands txp **//** /enable stats picked_up **//** /enable advancements adventuring_time',
    description: 'Enable a disabled command/stat/advancement (Theyre all enabled by default). Command-enabling is also possible through buttons in /help <command>.',
    data: new SlashCommandBuilder()
            .setName('enable')
            .setDescription('Enable a disabled command/stat/advancement (Theyre all enabled by default).')
            .addSubcommand(subcommand =>
                subcommand.setName('commands')
                .setDescription('Enable a disabled command.')
                .addStringOption(option =>
                    option.setName('command')
                    .setDescription('Set the command you want to enable.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('stats')
                .setDescription('Enable a disabled stat.')
                .addStringOption(option =>
                    option.setName('stat')
                    .setDescription('Set the stat you want to enable.')
                    .setRequired(true)
                )
            ).addSubcommand(subcommand =>
                subcommand.setName('advancements')
                .setDescription('Enable a disabled advancement.')
                .addStringOption(option =>
                    option.setName('advancement')
                    .setDescription('Set the advancement you want to enable.')
                    .setRequired(true)
                )
            ),
    execute(message, args) {
        const mode = (args[0]);
        let object = (args[1]);

        if(!mode || !object) {
            console.log(message.member.user.tag + ' executed /enable wrong in ' + message.guild.name);
            message.reply(":warning: Wrong Usage! Check `/help enable` for correct usage!");
            return;
        }

        console.log(message.member.user.tag + ' executed /enable ' + mode + ' ' + object + ' in ' + message.guild.name);

        let enableMode;
        if (mode === 'command' || mode === 'cmd' || mode === 'commands' || mode === 'cmds') enableMode = 'commands';
        else if (mode === 'advancements' || message.client.commands.get('advancements').aliases.includes(mode)) enableMode = 'advancements';
        else if (mode === 'stats' || message.client.commands.get('stats').aliases.includes(mode)) enableMode = 'stats';
        else {
            console.log(message.member.user.tag + ' executed /enable wrong in ' + message.guild.name);
            message.reply(":warning: Wrong Usage! Check `/help enable` for correct usage!");
            return;
        }

        let enObject = object;
        try {
            if(enableMode === 'commands') enObject = message.client.commands.find(cmd => cmd.name && cmd.name === object) || message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(object));
            if(typeof enObject === 'object') enObject = enObject.name;
            else if(!enObject) {
                console.log(enableMode + " [" + object + "] doesn't exist.");
                message.reply(":warning: " + enableMode + " [**" + object + "**] doesn't exist.");
                return;
            }
            fs.rm(`./disable/${enableMode}/${message.guild.id}_${enObject}`, err => {
                if (err) {
                    console.log(`Error trying to delete ${enableMode} EnableFile of ` + enObject, err);
                    message.reply(`<:Error:849215023264169985> Could not enable ${enableMode} [**${enObject}**]. Is it already enabled?`);
                    return;
                }
                console.log(`Succesfully deleted ${enableMode} EnableFile [` + `./disable/${enableMode}/${message.guild.id}_${enObject}` + '].');
                message.reply(`<:Checkmark:849224496232660992> Succesfully enabled ${enableMode} [**` + enObject + '**].');
            });
        } catch (err) {
            console.log(enableMode + " [" + object + "] doesn't exist.", err);
            message.reply(":warning: " + enableMode + " [**" + object + "**] doesn't exist.");
            return;
        }
	}
}