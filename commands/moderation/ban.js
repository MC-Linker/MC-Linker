const utils = require('../../api/utils');
const plugin = require('../../api/plugin');
const Discord = require('discord.js');
const { keys } = require('../../api/messages');

async function execute(message, args) {
	const username = message.mentions.users.first()?.tag ?? args[0];
	args.shift();
	let reason = args[0] ? args.join(' ') : 'Banned by an operator.';
	const argPlaceholder = { username, reason };

	if (!message.member.permissions.has(Discord.Permissions.FLAGS.BAN_MEMBERS)) {
		message.respond(keys.commands.ban.warnings.no_permission);
		return;
	} else if(!username) {
		message.respond(keys.commands.ban.warnings.no_username);
		return;
	}

	const mcUsername = message.mentions.users.first()?.id ? await utils.getUsername(message.mentions.users.first()?.id, message) : username;
	if(!mcUsername) return;

	const resp = await plugin.execute(`ban ${mcUsername} ${reason}`, message);
	if(!resp) return;


	if(resp.startsWith('&c')) message.respond(keys.commands.ban.warnings.response_warning, argPlaceholder, { "response": resp });
	else if(resp.startsWith('Could not fetch response message!')) message.respond(keys.commands.ban.warnings.no_response, argPlaceholder);
	else message.respond(keys.commands.ban.success, argPlaceholder);
}

module.exports = { execute };