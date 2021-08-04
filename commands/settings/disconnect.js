const fs =  require('fs');

module.exports = {
    name: 'disconnect',
    aliases: [''],
    usage: 'disconnect',
    example: 'disconnect',
    description: 'Disconnect your minecraft-account from the bot. To connect again, just use `^connect <minecraft-username>` again.',
    execute(message, args) {
        console.group(message.member.user.tag + ' executed ^disconnect in ' + message.guild.name);

        fs.unlink(`./connections/${message.member.user.id}.json`, err => {
            if(err) {
                console.log('Error trying to delete connection-file.', err);
                message.reply(':warning: Couldnt disconnect you. You are most likely **not connected**.');
                return;
            }
            console.log('Successfully disconnected ' + message.member.user.tag + '.');
            message.reply('<:Checkmark:849224496232660992> The connection to this bot was successfully disconnected.');
            console.groupEnd();
        })
	}
}