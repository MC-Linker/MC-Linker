module.exports = {
    name: 'ban',
    aliases: ['banplayer', 'banuser'],
    usage: 'ban <mention/username>',
    example: 'ban @Lianecx **//** ban cheaterGuy',
    description: 'Ban a player from the **minecraft server**. Can only be used with `Ban member` permission!',
    async execute(message, args) {
		const utils = require('../utils');
		const ftp = require('../ftpConnect');
		
		let reason;
		for(let i = 1; i<args.length; i++) {
			reason += args[i];
		}
		if(!args[1]) reason = 'No specified reason.';

		const taggedUser = (args[0]);
        if(!taggedUser) {
            console.log(message.member.user.tag + ' executed ^ban without user in ' + message.guild.name);
            message.reply('Please specify the player you want to ban.');
            return;
        }
		let taggedName;
		if(!message.mentions.users.size) {
            taggedName = (args[0]);
        } else {
            taggedName = message.mentions.users.first().tag;
        }
		console.log(message.member.user.tag + ' executed ^ban in ' + message.guild.name)

		if (!message.guild.me.hasPermission("BAN_MEMBERS")) {
			message.reply(':warning: ' + "This command can only be used with `Ban member` permission!");
            console.log(message.member.user.tag + ' executed ^ban without banperm in ' + message.guild.name);
            return;
		}
		const uuidv4 = await utils.getUUIDv4(taggedUser, message);
        if(uuidv4 === undefined) {
            return;
        }
		let worldPath = await utils.getWorldPath(message);
		if(worldPath === undefined) {
            return;
        }
		worldPath = worldPath.split('/');
		let path = worldPath[0];
		if(path === '') path = worldPath[1];
		await ftp.get(`${path}/banned-players.json`, `./ban/${message.guild.id}.json`, message);
	}
}