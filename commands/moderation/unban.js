const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Discord = require('discord.js');
const { keys } = require('../../api/messages');

async function execute(message, args) {
	const user = message.mentions.users.first() ?? args[0];

	if (!message.member.permissions.has(Discord.Permissions.FLAGS.BAN_MEMBERS)) {
		message.respond(keys.commands.unban.warnings.no_permission);
		return;
	} else if(!user) {
		message.respond(keys.commands.unban.warnings.no_username);
		return;
	}

	const mcUsername = user.id ? await utils.getUsername(user.id, message) : user;
	if(!mcUsername) return;

	const resp = await plugin.execute(`pardon ${mcUsername}`, message);
	if(!resp) return;

	if(resp.startsWith('&c')) message.respond(keys.commands.unban.warnings.response_warning, { username: user, "response": resp });
	else if(resp.startsWith('Could not fetch response message!')) message.respond(keys.commands.unban.warnings.no_response, { username: user });
	else message.respond(keys.commands.unban.success, { username: user });
}

module.exports = { execute };