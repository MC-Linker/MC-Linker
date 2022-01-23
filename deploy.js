const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { token, clientId } = require('./config.json');
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

const guildId = '844156404477853716';

const helpData = require('./src/help').data.toJSON();
helpData.options[0].choices = [];
const commands = [];

const disableChoices = [];
let disableJson;

const commandFolders = fs.readdirSync('./commands/');
for (const folder of commandFolders) {
	const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
	// @ts-ignore
	helpData.options[0].choices.push({ name: folder.cap(), value: folder });
	console.log(`Loaded category: ${folder}`);

	for (const file of commandFiles) {
		const command = require(`./commands/${folder}/${file}`);

		if(command.name === 'disable') disableJson = command.data.toJSON();
		else commands.push(command.data.toJSON());

		if(command.name !== 'enable' || command.name !== 'disable') disableChoices.push({ name: command.name.cap(), value: command.name });
		helpData.options[0].choices.push({ name: command.name.cap(), value: command.name });

		console.log(`Loaded command: ${command.name}`);
	}
}

disableJson.options[0].options[0].choices = disableChoices;
commands.push(disableJson);
commands.push(helpData);

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
			const resp = await rest.get(Routes.applicationCommands(clientId));

			for (const command of resp) {
				const deleteUrl = `${Routes.applicationCommands(clientId)}/${command.id}`;
				await rest.delete(deleteUrl);
			}
		}
		if(deleteGlobal) {
			console.log('Started deleting application global (/) commands.');
			const resp = await rest.get(Routes.applicationGuildCommands(clientId, guildId));

			for (const command of resp) {
				const deleteUrl = `${Routes.applicationGuildCommands(clientId, guildId)}/${command.id}`;
				await rest.delete(deleteUrl);
			}
		}

		console.log('Successfully reloaded application (/) commands.');
	} catch (err) {
		console.log('Error while reloading application (/) commands.', err);
	}
})();