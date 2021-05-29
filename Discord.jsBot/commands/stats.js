const { DiscordAPIError } = require('discord.js');

module.exports = {
    name: 'stats',
    description: "Look at your and other member's minecraft server stats. Stats will be updated every time the server restarts. \nUSAGE: stats @<username> <Statcategory> <Statitem/block/entity> \n EXAMPLE: stats @Lianecx mined iron_ore \n All Categories can be find either with ^stathelp or in this [Website](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names)!",
    execute(message, args) {

        const fs = require('fs');
        const ftp = require('ftp')
        const Discord = require('discord.js')
        const client = new Discord.Client();

        if (!message.mentions.users.size) {
            console.log(message.member.user.tag + ' executed ^stats without user.')
            message.reply('you need to tag a user!');
            return;
        }
        const statType = (args[1]);
        const statObject = (args[2]);
        const taggedUser = message.mentions.users.first();

        console.log(message.member.user.tag + ' executed ^stats ' + statType + ' ' + statObject + ' with taggedUser: ' + taggedUser.tag);

        fs.readFile('./connections/' + taggedUser.tag + '.json', 'utf8', (err, connectionJson) => {
            if(err) {
                message.reply('User isnt connected!')
                console.log('Error reading file from disk: ', err);
                return;
            } else {
                try {
                    const disableJson = fs.readFileSync('./stats/disable/category/' + message.guild.name + "_" + statType + '.json')
                    const disableData = JSON.parse(disableJson)
                        if(disableData.disable === 'disabled') {
                            console.log('Category [' + statType + '] disabled.')
                            message.reply('Category [' + statType + '] disabled!')
                            return;
                        }
                    } catch (err) {
                        console.log("Could not find disableJson. Stat not disabled.")
                    }

                try {
                    const disableJson2 = fs.readFileSync('./stats/disable/object/' + message.guild.name + "_" + statObject + '.json')
                    const disableData2 = JSON.parse(disableJson2)
                    if(disableData2.disable === 'disabled') {
                        console.log('Object [' + statObject + '] disabled.')
                        message.reply('Object [' + statObject + '] disabled!')
                        return; 
                    }
                } catch (err) {
                    console.log("Could not find disableJson. Stat not disabled.")
                }

                    const connectionData = JSON.parse(connectionJson);
                    const minecraftId = connectionData.id;

                    let uuidv4 = minecraftId.split('')
                    for(let i = 8; i <=23; i+=5) uuidv4.splice(i,0,'-');                       
                    uuidv4 = uuidv4.join("");

                    fs.readFile('./ftp/' + message.guild.name + '.json', 'utf8', async function(err, ftpJson) {
                        if(err) {
                                console.log('Error reading file from disk: ', err);
                                message.reply('Could not find ftpcredentials. ')
                                return;
                        } else {
                                const ftpData = JSON.parse(ftpJson);
                                let host = ftpData.host
                                let port = ftpData.port
                                let user = ftpData.user
                                let password = ftpData.password

                                 async function ftpconnect() {
                                    const ftpClient = new ftp();
                                    return await new Promise((resolve, reject) => {
                                        ftpClient.on('error', function(err) {
                                            console.log('Error! ', err);
                                            message.reply('Could not connect to server.')
                                            reject('error')
                                        })
                                        ftpClient.on('ready', function() {
                                            ftpClient.get(ftpData.path + '/stats/' + uuidv4 + '.json', function(err, stream) {
                                                if(err) {
                                                    console.log('Could not download stats. ', err);
                                                    message.reply('Could not download stats. ')
                                                    reject('error')
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
                                            message.reply('Could not connect to server.')
                                            reject('error')
                                        }  
                                    })
                                    
                                }
                                await ftpconnect()
                            }

                    fs.readFile('./stats/' + uuidv4 + '.json', 'utf8', (err, statJson) => {
                        if(err) {
                            message.reply('Could not find stat file. Member most likely never joined the server.')
                            console.log('Error reading stat file from disk: ', err);
                            return;
                        }
                        try {
                            const statData = JSON.parse(statJson);
                            let searchName = statData.stats["minecraft:" + statType]["minecraft:" + statObject]
                                if (searchName){
                                    if(statType === 'custom') {
                                        message.reply('<:alexPick:848151260803629078> ' + taggedUser.tag + ' **' + statObject + ', ' + searchName + '**')
                                    } else if (statType === 'killed_by') {
                                        message.reply('<:alexPick:848151260803629078> ' + taggedUser.tag + ' was killed **' + searchName + '** times by a **' + statObject + '**')
                                    } else {
                                        console.log("Sent stat " + statType + " " + statObject + " from User: " + taggedUser.tag + " : " + searchName)
                                        message.reply('<:alexPick:848151260803629078> ' + taggedUser.tag + ' has **'  + statType + ' ' + searchName + ' ' + statObject + 's**')
                                    }
                                    
                                } else {
                                    console.log("No Match found!")
                                    message.reply('No Match found! Stat is either 0 or mispelled!')
                                }
                        } catch (err) {
                            console.log('Error parsing Stat JSON string: ', err);
                            message.reply(taggedUser.tag + ' has never done anything in this category.')
                        }
                    })
                })
            }
        })
    }
}