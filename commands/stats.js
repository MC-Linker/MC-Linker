module.exports = {
    name: 'stats',
    aliases: ['stat'],
    usage: 'stats <@mention>/<ingamename> <Statcategory **id**> <Statitem/block/entity **id**> ',
    example: 'stats @Lianecx mined iron_ore **//** stats @Memer custom play_time **//** stats xXgamerboyyXx killed blaze',
    description: "Look at your and other member's minecraft server stats. \nNOTE: Stats are MUCH faster updated in minecraftversion: 1.17 \n All Categories (ids) can be found in this [Website](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names)!",
    async execute(message, args) {

        const fs = require('fs');
        const ftp = require('ftp')
        const Discord = require('discord.js')
        const fetch = require('node-fetch');

        const statType = (args[1]);
        const statObject = (args[2]);
        let taggedUser;
        let taggedName;
        let uuidv4;

        if(!message.mentions.users.size) {
            taggedName = (args[0]);
            taggedUser = (args[0]);
            try {
                // @ts-ignore
                const minecraftId = await fetch(`https://api.mojang.com/users/profiles/minecraft/${taggedUser}`)
                .then(data => data.json())
                .then(player => player.id);
                console.log(minecraftId);
                uuidv4 = minecraftId.split('');
                for(let i = 8; i <=23; i+=5) uuidv4.splice(i,0,'-');
                uuidv4 = uuidv4.join("");
            } catch (err) {
                message.reply('Player [**' + taggedName + '**] does not seem to exist.');
                console.log('Error getting uuid of ' + taggedName);
                return;
            }
        } else {
            taggedUser = message.mentions.users.first();
            taggedName = taggedUser.tag;
            fs.readFile('./connections/' + taggedUser.id + '.json', 'utf8', function(err, connectionJson) {
                if(err) {
                    message.reply(":warning: User isn't connected");
                    console.log('Error reading connectionFile from disk: ', err);
                    return;
                }
                const connectionData = JSON.parse(connectionJson);
                uuidv4 = connectionData.id;
            })
        }

        console.log(message.member.user.tag + ' executed ^stats ' + statType + ' ' + statObject + ' with taggedUser: ' + taggedName + ' in ' + message.guild.name);

            let categoryDisabled = fs.existsSync('./disable/stats/category/' + message.guild.id + "_" + statType)
            if(categoryDisabled === false) {
                console.log('DisableJson [' + './disable/stats/category/' + message.guild.id + "_" + statType + '] doesnt exist. Stat not disabled.')
            } else if(categoryDisabled === true) {
                console.log('Category [' + statType + '] disabled.')
                message.reply(':no_entry: ' + 'Category [**' + statType + '**] disabled!')
                return;
            }
            let objectDisabled = fs.existsSync('./disable/stats/object/' + message.guild.id + "_" + statObject)
            if(objectDisabled === false) {
                console.log('DisableJson [' + './disable/stats/object/' + message.guild.id + "_" + statObject + '] doesnt exist. Stat not disabled.')
            } else if(objectDisabled === true) {
                console.log('Object [' + statObject + '] disabled.')
                message.reply(':no_entry:' + 'Object [**' + statObject + '**] disabled!')
                return; 
            }


            async function ftpconnect() {
                return await new Promise((resolve, reject) => {
                    fs.readFile('./ftp/' + message.guild.id + '.json', 'utf8', (err, ftpJson) => {
                        if(err) {
                            console.log('Error reading ftpFile from disk: ', err);
                            message.reply('<:Error:849215023264169985> ' + 'Could not find ftpcredentials. Please contact a server-admin.')
                            reject('error');
                            return;
                        }

                        let ftpData;
                        let host;
                        let port;
                        let user;
                        let password;
                        try {
                            ftpData = JSON.parse(ftpJson);
                            host = ftpData.host
                            port = ftpData.port
                            user = ftpData.user
                            password = ftpData.password
                        } catch (err) {
                            console.log('Error reading ftpFile from disk: ', err);
                            message.reply('<:Error:849215023264169985> Could not read serverFile.')
                            reject('error');
                            return;
                        }

                        const ftpClient = new ftp();
                        ftpClient.on('error', function(err) {
                            console.log('Error! ', err);
                            message.reply('<:Error:849215023264169985> Could not connect to server.')
                            reject('error');
                            return;
                        })
                        ftpClient.on('ready', function() {
                            ftpClient.get(ftpData.path + '/stats/' + uuidv4 + '.json', function(err, stream) {
                                if(err) {
                                    console.log('Could not download stats. ', err);
                                    message.reply('<:Error:849215023264169985> ' + 'Could not download stats. The User most likely never joined the server.')
                                    reject('error')
                                    return;
                                }
                                stream.once('close', function() {
                                    ftpClient.end();
                                    resolve('noice') 
                                });
                                stream.pipe(fs.createWriteStream('./stats/' + uuidv4 + '.json'));
                                console.log('File [' + uuidv4 + '.json' + '] succesfully downloaded')
                            });
                        });
                        try {
                            ftpClient.connect({
                            host: host,
                            port: port,
                            user: user,
                            password: password,
                        });
                        } catch (err) {
                            console.log('Could not connect to server. ', err);
                            message.reply('<:Error:849215023264169985> ' + 'Could not connect to server.')
                            reject('error')
                            return;
                        }  
                    })  
                })
            }
            await ftpconnect()

            fs.readFile('./stats/' + uuidv4 + '.json', 'utf8', (err, statJson) => {
                if(err) {
                    message.reply(':warning: ' + 'Could not find stat file. Member most likely never joined the server.')
                    console.log('Error reading stat file from disk: ', err);
                    return;
                }
                fs.readFile('./ftp/' + message.guild.id + '.json', 'utf8', (err, ftpJson) => {
                    if(err) {
                    message.reply(':warning: ' + 'Could not find ftp file. Please contact a server admin.')
                    console.log('Error reading ftp file from disk: ', err);
                    return;
                    }

                    try {
                        const ftpData = JSON.parse(ftpJson);
                        const statData = JSON.parse(statJson);
                        const version = ftpData.version;

                        const imageExists = fs.existsSync('./images/' + statObject + '.png')

                        let searchName;
                        if(version === '1.13' || version === '1.14' || version === '1.15' || version === '1.16' || version === '1.17') searchName = statData.stats["minecraft:" + statType]["minecraft:" + statObject];
                        else if(version === '1.12' || version === '1.11' || version === '1.10' || version === '1.9' || version === '1.8' || version === '1.7') searchName = statData["stat." + statType + '.minecraft.' + statObject]
            
                        if (searchName) {
                            if(statType === 'custom') {
                                const statEmbed = new Discord.MessageEmbed()
                                    .setTitle('<:MinecraftS:849561874033803264><:MinecraftT:849561902979350529><:MinecraftA:849561916632465408><:MinecraftT:849561902979350529><:MinecraftS:849561874033803264>')
                                    // @ts-ignore
                                    if(statObject === 'play_time' || statObject === 'time_played') {statEmbed.addField(taggedName, `has played for **${(((searchName / 20) / 60) / 60).toFixed(2)}** hours`)}
                                    else {statEmbed.addField(taggedName, '**' + statObject + ' ' + searchName + '** ')}
                                    if(imageExists === false) {
                                        console.log('No Image available for ' + statObject)
                                    } else {
                                        statEmbed.attachFiles(['./images/' + statObject + '.png'])
                                        statEmbed.setImage('attachment://' + statObject + '.png')
                                    }
                                console.log('Sent stat ' + statType + ' ' + statObject + ': ' + searchName + ' of Player: ' + taggedName);
                                message.channel.send(statEmbed);
                            } else if (statType === 'killed_by') {
                                const statEmbed = new Discord.MessageEmbed()
                                    .setTitle('<:MinecraftS:849561874033803264><:MinecraftT:849561902979350529><:MinecraftA:849561916632465408><:MinecraftT:849561902979350529><:MinecraftS:849561874033803264>')
                                    .addField(taggedName, 'was killed **' + searchName + '** times by a **' + statObject + '**')
                                    if(imageExists === false) {
                                        console.log('No Image available for ' + statObject)
                                    } else {
                                        statEmbed.attachFiles(['./images/' + statObject + '.png'])
                                        statEmbed.setImage('attachment://' + statObject + '.png')
                                    }
                                console.log('Sent stat ' + statType + ' ' + statObject + ': ' + searchName + ' of Player: ' + taggedName);
                                message.channel.send(statEmbed);
                            } else {
                                console.log("Sent stat " + statType + " " + statObject + " from User: " + taggedName + " : " + searchName)
                                const statEmbed = new Discord.MessageEmbed()
                                    .setTitle('<:MinecraftS:849561874033803264><:MinecraftT:849561902979350529><:MinecraftA:849561916632465408><:MinecraftT:849561902979350529><:MinecraftS:849561874033803264>')
                                    .addField(taggedName, 'has **' + statType + ' ' + searchName + ' ' + statObject + 's**');
                                    if(imageExists === false) {
                                        console.log('No Image available for ' + statObject)
                                    } else {
                                        statEmbed.attachFiles(['./images/' + statObject + '.png'])
                                        statEmbed.setImage('attachment://' + statObject + '.png')
                                    }
                                console.log('Sent stat ' + statType + ' ' + statObject + ': ' + searchName + ' of Player: ' + taggedName);
                                message.channel.send(statEmbed);
                            }    
                        } else {
                            console.log("No Match found!")
                            message.reply(':warning: ' + 'No Match found! Stat is either 0 or mispelled!')
                        }
                    } catch (err) {
                        console.log('Error parsing Stat JSON string: ', err);
                        message.reply('<:Error:849215023264169985> ' + taggedName + ' has never done anything in this category.')
                    }
                })
            })
    }
}