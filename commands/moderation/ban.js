const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Discord = require('discord.js');
const { keys } = require('../../api/messages');

async function execute(message, args) {
	const user = message.mentions.users.first() ?? args[0];
	args.shift(); // Shift user
	let reason = args[0] ? args.join(' ') : 'Banned by an operator.';

	if (!message.member.permissions.has(Discord.Permissions.FLAGS.BAN_MEMBERS)) {
		message.respond(keys.commands.ban.warnings.no_permission);
		return;
	} else if(!user) {
		message.respond(keys.commands.ban.warnings.no_username);
		return;
	}

	const mcUsername = user.id ? await utils.getUsername(user.id, message) : user;
	if(!mcUsername) return;

	const resp = await plugin.execute(`ban ${mcUsername} ${reason}`, message.guildId, message);
	if(!resp) return;

	if(resp.status === 206) message.respond(keys.commands.ban.warnings.response_warning, { username: user, reason });
	else message.respond(keys.commands.ban.success, { username: user, reason });
}

module.exports = { execute };