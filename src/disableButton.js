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
            console.log(`${interaction.member.user.tag} clicked disableButton: ${command} in ${interaction.guild.name}`);
            fs.writeFile(`./disable/commands/${interaction.guild.id}_${command}`, '', err => {
                if (err) {
                    console.log('Error writing commandDisableFile ', err);
                    interaction.editReply(`<:Error:849215023264169985> Couldn't disable Command!`);
                } else {
                    console.log(`Successfully wrote commandDisableFile: ./disable/commands/${interaction.guild.id}_${command}`);
                    interaction.editReply(`<:Checkmark:849224496232660992> Disabling of command [**${command}**] successful.`);
                }
            })

            const enableRow = new Discord.MessageActionRow()
                .addComponents(
                    new Discord.MessageButton()
                        .setStyle('SUCCESS')
                        .setCustomId(`enable_${command}`)
                        .setLabel('Enable this command!')
                        .setEmoji('<:Checkmark:849224496232660992>'),
                );

            const commandObject = interaction.client.commands.get(command);
            const helpEmbed = baseEmbed.addField(commandObject.name.toUpperCase(), `${commandObject.description}\n\n**USAGE**: ${commandObject.usage}\n\n**EXAMPLE**: ${commandObject.example}\n\n**ALIASES**: \n${commandObject.aliases.join(', ')}`)
                .setDescription('```diff\n- [COMMAND DISABLED]```')
                .setColor('DARK_RED');
            interaction.message.edit({ embeds: [helpEmbed], components: [enableRow] });
        } else {
            console.log(`Clicker of ${interaction.customId} doesnt have admin.`);
            interaction.editReply(':no_entry: You must be an administrator to use that button!');
        }
    }
}