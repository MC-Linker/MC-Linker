const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { token, clientId } = require('../config.json');
const fs = require('fs');

const commands = [];

const guildId = '844156404477853716';

const commandFolders = fs.readdirSync('./commands/');
for (const folder of commandFolders) {
	const commandFiles = fs.readdirSync(`./commands/${folder}`);
	for (const file of commandFiles) {
		const command = require(`./commands/${folder}/${file}`);
        if(command.data) {
            commands.push(command.data.toJSON());
        }
	}
}

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (err) {
		console.log('Error while reloading application (/) commands.', err);
	}
})();