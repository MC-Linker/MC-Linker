module.exports = {
    name: 'advancements',
    aliases: ['am', 'advancement'],
    usage: 'advancements <@mention>/<ingamename> <advancementTab> <advancementid>',
    example: '^advancements @Lianecx story iron_tools **//** ^advancements @Memer adventure adventuring_time **//** ^advancements xXgamerboyyXx recipes loom',
    description: 'Look up your unlocked/completed recipes/advancements. You can find a list of all advancement (ids) [here](https://minecraft.fandom.com/wiki/Advancement#List_of_advancements).',
    async execute(message, args) {

        const fs = require('fs');
        const ftp = require('ftp');
        const Discord = require('discord.js');
        const fetch = require('node-fetch');

        const mode = (args[1]);
        const object = (args[2]);
        let taggedUser;
        let taggedName;
        let uuidv4;

        if(!message.mentions.users.size) {
            taggedName = (args[0]);
            // @ts-ignore
            try {
                // @ts-ignore
                const minecraftId = await fetch(`https://api.mojang.com/users/profiles/minecraft/${taggedName}`)
                .then(data => data.json())
                .then(player => player.id);
                console.log(minecraftId);
                uuidv4 = minecraftId.split('');
                for(let i = 8; i <=23; i+=5) uuidv4.splice(i,0,'-');
                uuidv4 = uuidv4.join("");
            } catch (err) {
                message.reply('Player [**' + taggedName + '**] does not seem to exist.')
                console.log('Error getting uuid of ' + taggedName, err)
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

        console.log(message.member.user.tag + ' executed ^advancements ' + mode + ' ' + object +  ' with taggedUser: ' + taggedName + ' in ' + message.guild.name);


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
                    .setTitle(taggedName)
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

                        console.log('Sent advancement [' + mode + ' ' + object + ']' + taggedName + ' : ' + searchName)
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
                            console.log('Sent advancement [' + mode + ' ' + object + ']' + taggedName + ' : ' + searchName)
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
    }
}