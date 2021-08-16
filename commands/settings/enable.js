module.exports = {
    name: 'enable',
    aliases: [''],
    usage: 'enable commands/stats/advancements <command/stat/advancement>',
    example: 'enable commands txp **//** enable stats picked_up **//** enable advancements adventuring_time',
    description: 'Enable a disabled command/stat/advancement (Theyre all enabled by default). Command-enabling is also possible through buttons in ^help <command>.',
    execute(message, args) {
        const fs = require('fs');

        const mode = (args[0]);
        const object = (args[1]);

        if(!mode || !object) {
            console.log(message.member.user.tag + ' executed ^enable wrong in ' + message.guild.name);
            message.reply(":warning: Wrong Usage! Check `^help enable` for correct usage!");
            return;
        }

        console.log(message.member.user.tag + ' executed ^enable ' + mode + ' ' + object + ' in ' + message.guild.name);

        let enableMode;
        if (mode === 'command' || mode === 'cmd' || mode === 'commands' || mode === 'cmds') enableMode = 'commands';
        else if (mode === message.client.commands.get('advancements').name || message.client.commands.get('advancements').aliases.includes(mode)) enableMode = 'advancements';
        else if (mode === message.client.commands.get('stats').name || message.client.commands.get('stats').aliases.includes(mode)) enableMode = 'stats';
        else {
            console.log(message.member.user.tag + ' executed ^enable wrong in ' + message.guild.name);
            message.reply(":warning: Wrong Usage! Check `^help enable` for correct usage!");
            return;
        }

        try {
            if(enableMode === 'commands') object = message.client.commands.get(object).name || message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(object).name);
            fs.unlink(`./disable/${enableMode}/${message.guild.id}_${object}`, err => {
                if (err) {
                    console.log(`Error trying to delete ${enableMode} EnableFile of ` + object, err);
                    message.reply(`<:Error:849215023264169985> Could not enable ${enableMode} [**${object}**]. Is it already enabled?`);
                    return;
                }
                console.log(`Succesfully deleted ${enableMode} EnableFile [` + `./disable/${enableMode}/${message.guild.id}_${object}` + '].');
                message.reply(`<:Checkmark:849224496232660992> Succesfully enabled ${enableMode} [**` + object + '**].');
            });
        } catch (err) {
            console.log(enableMode + " [" + object + "] doesn't exist.", err);
            message.reply(":warning: " + enableMode + " [**" + object + "**] doesn't exist.");
            return;
        }
	}
}