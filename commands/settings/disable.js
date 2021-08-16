const Discord = require('discord.js')
const fs = require('fs');

module.exports = {
    name: 'disable',
    aliases: ['unable'],
    usage: 'disable commands/stats/advancements <command/stat/advancement> **//**\ndisable list commands/stats/advancements',
    example: 'disable commands txp **//** disable stats picked_up **//** disable advancements adventuring_time **//** disable list commands',
    description: 'Disable a specific command/stat/advancement. List of disabled commands/stats/advancements with `^disable list`.\n Command-disabling is also possible through buttons in ^help <command>.',
    execute(message, args) {
        const mode = (args[0]);
        let object = (args[1]);

        if(!mode || !object) {
            console.log(message.member.user.tag + ' executed ^disable wrong in ' + message.guild.name);
            message.reply(":warning: Wrong Usage! Check `^help disable` for correct usage!");

        } else if (mode === 'list') {
            let listMode;
            if (object === 'command' || object === 'cmd' || object === 'commands' || object === 'cmds') listMode = 'commands';
            else if (object === message.client.commands.get('advancements').name || message.client.commands.get('advancements').aliases.includes(object)) listMode = 'advancements';
            else if (object === message.client.commands.get('stats').name || message.client.commands.get('stats').aliases.includes(object)) listMode = 'stats';
            else {
                console.log(message.member.user.tag + ' executed ^disable list wrong. ListObject: ' + object + ' in ' + message.guild.name);
                message.reply(":warning: Wrong Usage! You can only list `stats`, `commands` and `advancements`.");
                return;
            }

            console.log(message.member.user.tag + ' executed ^disable list ' + object + ' in ' + message.guild.name);

            fs.readdir(`./disable/${listMode}`, (err, list) => {
                if(err) {
                    console.log('Error reading disableList [' + listMode + '] dir.', err);
                    message.reply('<:Error:849215023264169985> Error trying to list disabled commands.');
                    return;
                }

                const indexGit = list.indexOf('GitInit.json');
                if (indexGit > -1) list.splice(indexGit, 1);
                
                if(list.length === 0) {
                    console.log(`No disabled ${listMode}.`);
                    message.reply(`<:Checkmark:849224496232660992> No disabled ${listMode} :)`);
                    return;
                } else {
                    const listEmbed = new Discord.MessageEmbed()
                    .setTitle('Disable List')
                    .setColor('RED')
                    .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                    .addField(`==============\nDisabled ${listMode}`, '**==============**')
                    list.forEach(entry => {
                        entry = entry.replace(`${message.guild.id}_`, '');
                        entry = entry.toUpperCase();
                        listEmbed.addField(entry, '\u200B');
                    });
                    message.channel.send({ embeds: [listEmbed] });
                }
            });

        } else {
            console.log(message.member.user.tag + ' executed ^disable ' + mode + ' ' + object + ' in ' + message.guild.name);

            let disableMode;
            if (mode === 'command' || mode === 'cmd' || mode === 'commands' || mode === 'cmds') disableMode = 'commands';
            else if (mode === message.client.commands.get('advancements').name || message.client.commands.get('advancements').aliases.includes(mode)) disableMode = 'advancements';
            else if (mode === message.client.commands.get('stats').name || message.client.commands.get('stats').aliases.includes(mode)) disableMode = 'stats';
            else {
                console.log("Wrong Usage of ^disable");
                message.reply(":warning: Wrong Usage! Check `^help disable` for correct usage!");
                return;
            }

            try {
                if(disableMode === 'commands') object = message.client.commands.get(object).name || message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(object).name);
                fs.writeFile(`./disable/${disableMode}/${message.guild.id}_${object}`, '', err => {
                    if (err) {
                        console.log(`Error trying to write ${disableMode} DisableFile of ` + object, err);
                        message.reply(`<:Error:849215023264169985> Could not disable ${disableMode} [${object}}]!`);
                        return;
                    }
                    console.log(`Succesfully wrote ${disableMode} DisableFile [` + `./disable/${disableMode}/${message.guild.id}_${object}` + '].');
                    message.reply(`<:Checkmark:849224496232660992> Succesfully disabled ${disableMode} [**` + object + '**].');
                });
            } catch (err) {
                console.log(disableMode + " [" + object + "] doesn't exist.", err);
                message.reply(":warning: " + disableMode + " [**" + object + "**] doesn't exist.");
                return;
            }

        }
	}
}