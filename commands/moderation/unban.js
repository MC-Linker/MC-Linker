const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Discord = require('discord.js');
const { keys } = require('../../api/messages');

async function execute(message, args) {
	const username = message.mentions.users.first()?.tag ?? args[0];
	const argPlaceholder = { username };

	if (!message.member.permissions.has(Discord.Permissions.FLAGS.BAN_MEMBERS)) {
		message.respond(keys.commands.unban.warnings.no_permission);
		return;
	} else if(!username) {
		message.respond(keys.commands.unban.warnings.no_username);
		return;
	}

	const mcUsername = message.mentions.users.first()?.id ? await utils.getUsername(message.mentions.users.first()?.id, message) : username;
	if(!mcUsername) return;

	const resp = await plugin.execute(`pardon ${mcUsername}`, message);
	if(!resp) return;

	if(resp.startsWith('&c')) message.respond(keys.commands.unban.warnings.response_warning, argPlaceholder, { "response": resp });
	else if(resp.startsWith('Could not fetch response message!')) message.respond(keys.commands.unban.warnings.no_response, argPlaceholder);
	else message.respond(keys.commands.unban.success, argPlaceholder);
}

module.exports = { execute };