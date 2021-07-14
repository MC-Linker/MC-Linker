module.exports = {
    name: 'disable',
    aliases: ['unable'],
    usage: 'disable command <command> **//** disable stats category/object <category/object **id**> **//** disable advancements category/advancement <category/advancement **id**>',
    example: 'disable command pingchain **//** disable stats category picked_up **//** disable advancements advancement adventuring_time **//** disable advancements category story',
    description: 'Disable a specific command/stat/advancement. \n COmmand-disabling is also possible through buttons in ^help <command>',
    execute(message, args) {
        const fs = require('fs');

        const disableMode = (args[0]);
        const mode = (args[1]);
        const object = (args[2]);

        if(!disableMode || !mode) {
            console.log(message.member.user.tag + "executed ^disable wrong in " + message.guild.name);
            message.reply(":warning: Wrong Usage! Check ^help disable for correct usage!");
            return;
        }
        console.log(message.member.user.tag + ' executed ^disable ' + disableMode + ' ' + mode + ' ' + object + ' in ' + message.guild.id);

        if (disableMode === 'command') {
            try {
                const command = message.client.commands.get(mode) || message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(mode));
                fs.writeFile(`./disable/command/${message.guild.id}_${command.name}`, '', (err) => {
                    if (err) {
                        console.log('Error trying to write commandDisableFile of ' + command.name);
                        message.reply('<:Error:849215023264169985> Could not disable command!');
                        return;
                    } else {
                        console.log('Succesfully wrote commandDisableFile [' + `./disable/command/${message.guild.id}_${command.name}` + '].');
                        message.reply('<:Checkmark:849224496232660992> Succesfully disabled command [**' + command.name + '**].')
                    }
                });
            } catch (err) {
                console.log("Command [" + mode + "] doesn't exist.", err);
                message.reply(":warning: Command [**" + mode + "**] doesn't exist.");
                return;
            }
        } else if (disableMode === message.client.commands.get('stats').name || message.client.commands.get('stats').aliases.includes(disableMode)) {
            if(!object) {
                console.log("Wrong Usage of ^disable advancements");
                message.reply(":warning: Wrong Usage! Check ^help disable for correct usage!");
                return; 
            }

            if (mode === 'category') {
                fs.writeFile(`./disable/stats/category/${message.guild.id}_${object}`, '', (err) => {
                    if(err) {
                        console.log('Error trying to write statDisableFile of ' + object, err);
                        message.reply('<:Error:849215023264169985> Could not disable stat category [**' + object + '**]!');
                        return;
                    } else {
                        console.log('Succesfully wrote statDisableFile [' + `./disable/command/category/${message.guild.id}_${object}` + '].');
                        message.reply('<:Checkmark:849224496232660992> Succesfully disabled stat category [**' + object + '**].')
                    }
                });
            } else if (mode === 'object') {
                fs.writeFile(`./disable/stats/object/${message.guild.id}_${object}`, '', (err) => {
                    if(err) {
                        console.log('Error trying to write statDisableFile of ' + object, err);
                        message.reply('<:Error:849215023264169985> Could not disable stat object [**' + object + '**]!');
                        return;
                    } else {
                        console.log('Succesfully wrote statDisableFile [' + `./disable/command/object/${message.guild.id}_${object}` + '].');
                        message.reply('<:Checkmark:849224496232660992> Succesfully disabled stat object [**' + object + '**].')
                    }
                });
            } else {
                console.log("Wrong Usage of ^disable");
                message.reply(":warning: Wrong Usage! Check ^help disable for correct usage!");
                return; 
            }
        } else if (disableMode === message.client.commands.get('advancements').name || message.client.commands.get('advancements').aliases.includes(disableMode)) {
            if(!object) {
                console.log("Wrong Usage of ^disable advancements");
                message.reply(":warning: Wrong Usage! Check ^help disable for correct usage!");
                return; 
            }

            if (mode === 'category') {
                fs.writeFile(`./disable/advancements/category/${message.guild.id}_${object}`, '', (err) => {
                    if(err) {
                        console.log('Error trying to write advancementDisableFile of ' + object, err);
                        message.reply('<:Error:849215023264169985> Could not disable advancement category [**' + object + '**]!');
                        return;
                    } else {
                        console.log('Succesfully wrote advancementDisableFile [' + `./disable/advancement/category/${message.guild.id}_${object}` + '].');
                        message.reply('<:Checkmark:849224496232660992> Succesfully disabled advancement category [**' + object + '**].')
                    }
                });
            } else if (mode === 'object') {
                fs.writeFile(`./disable/advancements/object/${message.guild.id}_${object}`, '', (err) => {
                    if(err) {
                        console.log('Error trying to write advancementDisableFile of ' + object, err);
                        message.reply('<:Error:849215023264169985> Could not disable advancement object [**' + object + '**]!');
                        return;
                    } else {
                        console.log('Succesfully wrote advancementDisableFile [' + `./disable/advancement/object/${message.guild.id}_${object}` + '].');
                        message.reply('<:Checkmark:849224496232660992> Succesfully disabled advancement object [**' + object + '**].')
                    }
                });
            } else {
                console.log("Wrong Usage of ^disable");
                message.reply(":warning: Wrong Usage! Check ^help disable for correct usage!");
                return; 
            }
        } else {
            console.log("Wrong Usage of ^disable");
            message.reply(":warning: Wrong Usage! Check ^help disable for correct usage!");
            return; 
        }
	}
}