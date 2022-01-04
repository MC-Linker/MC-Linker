const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { token, clientId } = require('./config.json');
const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');

/*
 * Converts the first letter of a string to uppercase.
 * @returns {String} The formatted string.
 */
String.prototype.cap = function() {
	return this[0].toUpperCase() + this.slice(1, this.length).toLowerCase()
};

const guildId = '844156404477853716';

const helpData = new SlashCommandBuilder()
	.setName('help')
	.setDescription('Detailed Description of every command.')
	.addStringOption(option =>
		option.setName('command')
		.setDescription('Set the command of which you want to get information.')
		.setRequired(false)
	);
// @ts-ignore
helpData.options[0].choices = [];
const commands = [];

const disableChoices = [];
const enableChoices = [];
let disableJson;
let enableJson;

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

		disableChoices.push({ name: command.name.cap(), value: command.name});

		helpData.options[0].choices.push({ name: command.name.cap(), value: command.name });
		console.log(`Loaded command: ${command.name}`);
	}
}
disableJson.options[0].options[0].choices = disableChoices;
commands.push(disableJson);

commands.push(helpData.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
		console.log('Started refreshing application guild (/) commands.');
		await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		/*console.log('Started refreshing application global (/) commands.');
		await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands },
		);*/

		console.log('Successfully reloaded application (/) commands.');
	} catch (err) {
		console.log('Error while reloading application (/) commands.', err);
	}
})();