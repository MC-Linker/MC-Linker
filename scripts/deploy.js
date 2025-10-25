//noinspection JSUnresolvedVariable
import dotenv from 'dotenv';
import { ApplicationRoleConnectionMetadataType, REST, Routes } from 'discord.js';
import { getCommand } from '../utilities/messages.js';
import keys from '../utilities/keys.js';
import fs from 'fs-extra';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config({ path: `./${process.env.DATA_FOLDER}/.env` });

/*
 * Converts the first letter of a string to uppercase.
 * @param {boolean} c - True for snake_case, false for camelCase.
 * @param {boolean} n - Whether to add a space before numbers.
 * @returns {String} - The formatted string.
 */
String.prototype.toTitleCase = function(c, n) {
    let t;
    if(c) t = this.replace(/\s/g, '').replace(n ? /([A-Z])/g : /([A-Z0-9])/g, ' $1').replace(/[_-]/g, ' ');
    else t = this;
    return t.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).trim();
};

const demandOneOf = (...options) => argv => {
    const count = options.filter(option => argv[option]).length;
    if(count < 1) {
        throw new Error(`At least one of the arguments ${new Intl.ListFormat().format(options)} is required`);
    }

    return true;
};

let deployGuild = false;
let deployGlobal = false;
let deployRoles = false;
let deleteGuild = false;
let deleteGlobal = false;
let deleteRoles = false;

await yargs(hideBin(process.argv))
    .command({
        command: 'deploy [locations]',
        aliases: 'dep',
        describe: 'Deploys the slash commands/linked roles in the specified location.',
        builder: {
            'guild': {
                type: 'boolean',
                alias: ['local', 'l'],
                description: 'Deploy the slash commands to the guild specified in the config.',
            },
            'global': {
                type: 'boolean',
                alias: ['g'],
                description: 'Deploy the slash commands to the global scope.',
            },
            'linked-roles': {
                type: 'boolean',
                alias: ['roles', 'r'],
                description: 'Deploy the linked roles to the global scope.',
            },
        },
        handler: argv => {
            if(argv.guild) deployGuild = true;
            if(argv.global) deployGlobal = true;
            if(argv['linked-roles']) deployRoles = true;
        },
    })
    .command({
        command: 'delete [locations]',
        aliases: 'del',
        describe: 'Deletes the slash commands/linked roles from the specified location.',
        builder: {
            'guild': {
                type: 'boolean',
                alias: ['local', 'l'],
                description: 'Delete the slash commands from the guild specified in the config.',
            },
            'global': {
                type: 'boolean',
                alias: ['g'],
                description: 'Delete the slash commands from the global scope.',
            },
            'linked-roles': {
                type: 'boolean',
                alias: ['roles', 'r'],
                description: 'Delete the linked roles from the global scope.',
            },
        },
        handler: argv => {
            if(argv.guild) deleteGuild = true;
            if(argv.global) deleteGlobal = true;
            if(argv['linked-roles']) deleteRoles = true;
        },
    })
    .check(demandOneOf('guild', 'global', 'linked-roles'))
    .demandCommand()
    .strict()
    .help()
    .parse();

const commands = [];
const linkedRoles = [];

if(deployGuild || deployGlobal) {
    //Get Builders and push commands
    for(const command of Object.values(keys.data)) {
        const builder = getCommand(command);

        commands.push(builder.toJSON()); //Push all commands to `commands`
        console.log(`Loaded command: ${builder.name}`);
    }

    //Push categories
    const commandFolders = fs.readdirSync('./commands/')
        .filter(file => fs.statSync(`./commands/${file}`).isDirectory());
    for(const folder of commandFolders) console.log(`Loaded category: ${folder}`);
}

if(deployRoles) {
    //Get linked roles
    for(const role of Object.values(keys.roles)) {
        role.type = ApplicationRoleConnectionMetadataType[role.type];
        linkedRoles.push(role);
        console.log(`Loaded linked role: ${role.key}`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        if(deployGuild) {
            console.log('Started deploying application guild (/) commands.');

            for(const id of process.env.GUILD_ID.split(' ')) {
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, id),
                    { body: commands },
                );
            }
            console.log('Successfully deployed application guild (/) commands.');
        }
        if(deployGlobal) {
            console.log('Started deploying application global (/) commands.');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log('Successfully deployed application global (/) commands.');
        }

        if(deployRoles) {
            console.log('Started deploying application linked roles.');
            await rest.put(Routes.applicationRoleConnectionMetadata(process.env.CLIENT_ID), {
                body: linkedRoles,
            });
            console.log('Successfully deployed application linked roles.');
        }


        if(deleteGuild) {
            console.log('Started deleting application guild (/) commands.');
            for(const id of process.env.GUILD_ID.split(' ')) {
                const resp = await rest.get(Routes.applicationGuildCommands(process.env.CLIENT_ID, id));

                for(const command of resp) {
                    await rest.delete(Routes.applicationGuildCommand(process.env.CLIENT_ID, id, command.id));
                }
            }
            console.log('Successfully deleted application guild (/) commands.');
        }
        if(deleteGlobal) {
            console.log('Started deleting application global (/) commands.');
            const resp = await rest.get(Routes.applicationCommands(process.env.CLIENT_ID));

            for(const command of resp) {
                await rest.delete(Routes.applicationCommand(process.env.CLIENT_ID, command.id));
            }
            console.log('Successfully deleted application global (/) commands.');
        }

        if(deleteRoles) {
            console.log('Started deleting application linked roles.');
            await rest.put(Routes.applicationRoleConnectionMetadata(process.env.CLIENT_ID), {
                body: {}, //Put empty body to delete all linked roles
            });
            console.log('Successfully deleted application linked roles.');
        }
    }
    catch(err) {
        console.log('Could not refresh application (/) commands or linked roles', err);
    }
})();
