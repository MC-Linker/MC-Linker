// noinspection JSCheckFunctionSignatures

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { token, clientId, guildId } = require('../config.json');
const { keys, getCommandBuilder} = require('../api/messages');
const fs = require('fs');

/*
 * Converts the first letter of a string to uppercase.
 * @returns {String} The formatted string.
 */
String.prototype.cap = function() {
	return this[0].toUpperCase() + this.slice(1, this.length).toLowerCase()
};

let deployGuild = false;
let deployGlobal = false;
let deleteGuild = false;
let deleteGlobal = false;

process.argv.slice(2).forEach(arg => {
	arg = arg.split('=');
	arg[1] = arg[1].split(',');

	if(arg[0] === 'deploy') {
		arg[1].forEach(type => {
			if(type === 'guild') deployGuild = true;
			else if(type === 'global') deployGlobal = true;
		});
	}
	if(arg[0] === 'delete') {
		arg[1].forEach(type => {
			if(type === 'guild') deleteGuild = true;
			else if(type === 'global') deleteGlobal = true;
		});
	}
});

const helpChoices = [];
let helpJson;

const disableChoices = [];
let disableJson;

const commands = [];

//Get Builders and push commands
for(const command of Object.values(keys.data)) {
	const builder = getCommandBuilder(command);

	if(command.name === 'disable') disableJson = builder.toJSON();
	else if(command.name === 'help') helpJson = builder.toJSON();
	else commands.push(builder.toJSON()); //Push all commands to `commands`

	if(command.name !== 'enable' && command.name !== 'disable' && command.name !== 'help') disableChoices.push({ name: command.name.cap(), value: command.name });
	if(command.name !== 'help') helpChoices.push({ name: command.name.cap(), value: command.name });

	console.log(`Loaded command: ${command.name}`);
}

//Push categories
const commandFolders = fs.readdirSync('./commands/');
for (const folder of commandFolders) {
	helpChoices.push({ name: folder.cap(), value: folder });
	console.log(`Loaded category: ${folder}`);
}


disableJson.options[0].options[0].choices = disableChoices; //Set command choices
helpJson.options[0].choices = helpChoices; //Set command and category choices
commands.push(disableJson);
commands.push(helpJson);


const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
		if(deployGuild) {
			console.log('Started deploying application guild (/) commands.');
			await rest.put(
				Routes.applicationGuildCommands(clientId, guildId),
				{ body: commands },
			);
		}
		if(deployGlobal) {
			console.log('Started deploying application global (/) commands.');
			await rest.put(
				Routes.applicationCommands(clientId),
				{ body: commands },
			);
		}

		if(deleteGuild) {
			console.log('Started deleting application guild (/) commands.');
			const resp = await rest.get(Routes.applicationGuildCommands(clientId, guildId));

			for (const command of resp) {
				await rest.delete(`${Routes.applicationGuildCommands(clientId, guildId)}/${command.id}`);
			}
		}
		if(deleteGlobal) {
			console.log('Started deleting application global (/) commands.');
			const resp = await rest.get(Routes.applicationCommands(clientId));

			for (const command of resp) {
				await rest.delete(`${Routes.applicationCommands(clientId)}/${command.id}`);
			}
		}

		console.log('Successfully refreshed application (/) commands.');
	} catch (err) {
		console.log('Could not refresh application (/) commands.', err);
	}
})();