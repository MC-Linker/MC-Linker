module.exports = {
    name: 'stats',
    aliases: ['stat'],
    usage: 'stats <@mention>/<ingamename> <Statcategory **id**> <Statitem/block/entity **id**> ',
    example: 'stats @Lianecx mined iron_ore **//** stats @Memer custom play_time **//** stats xXgamerboyyXx killed blaze',
    description: "Look at your and other member's minecraft server stats.\n All Categories (ids) can be found in this [Website](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names)!",
    async execute(message, args) {

        const fs = require('fs');
        const ftp = require('../../ftp');
        const Discord = require('discord.js');
        const utils = require('../../utils');

        const statType = (args[1]);
        const statObject = (args[2]);
        let taggedName;

        if(!statType || !statObject || !args[0]) {
            console.log(message.member.user.tag + ' executed ^stats incorrect in ' + message.guild.name);
            message.reply(":warning: Wrong Usage! Check `^help stats` for correct usage!");
            return;
        }

        if(!message.mentions.users.size) {
            taggedName = (args[0]);
        } else {
            taggedName = message.mentions.users.first().tag;
        }
        console.log(message.member.user.tag + ' executed ^stats ' + statType + ' ' + statObject + ' with taggedUser: ' + taggedName + ' in ' + message.guild.name);

        const uuidv4 = await utils.getUUIDv4(args[0], message);
        if(uuidv4 === undefined) {
            return;
        }


        let categoryDisabled = fs.existsSync('./disable/stats/' + message.guild.id + "_" + statType);
        if(categoryDisabled === true) {
            console.log('Category [' + statType + '] disabled.');
            message.reply(':no_entry: Stat [**' + statType + '**] disabled!');
            return;
        }
        let objectDisabled = fs.existsSync('./disable/stats/' + message.guild.id + "_" + statObject);
        if(objectDisabled === true) {
            console.log('Object [' + statObject + '] disabled.');
            message.reply(':no_entry: Stat [**' + statObject + '**] disabled!');
            return; 
        }

        const worldPath = await utils.getWorldPath(message);
        if(worldPath === undefined) {
            return;
        }
        const statFile = await ftp.get(`${worldPath}/stats/${uuidv4}.json`, `./stats/${uuidv4}.json`, message);
        if(statFile === false) return;

        fs.readFile('./stats/' + uuidv4 + '.json', 'utf8', (err, statJson) => {
            if(err) {
                message.reply('<:Error:849215023264169985> Could not find stat file. Member most likely never joined the server.')
                console.log('Error reading stat file from disk: ', err);
                return;
            }
            fs.readFile('./ftp/' + message.guild.id + '.json', 'utf8', (err, ftpJson) => {
                if(err) {
                    message.reply('<:Error:849215023264169985> ' + 'Could not find ftp file. Please contact a server admin.')
                    console.log('Error reading ftp file from disk: ', err);
                    return;
                }

                try {
                    const ftpData = JSON.parse(ftpJson);
                    const statData = JSON.parse(statJson);
                    const version = parseInt(ftpData.version.split('.').splice(1,1));

                    const imageExists = fs.existsSync('./images/' + statObject + '.png')

                    let searchName;
                    if(version >= 13) searchName = statData.stats["minecraft:" + statType]["minecraft:" + statObject];
                    else if(version <= 12) searchName = statData["stat." + statType + '.minecraft.' + statObject];
        
                    if (searchName) {
                        if(statType === 'custom') {
                            const statEmbed = new Discord.MessageEmbed()
                                .setTitle('<:MinecraftS:849561874033803264><:MinecraftT:849561902979350529><:MinecraftA:849561916632465408><:MinecraftT:849561902979350529><:MinecraftS:849561874033803264>');

                            if(statObject === 'play_time' || statObject === 'time_played') statEmbed.addField(taggedName, `has played for **${(((searchName / 20) / 60) / 60).toFixed(3)}** hours`);
                            else statEmbed.addField(taggedName, '**' + statObject + ' ' + searchName + '** ');

                            if(imageExists === false) {
                                console.log('No Image available for ' + statObject);
                                message.channel.send({ embeds: [statEmbed] });
                                console.log('Sent stat ' + statType + ' ' + statObject + ': ' + searchName + ' of Player: ' + taggedName);
                            } else {
                                statEmbed.setImage('attachment://' + statObject + '.png')
                                message.channel.send({ embeds: [statEmbed], files: [`./images/${statObject}.png`] });
                                console.log('Sent stat ' + statType + ' ' + statObject + ': ' + searchName + ' of Player: ' + taggedName);
                            }
                        } else if (statType === 'killed_by') {
                            const statEmbed = new Discord.MessageEmbed()
                                .setTitle('<:MinecraftS:849561874033803264><:MinecraftT:849561902979350529><:MinecraftA:849561916632465408><:MinecraftT:849561902979350529><:MinecraftS:849561874033803264>')
                                .addField(taggedName, 'was killed **' + searchName + '** times by a **' + statObject + '**');

                            if(imageExists === false) {
                                console.log('No Image available for ' + statObject);
                                message.channel.send({ embeds: [statEmbed] });
                                console.log('Sent stat ' + statType + ' ' + statObject + ': ' + searchName + ' of Player: ' + taggedName);
                            } else {
                                statEmbed.setImage('attachment://' + statObject + '.png');
                                message.channel.send({ embeds: [statEmbed], files: [`./images/${statObject}.png`] });
                                console.log('Sent stat ' + statType + ' ' + statObject + ': ' + searchName + ' of Player: ' + taggedName);
                            }
                        } else {
                            const statEmbed = new Discord.MessageEmbed()
                                .setTitle('<:MinecraftS:849561874033803264><:MinecraftT:849561902979350529><:MinecraftA:849561916632465408><:MinecraftT:849561902979350529><:MinecraftS:849561874033803264>')
                                .addField(taggedName, 'has **' + statType + ' ' + searchName + ' ' + statObject + 's**');

                            if(imageExists === false) {
                                console.log('No Image available for ' + statObject);
                                console.log('Sent stat ' + statType + ' ' + statObject + ': ' + searchName + ' of Player: ' + taggedName);
                                message.channel.send({ embeds: [statEmbed] });
                            } else {
                                statEmbed.setImage('attachment://' + statObject + '.png');
                                message.channel.send({ embeds: [statEmbed], files: [`./images/${statObject}.png`] });
                                console.log('Sent stat ' + statType + ' ' + statObject + ': ' + searchName + ' of Player: ' + taggedName);
                            }
                        }    
                    } else {
                        console.log("No Match found!");
                        message.reply(':warning: ' + 'No Match found! Stat is either 0 or mispelled!');
                    }
                } catch (err) {
                    console.log('Error parsing Stat JSON string: ', err);
                    message.reply('<:Error:849215023264169985> ' + taggedName + ' has never done anything in this category.');
                }
            })
        })
    }
}