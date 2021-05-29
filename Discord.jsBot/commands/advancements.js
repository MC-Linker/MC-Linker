const { replace } = require('lodash');

module.exports = {
    name: 'advancements',
    description: "Look at your and other member's minecraft server advancements. Advancements will be updated every time the server restarts. \nUSAGE: advancements @<user>",
    execute(message, args) {

        const fs = require('fs');
        const ftp = require('ftp')
        const Discord = require('discord.js')

        if (!message.mentions.users.size) {
            console.log(message.member.user.tag + ' executed ^advancements without user.')
            message.reply('you need to tag a user!');
            return;
        }

        const taggedUser = message.mentions.users.first();
        const mode = (args[1]);
        const object = (args[2]);

        console.log(message.member.user.tag + ' executed ^advancements ' + mode + ' ' + object +  ' with taggedUser: ' + taggedUser.tag);

        fs.readFile('./connections/' + taggedUser.tag + '.json', 'utf8', (err, connectionJson) => {
            if(err) {
                message.reply('User isnt connected!')
                console.log('Error reading file from disk: ', err);
                return;
            }
            const connectionData = JSON.parse(connectionJson);
            const minecraftId = connectionData.id;

            let uuidv4 = minecraftId.split('')
            for(let i = 8; i <=23; i+=5) uuidv4.splice(i,0,'-');                       
            uuidv4 = uuidv4.join("");

            fs.readFile('./ftp/' + message.guild.name + '.json', 'utf8', async function(err, ftpJson) {
                if(err) {
                        console.log('Error reading file from disk: ', err);
                        message.reply('Could not find ftpcredentials. Please contact a server-admin.')
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
                        message.reply('Could not connect to server.')
                        reject('error')
                    })
                    ftpClient.on('ready', function() {
                        ftpClient.get(ftpData.path + '/advancements/' + uuidv4 + '.json', function(err, stream) {
                            if(err) {
                                console.log('Could not download advancements. ', err);
                                message.reply('Could not download advancements. ')
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
                        message.reply('Could not connect to server.')
                        reject('error')
                    }  
                })  
            }
            await ftpconnect()

            fs.readFile('./advancements/' + uuidv4 + '.json', 'utf8', (err, advancementJson) => {
                if(err) {
                    message.reply('Could not find advancement file. Member most likely never joined the server.')
                    console.log('Error reading stat file from disk: ', err);
                    return;
                }

                const baseEmbed = new Discord.MessageEmbed()
                    .setTitle('Advancement')
                    .setColor('#730A85')
                    .setAuthor('SMP Bot', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png');

                try {
                    const advancementData = JSON.parse(advancementJson);

                    if(mode === 'recipes') {

                        const creativeTab = ['tools', 'food', 'decorations', 'building_blocks', 'redstone', 'combat', 'transportation', 'misc', 'brewing']
                        let key;
                        let undefinedCounter = 0;

                        for (let i = 0; i<=creativeTab.length; i++) {
                            if(key === undefined) undefinedCounter++;
                            if(undefinedCounter === 10) {
                                console.log('Couldnt find recipe.'); 
                                message.reply('Advancement not completed or misspelled!')
                            }
                            try {
                                key = Object.keys(advancementData['minecraft:' + mode + '/' + creativeTab[i] + '/' + object]['criteria'])
                                let searchName = advancementData['minecraft:' + mode + '/' + creativeTab[i] + '/' + object]['criteria'][key]
                                searchName = searchName.replace(' +0000', '')

                                console.log('Sent advancement [' + mode + ' ' + object + ']' + taggedUser.tag + ' : ' + searchName)
                                const amEmbed = baseEmbed.addField(`==================\n${mode} ${object}`, '**==================**').addField('unlocked on', searchName).addField('Criteria', key)
                                message.channel.send(amEmbed)
                            } catch (err) {
                            }
                        } 
                    } else {
                        try {
                            let key = Object.keys(advancementData['minecraft:' + mode + '/' + object]['criteria'])
                            let searchName = advancementData['minecraft:' + mode + '/' + object]['criteria'][key]
                            searchName = searchName.replace(' +0000', '')

                            console.log('Sent advancement [' + mode + ' ' + object + ']' + taggedUser.tag + ' : ' + searchName)
                            const amEmbed = baseEmbed.addField(`==================\n${mode} ${object}`, '**==================**').addField('completed on', searchName).addField('Criteria', key)
                            message.channel.send(amEmbed)
                        } catch (err) {
                            console.log('Error sending advancement.', err)
                            message.reply('Advancement not completed or misspelled!')
                        }
                    }

                } catch (err) {
                    console.log('Error parsing advancementJSON string: ', err);
                    message.reply('Advancement not completed or misspelled!')
                }
            })
            })
        })
    }
}