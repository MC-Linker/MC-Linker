module.exports = {
    name: 'advancements',
    aliases: ['am', 'advancement'],
    usage: 'advancements <advancementTab> <advancementid>',
    example: '^advancements story iron_tools **//** ^advancements adventure adventuring_time **//** ^advancements recipes loom',
    description: 'Look up your unlocked/completed recipes/advancements. You can find a list of all advancement (ids) [here](https://minecraft.fandom.com/wiki/Advancement#List_of_advancements).',
    execute(message, args) {

        const fs = require('fs');
        const ftp = require('ftp')
        const Discord = require('discord.js')

        if (!message.mentions.users.size) {
            console.log(message.member.user.tag + ' executed ^advancements without user in ' + message.guild.name)
            message.reply(':warning: ' + 'You need to tag a user!');
            return;
        }

        const taggedUser = message.mentions.users.first();
        const mode = (args[1]);
        const object = (args[2]);

        console.log(message.member.user.tag + ' executed ^advancements ' + mode + ' ' + object +  ' with taggedUser: ' + taggedUser.tag + ' in ' + message.guild.name);

        fs.readFile('./connections/' + taggedUser.tag + '.json', 'utf8', (err, connectionJson) => {
            if(err) {
                message.reply(':warning: ' + 'User isnt connected!')
                console.log('Error reading file from disk: ', err);
                return;
            }
            const connectionData = JSON.parse(connectionJson);
            const minecraftId = connectionData.id;

            let uuidv4 = minecraftId.split('')
            for(let i = 8; i <=23; i+=5) uuidv4.splice(i,0,'-');                       
            uuidv4 = uuidv4.join("");

            fs.readFile('./ftp/' + message.guild.id + '.json', 'utf8', async function(err, ftpJson) {
                if(err) {
                        console.log('Error reading file from disk: ', err);
                        message.reply('<:Error:849215023264169985> ' + 'Could not find ftpcredentials. Please contact a server-admin.')
                        return;
                }
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
                        message.reply('<:Error:849215023264169985> ' + 'Could not connect to server.')
                        reject('error')
                    })
                    ftpClient.on('ready', function() {
                        ftpClient.get(ftpData.path + '/advancements/' + uuidv4 + '.json', function(err, stream) {
                            if(err) {
                                console.log('Error downloading advancements. ', err);
                                message.reply('<:Error:849215023264169985> ' + 'Error downloading advancements. ')
                                reject('error')
                            }
                            stream.once('close', function() {
                                ftpClient.end();
                                resolve('noice') 
                            });
                            stream.pipe(fs.createWriteStream('./advancements/' + uuidv4 + '.json'));
                            console.log('advancementfile [' + uuidv4 + '.json' + '] succesfully downloaded')
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
            }
            await ftpconnect()

            fs.readFile('./advancements/' + uuidv4 + '.json', 'utf8', (err, advancementJson) => {
                if(err) {
                    message.reply(':warning: ' + 'Could not find advancement file. Member most likely never joined the server.')
                    console.log('Error reading stat file from disk: ', err);
                    return;
                }

                const baseEmbed = new Discord.MessageEmbed()
                    .setColor('#730A85')
                    .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                    .setTitle(taggedUser.tag)
                    .addField(`=======================\n${mode} ${object}`, '**=======================**')
                    .setImage('https://cdn.discordapp.com/attachments/844493685244297226/849604323264430140/unknown.png')

                try {
                    const advancementData = JSON.parse(advancementJson);

                    if(mode === 'recipes') {

                        let allKeys = Object.keys(advancementData)
                        const filteredKeys = allKeys.filter(key => {
                            return key.startsWith('minecraft:' + mode + '/') && key.endsWith('/' + object);
                        }).join("")
                        let criteria = Object.keys(advancementData[filteredKeys]['criteria']).join("")
                        let searchName = advancementData[filteredKeys]['criteria'][criteria]
                        searchName = searchName.replace(' +0000', '')

                        console.log('Sent advancement [' + mode + ' ' + object + ']' + taggedUser.tag + ' : ' + searchName)
                        const amEmbed = baseEmbed.addField('Criteria', criteria).addField('unlocked on', searchName)
                        message.channel.send(amEmbed)
                    } else {
                        try {
                            let searchName;
                            let amEmbed;
                            let key = Object.keys(advancementData['minecraft:' + mode + '/' + object]['criteria'])
                            for (let i=0; i < key.length; i++) {
                                searchName = advancementData['minecraft:' + mode + '/' + object]['criteria'][key[i]]
                                key[i] = key[i].replace('minecraft:', '')
                                searchName = searchName.replace(' +0000', '');
                                amEmbed = baseEmbed.addField('Criteria', key[i], true).addField('completed on', searchName, true).addField('\u200b', '\u200b', true)
                            }
                            console.log('Sent advancement [' + mode + ' ' + object + ']' + taggedUser.tag + ' : ' + searchName)
                            message.channel.send(amEmbed)
                        } catch (err) {
                            console.log('Error sending advancement.', err)
                            message.reply(':warning: Advancement [**' + mode + ' ' + object + '**] not completed/unlocked or misspelled!')
                        }
                    }

                } catch (err) {
                    console.log('Error parsing advancementJSON string: ', err);
                    message.reply(':warning: Advancement [**' + mode + ' ' + object + '**] not completed/unlocked or misspelled!')
                }
            })
            })
        })
    }
}