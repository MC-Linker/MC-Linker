console.log(
    '\x1b[1m' +     // Bold (1)
    '\x1b[44;37m' + // Blue BG (44); White FG (37)
    '%s' +          // Insert second argument
    '\x1b[0m',      // Reset color (0)
    'Loading...',   // Second argument (%s)
);

const Discord = require('discord.js');
const { AutoPoster } = require('topgg-autoposter');
const Canvas = require('@napi-rs/canvas');
const plugin = require('./api/plugin');
const helpCommand = require('./src/help');
const evalCommand = require('./src/eval');
const disableButton = require('./buttons/disable');
const enableButton = require('./buttons/enable');
const { getArgs, addResponseMethods, addPh, keys, ph } = require('./api/messages');
const { prefix, token, topggToken, ownerId } = require('./config.json');
const MCLinker = require('./structures/MCLinker');
const AutocompleteCommand = require('./structures/AutocompleteCommand');

const client = new MCLinker();

//Handle rejected promises
process.on('unhandledRejection', async err => {
    console.log(addPh(keys.main.errors.unknown_rejection.console, ph.error(err)));
});

/*
 * Converts the first letter of a string to uppercase.
 * @returns {String} The formatted string.
 */
String.prototype.cap = function() {
    return this[0].toUpperCase() + this.slice(1, this.length).toLowerCase();
};

if(topggToken) {
    const poster = AutoPoster(topggToken, client);

    poster.on('posted', () => {});
    poster.on('error', () => console.log(keys.main.errors.could_not_post_stats.console));
}

client.once('ready', async () => {
    console.log(addPh(
        keys.main.success.login.console,
        ph.client(client),
        { prefix, 'guild_count': client.guilds.cache.size },
    ));
    client.user.setActivity({ type: Discord.ActivityType.Listening, name: '/help' });

    await plugin.loadExpress(client);

    Canvas.GlobalFonts.registerFromPath('./resources/fonts/Minecraft.ttf', 'Minecraft');
});

client.on('guildCreate', guild => {
    console.log(addPh(keys.main.success.guild_create.console, ph.guild(guild), { 'guild_count': client.guilds.cache.size }));
});

client.on('guildDelete', async guild => {
    if (!client.isReady() || !guild.available) return; //Prevent server outages from deleting data
    console.log(addPh(keys.main.success.guild_delete.console, ph.guild(guild), { 'guild_count': client.guilds.cache.size }));

    await client.serverConnections.disconnect(guild.id);
});

client.on('messageCreate', async message => {
    const server = client.serverConnections.cache.get(message.guildId);
    if(!message.content.startsWith(prefix) && server) {
        let content = message.cleanContent;
        message.attachments?.forEach(attach => content += ` \n [${attach.name}](${attach.url})`);
        server?.protocol?.chat(content);
    }

    message = addResponseMethods(message);

    if(message.content === `<@${client.user.id}>` || message.content === `<@!${client.user.id}>`) return message.respond(keys.main.success.ping);
    if(!message.content.startsWith(prefix) || message.author.bot) return;

    //check if in guild
    if(!message.inGuild()) return message.respond(keys.main.warnings.not_in_guild);

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if(commandName === 'help') {
        await message.respond(keys.commands.executed);
        await helpCommand.execute(message, args);
    }
    else if(commandName === 'eval' && message.author.id === ownerId) {
        await message.respond(keys.commands.executed);
        await evalCommand.execute(message, args);
    }
    else {
        const command = client.commands.get(commandName);
        if(!command) return;

        await message.respond(keys.commands.executed);

        const server = client.serverConnections.cache.get(message.guildId);
        if(server?.settings?.isDisabled('commands', commandName)) {
            await message.respond(keys.main.warnings.disabled);
        }

        try {
            // noinspection JSUnresolvedFunction
            await command.execute(message, args)
                .catch(err => message.respond(keys.main.errors.could_not_execute_command, ph.error(err)));
        }
        catch(err) {
            await message.respond(keys.main.errors.could_not_execute_command, ph.error(err));
        }
    }
});

client.on('interactionCreate', async interaction => {
    interaction = addResponseMethods(interaction);

    //check if in guild
    if(!interaction.guildId) return interaction.respond(keys.main.warnings.not_in_guild);

    if(interaction.isCommand()) {

        //Making interaction compatible with normal commands
        interaction.mentions = {
            users: new Discord.Collection(),
            roles: new Discord.Collection(),
            channels: new Discord.Collection(),
        };
        interaction.attachments = new Discord.Collection();


        const args = getArgs(client, interaction);
        //Add mentions and attachments from args
        args.forEach(arg => {
            if(arg instanceof Discord.User) interaction.mentions.users.set(arg.id, arg);
            else if(arg instanceof Discord.Role) interaction.mentions.roles.set(arg.id, arg);
            else if(arg instanceof Discord.BaseChannel) interaction.mentions.channels.set(arg.id, arg);
            else if(arg instanceof Discord.Attachment) interaction.attachments.set(arg.id, arg);
        });

        if(interaction.commandName === 'message') await interaction?.deferReply({ ephemeral: true });
        else await interaction?.deferReply();

        await interaction.respond(keys.commands.executed);

        if(interaction.commandName === 'help') {
            await helpCommand.execute(interaction, args);
        }
        else {
            const command = client.commands.get(interaction.commandName);

            //Check if command disabled
            const server = client.serverConnections.cache.get(interaction.guildId);
            if(server?.settings?.isDisabled('commands', interaction.commandName)) {
                await interaction.respond(keys.main.warnings.disabled);
                return;
            }

            try {
                await command.execute(interaction, args)
                    .catch(err => interaction.respond(keys.main.errors.could_not_execute_command, ph.error(err)));
            }
            catch(err) {
                await interaction.respond(keys.main.errors.could_not_execute_command, ph.error(err));
            }
        }

    }
    else if(interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if(!command || !(command instanceof AutocompleteCommand)) return;

        try {
            await command.autocomplete(interaction)
                .catch(err => console.log(addPh(keys.main.errors.could_not_autocomplete_command.console, ph.error(err))));
        }
        catch(err) {
            await console.log(addPh(keys.main.errors.could_not_autocomplete_command.console, ph.error(err)));
        }
    }
    else if(interaction.isButton()) {
        console.log(addPh(keys.buttons.clicked.console, { 'button_id': interaction.customId }, ph.std(interaction)));

        if(interaction.customId.startsWith('disable')) {
            await interaction.deferReply({ ephemeral: true });
            await disableButton.execute(interaction);
        }
        else if(interaction.customId.startsWith('enable')) {
            await interaction.deferReply({ ephemeral: true });
            await enableButton.execute(interaction);
        }
    }
});

client.login(token);
