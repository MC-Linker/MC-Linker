module.exports = {
    name: 'enable',
    aliases: [''],
    usage: 'e.g. DISABLE',
    example: 'e.g. DISABLE',
    description: 'Enable a disabled command/stat/advancement (Theyre all enabled by default)',
    execute(message, args) {
        const fs = require('fs');

        const enableMode = (args[0]);
        const mode = (args[1]);
        const object = (args[2]);

        if(!enableMode || !mode) {
            console.log(message.member.user.tag + 'executed ^enable wrong in ' + message.guild.name);
            message.reply(":warning: Wrong Usage! Check ^help enable for correct usage!");
            return;
        }

        console.log(message.member.user.tag + ' executed ^enable ' + enableMode + ' ' + mode + ' ' + object + ' in ' + message.guild.name);

        if (enableMode === 'command') {
            try {
                const command = message.client.commands.get(mode) || message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(mode));
                fs.unlink(`./disable/command/${message.guild.id}_${command.name}`, (err) => {
                    if (err) {
                        console.log('Error trying to delete commandDisableFile of ' + command.name);
                        message.reply('<:Error:849215023264169985> Could not enable command!');
                        return;
                    } else {
                        console.log('Succesfully deleted commandDisableFile [' + `./disable/command/${message.guild.id}_${command.name}` + '].');
                        message.reply('<:Checkmark:849224496232660992> Succesfully enabled command [**' + command.name + '**].')
                    }
                });
            } catch (err) {
                console.log("Command [" + mode + "] doesn't exist.", err);
                message.reply(":warning: Command [**" + mode + "**] doesn't exist.");
                return;
            }
        } else if (enableMode === message.client.commands.get('stats').name || message.client.commands.get('stats').aliases.includes(enableMode)) {
            if(!object) {
                console.log("Wrong Usage of ^disable advancements");
                message.reply(":warning: Wrong Usage! Check ^help disable for correct usage!");
                return; 
            }

            if (mode === 'category') {
                fs.unlink(`./disable/stats/category/${message.guild.id}_${object}`, (err) => {
                    if(err) {
                        console.log('Error trying to delete statDisableFile of ' + object, err);
                        message.reply('<:Error:849215023264169985> Could not enable stat category [**' + object + '**]! Is it already enabled?');
                        return;
                    } else {
                        console.log('Succesfully deleted statDisableFile [' + `./disable/command/category/${message.guild.id}_${object}` + '].');
                        message.reply('<:Checkmark:849224496232660992> Succesfully enabled stat category [**' + object + '**].')
                    }
                });
            } else if (mode === 'object') {
                fs.unlink(`./disable/stats/object/${message.guild.id}_${object}`, (err) => {
                    if(err) {
                        console.log('Error trying to delete statDisableFile of ' + object, err);
                        message.reply('<:Error:849215023264169985> Could not enable stat object [**' + object + '**]! Is it already enabled?');
                        return;
                    } else {
                        console.log('Succesfully deleted statDisableFile [' + `./disable/command/object${message.guild.id}_${object}` + '].');
                        message.reply('<:Checkmark:849224496232660992> Succesfully enabled stat object [**' + object + '**].')
                    }
                });
            } else {
                console.log("Wrong Usage of ^disable");
                message.reply(":warning: Wrong Usage! Check ^help disable for correct usage!");
                return; 
            }
        } else if (enableMode === message.client.commands.get('advancements').name || message.client.commands.get('advancements').aliases.includes(enableMode)) {
            if(!object) {
                console.log("Wrong Usage of ^disable advancements");
                message.reply(":warning: Wrong Usage! Check ^help disable for correct usage!");
                return; 
            }

            if(!object) {
                console.log("Wrong Usage of ^disable advancements");
                message.reply(":warning: Wrong Usage! Check ^help disable for correct usage!");
                return; 
            }

            if (mode === 'category') {
                fs.unlink(`./disable/advancements/category/${message.guild.id}_${object}`, (err) => {
                    if(err) {
                        console.log('Error trying to delete advancementDisableFile of ' + object, err);
                        message.reply('<:Error:849215023264169985> Could not enable advancement category [**' + object + '**]! Is it already enabled?');
                        return;
                    } else {
                        console.log('Succesfully deleted advancementDisableFile [' + `./disable/advancement/category/${message.guild.id}_${object}` + '].');
                        message.reply('<:Checkmark:849224496232660992> Succesfully enabled advancement category [**' + object + '**].');
                    }
                });
            } else if (mode === 'object') {
                fs.unlink(`./disable/advancements/object/${message.guild.id}_${object}`, (err) => {
                    if(err) {
                        console.log('Error trying to delete advancementDisableFile of ' + object, err);
                        message.reply('<:Error:849215023264169985> Could not enable advancement object [**' + object + '**]! Is it already enabled?');
                        return;
                    } else {
                        console.log('Succesfully deleted advancementDisableFile [' + `./disable/advancement/object/${message.guild.id}_${object}` + '].');
                        message.reply('<:Checkmark:849224496232660992> Succesfully enabled advancement object [**' + object + '**].');
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