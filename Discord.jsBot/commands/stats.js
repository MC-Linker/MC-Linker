module.exports = {
    name: 'stats',
    description: "Look at your and other member's minecraft server stats. Stats will be updated every time the server restarts. \nUSAGE: stats @<username> <Statcategory> <Statitem/block/entity> \n EXAMPLE: stats @Lianecx mined iron_ore \n All Categories can be find either with ^stathelp or in this [Website](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names)!",
    execute(message, args) {

        const fs = require('fs');
        const ftp = require('ftp')
        const Discord = require('discord.js')
        const client = new Discord.Client();

        if (!message.mentions.users.size) {
            console.log(message.member.user.tag + ' executed ^stats without user in ' + message.guild.name)
            message.reply(':warning: ' + 'You need to tag a user!');
            return;
        }
        const statType = (args[1]);
        const statObject = (args[2]);
        const taggedUser = message.mentions.users.first();

        console.log(message.member.user.tag + ' executed ^stats ' + statType + ' ' + statObject + ' with taggedUser: ' + taggedUser.tag + ' in ' + message.guild.name);

        fs.readFile('./connections/' + taggedUser.tag + '.json', 'utf8', async function(err, connectionJson) {
            if(err) {
                message.reply(':warning: ' + 'User isnt connected!')
                console.log('Error reading file from disk: ', err);
                return;
            }
            let categoryDisabled = fs.existsSync('./stats/disable/category/' + message.guild.name + "_" + statType + '.json')
            if(categoryDisabled === false) {
                console.log('DisableJson [' + './stats/disable/category/' + message.guild.name + "_" + statType + '.json' + '] doesnt exist. Stat not disabled.')
            } else if(categoryDisabled === true) {
                console.log('Category [' + statType + '] disabled.')
                message.reply(':no_entry: ' + 'Category [' + statType + '] disabled!')
                return;
            }
            let objectDisabled = fs.existsSync('./stats/disable/object/' + message.guild.name + "_" + statObject + '.json')
            if(objectDisabled === false) {
                console.log('DisableJson [' + './stats/disable/object/' + message.guild.name + "_" + statObject + '.json' + '] doesnt exist. Stat not disabled.')
            } else if(objectDisabled === true) {
                console.log('Object [' + statObject + '] disabled.')
                message.reply(':no_entry:' + 'Object [' + statObject + '] disabled!')
                return; 
            }
            
            const connectionData = JSON.parse(connectionJson);
            const minecraftId = connectionData.id;

            let uuidv4 = minecraftId.split('')
            for(let i = 8; i <=23; i+=5) uuidv4.splice(i,0,'-');                       
            uuidv4 = uuidv4.join("");


            async function ftpconnect() {
                return await new Promise((resolve, reject) => {
                    fs.readFile('./ftp/' + message.guild.name + '.json', 'utf8', (err, ftpJson) => {
                        if(err) {
                            console.log('Error reading ftpFile from disk: ', err);
                            message.reply('<:Error:849215023264169985> ' + 'Could not find ftpcredentials. Please contact a server-admin.')
                            reject('error');
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
                            reject('error');
                        }

                        const ftpClient = new ftp();
                        ftpClient.on('error', function(err) {
                            console.log('Error! ', err);
                            message.reply('<:Error:849215023264169985> ' + 'Could not connect to server.')
                            reject('error')
                        })
                        ftpClient.on('ready', function() {
                            ftpClient.get(ftpData.path + '/stats/' + uuidv4 + '.json', function(err, stream) {
                                if(err) {
                                    console.log('Could not download stats. ', err);
                                    message.reply('<:Error:849215023264169985> ' + 'Could not download stats. ')
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
                            message.reply('<:Error:849215023264169985> ' + 'Could not connect to server.')
                            reject('error')
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
                try {
                    const statData = JSON.parse(statJson);
                    let searchName = statData.stats["minecraft:" + statType]["minecraft:" + statObject]
                        if (searchName) {
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
                            message.reply(':warning: ' + 'No Match found! Stat is either 0 or mispelled!')
                        }
                } catch (err) {
                    console.log('Error parsing Stat JSON string: ', err);
                    message.reply('<:Error:849215023264169985> ' + taggedUser.tag + ' has never done anything in this category.')
                }
            })
        })
    }
}