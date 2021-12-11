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
    async execute(message, args) {
        let type = args[0];
        let toEnable = args[1];

        if(!type) {
            console.log(`${message.member.user.tag} executed /enable without type in ${message.guild.name}`);
            message.reply(':warning: Please specify the type you want to enable (`commands`, `stats`, `advancements`).');
            return;
        } else if(!toEnable) {
            console.log(`${message.member.user.tag} executed /enable without toEnable in ${message.guild.name}`);
            message.reply(':warning: Please specify the command, stat or advancement you want to enable.');
            return;
        }

        console.log(`${message.member.user.tag} executed /enable ${type} ${toEnable} in ${message.guild.name}`);

        if (type === 'command' || type === 'cmd' || type === 'commands' || type === 'cmds') type = 'commands';
        else if (type === 'advancements' || message.client.commands.get('advancements').aliases.includes(type)) type = 'advancements';
        else if (type === 'stats' || message.client.commands.get('stats').aliases.includes(type)) type = 'stats';
        else {
            console.log(`${message.member.user.tag} executed /enable with wrong type in ${message.guild.name}`);
            message.reply(':warning: You can only enable `commands`, `stats` or `advancements`.');
            return;
        }

        if(type === 'commands') {
            toEnable = ( message.client.commands.get(toEnable) ?? message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(toEnable)) )?.name;

            if(!toEnable) {
                console.log(`Command [${toEnable}] doesn't exist.`);
                message.reply(`:warning: Command [**${toEnable}**] doesn't exist.`);
                return;
            }
        }

        fs.rm(`./disable/${type}/${message.guild.id}_${toEnable}`, err => {
            if (err) {
                console.log(`Error trying to delete ${type} EnableFile of ${toEnable}`, err);
                message.reply(`<:Error:849215023264169985> Could not enable ${type} [**${toEnable}**]. Is it already enabled?`);
                return;
            }
            console.log(`Successfully deleted ${type} EnableFile [` + `./disable/${type}/${message.guild.id}_${toEnable}` + '].');
            message.reply(`<:Checkmark:849224496232660992> Successfully enabled ${type} [**${toEnable}**].`);
        });
	}
}