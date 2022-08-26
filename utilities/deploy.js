//noinspection JSUnresolvedVariable

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { token, clientId, guildId } = require('../config.json');
const { keys, getCommand } = require('../api/messages');
const fs = require('fs-extra');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

/*
 * Converts the first letter of a string to uppercase.
 * @returns {String} The formatted string.
 */
String.prototype.cap = function() {
    return this[0].toUpperCase() + this.slice(1, this.length).toLowerCase();
};

let deployGuild = false;
let deployGlobal = false;
let deleteGuild = false;
let deleteGlobal = false;

const argv = yargs(hideBin(process.argv))
    .command(['deploy [location]', 'dep'], 'Deploys the slash commands in the specified location.')
    .command(['delete [location]', 'del'], 'Deletes the slash commands from the specified location.')
    .option('location', {
        description: 'The location to deploy the commands to. Valid locations are: guild, global, all. If no location is specified, the commands will be deployed globally.',
        type: 'string',
        choices: ['guild', 'global', 'all'],
        default: 'global',
        global: true,
        alias: ['loc', 'l'],
    })
    .strict()
    .demandCommand()
    .help()
    .argv;

if(argv._.includes('deploy') || argv._.includes('dep')) {
    deployGuild = argv.location.includes('guild') || argv.location.includes('all');
    deployGlobal = argv.location.includes('global') || argv.location.includes('all');
}
if(argv._.includes('delete') || argv._.includes('del')) {
    deleteGuild = argv.location.includes('guild') || argv.location.includes('all');
    deleteGlobal = argv.location.includes('global') || argv.location.includes('all');
}


const excludedDisable = ['enable', 'disable', 'help'];
const excludedHelp = ['help'];

const helpChoices = [];
let helpBuilder;

const disableChoices = [];
let disableBuilder;

const commands = [];

//Get Builders and push commands
for(const command of Object.values(keys.data)) {
    const builder = getCommand(command);

    if(builder.name === 'disable') disableBuilder = builder;
    else if(builder.name === 'help') helpBuilder = builder;
    else commands.push(builder.toJSON()); //Push all commands to `commands`

    //Push command choices
    if(!excludedDisable.includes(builder.name))
        disableChoices.push({ name: builder.name.cap(), value: builder.name });
    if(!excludedHelp.includes(builder.name))
        helpChoices.push({ name: builder.name.cap(), value: builder.name });

    console.log(`Loaded command: ${builder.name}`);
}

//Push categories
const commandFolders = fs.readdirSync('./commands/');
for(const folder of commandFolders) {
    helpChoices.push({ name: folder.cap(), value: folder });
    console.log(`Loaded category: ${folder}`);
}

//Push command choices
disableBuilder.options[0].options[0].choices = disableChoices; //Set command choices
helpBuilder.options[0].choices = helpChoices; //Set command and category choices

commands.push(disableBuilder.toJSON());
commands.push(helpBuilder.toJSON());


// noinspection JSCheckFunctionSignatures,JSClosureCompilerSyntax
const rest = new REST({ version: '10' }).setToken(token);

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

            for(const command of resp) {
                await rest.delete(`${Routes.applicationGuildCommands(clientId, guildId)}/${command.id}`);
            }
        }
        if(deleteGlobal) {
            console.log('Started deleting application global (/) commands.');
            const resp = await rest.get(Routes.applicationCommands(clientId));

            for(const command of resp) {
                await rest.delete(`${Routes.applicationCommands(clientId)}/${command.id}`);
            }
        }

        console.log('Successfully refreshed application (/) commands.');
    }
    catch(err) {
        console.log('Could not refresh application (/) commands.', err);
    }
})();