const Discord = require('discord.js');
const fs = require('fs');

module.exports = {
    execute(interaction) {
        const baseEmbed = new Discord.MessageEmbed()
            .setTitle('Help Menu')
            .setAuthor({ name: interaction.client.user.username, iconURL: interaction.client.user.displayAvatarURL({ format: 'png' }) })
            .setColor('NOT_QUITE_BLACK');

        if (interaction.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
            const command = interaction.customId.split('_').pop();
            console.log(`${interaction.member.user.tag} clicked enableButton: ${command} in ${interaction.guild.name}`);
            fs.rm(`./disable/commands/${interaction.guild.id}_${command}`, err => {
                if(err) {
                    console.log('Error deleting commandDisableFile ', err);
                    interaction.editReply(`<:Error:849215023264169985> Couldn't enable Command! Is it already enabled?`);
                } else {
                    console.log(`Successfully deleted commandDisableFile: ./disable/commands/${interaction.guild.id}_${command}`);
                    interaction.editReply(`<:Checkmark:849224496232660992> Enabling of command [**${command}**] successful.`);
                }
            });

            const disableRow = new Discord.MessageActionRow()
                .addComponents(
                    new Discord.MessageButton()
                        .setStyle('DANGER')
                        .setCustomId(`disable_${command}`)
                        .setLabel('Disable this command!')
                        .setEmoji('<:Error:849215023264169985>'),
                );

            const commandObject = interaction.client.commands.get(command);
            const helpEmbed = baseEmbed.addField(commandObject.name.toUpperCase(), commandObject.description + `\n\n**USAGE**: ${commandObject.usage}\n\n**EXAMPLE**: ${commandObject.example}\n\n**ALIASES**: \n${commandObject.aliases.join(', ')}`)
                .setDescription('```diff\n+ [Command enabled]```')
                .setColor('GREEN');
            interaction.message.edit({ embeds: [helpEmbed], components: [disableRow] })
        } else {
            console.log(`Clicker of ${interaction.customId} doesnt have admin.`);
            interaction.editReply(':no_entry: You must be an administrator to use that button!');
        }
    }
}