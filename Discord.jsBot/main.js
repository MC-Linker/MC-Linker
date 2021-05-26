console.log('Loading...')

const Discord = require('discord.js')
const { prefix, token } = require('./config.json');
const client = new Discord.Client()
const fs = require('fs');
const fetch = require('node-fetch');
const ftp = require('ftp')


client.once('ready', () => {
    console.log('Bot logged in as ' + client.user.tag + '!')
    console.log('Der Bot ist auf ' + client.guilds.cache.size + ' servers!')
})

async function sleep(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
} 

client.on('message', (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if(command === 'pingchain') {
            
            if (!message.mentions.users.size) {
                return message.reply('you need to tag a user!');
            }

            const amount = parseInt(args[1]);
            const second = parseInt(args[2]);
            const user = message.mentions.users.first();
            
            let attachment = new Discord.MessageAttachment('./loading.gif')

            const LoadingEmbed = new Discord.MessageEmbed()
                .setTitle('Pingchain loading...')
                .attachFiles(attachment)
                .setColor('#5c1204')
                .setImage('attachment://loading.gif');

                console.log(message.member.user.tag + ' executed ^Pingchain')
                message.channel.send(LoadingEmbed)
                .then(message => {
                    message.delete({ timeout: 10000})
                  })
                  .catch(console.error);
                if(isNaN(amount)) {
                   return message.reply('thats not a number lol');
                } else if (amount < 2 || amount > 100) {
                    return message.reply('too high/low')
                }
                setTimeout(async function() {
                    for(let i = 0; i<amount; i++) {
                            message.channel.send(`<@${user.id}>`)
                                .then(message => {
                                    message.delete({ timeout: 180000})
                                })
                              .catch(console.error);
                            await sleep(second * 1000)           
                }      
                }, 10000)
            } else if(command === 'stats') {
                if (!message.mentions.users.size) {
                    return message.reply('you need to tag a user!');
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
                                    message.reply('Could not find stat file in Server. Member most likely never joined the server.')
                                    console.log('Error reading stat file from disk: ', err);
                                    return;
                                }
                                try {
                                    const statData = JSON.parse(statJson);
                                    let searchName = statData.stats["minecraft:" + statType]["minecraft:" + statObject]
                                        if (searchName){
                                            console.log("Sent stat " + statType + " " + statObject + " from User: " + taggedUser.tag + " : " + searchName)
                                            message.reply(searchName)
                                        } else {
                                            console.log("No Match found!")
                                            message.reply('No Match found! Stat is either 0 or mispelled!')
                                        }
                                } catch (err) {
                                    console.log('Error parsing Stat JSON string: ', err);
                                    message.reply('Could not find stat file.')
                                }
                            })
                        })
                    }
                })
            } else if(command === 'random') {
                const messages = ["what up, GAMERSS", "With ^stats @<username> <Statkategorie> <Statitem/block/entity> you can see your Minecraft Server stats!", "message three", "message four", "With ^Pingchain @<username> <Pinganzahl> <Delay between Pings in millicseconds> you can ping a user up to 100 times. \nThe pings will be automatically deleted after 3 minutes!", "You can send random messages with ^random", "Du Stinkst! \nStärker als Trymacs!!!", "Press Alt+F4 in Minecraft and you will see the Super Secret Settings!", "Press Alt+F4 in Discord a secret message from Wumous will appear.", "How are you? \n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\nö"]

                const randomMessage = messages[Math.floor(Math.random() * messages.length)];
                
                message.channel.send(randomMessage)
            } else if(command === 'help') {

                const HelpEmbed = new Discord.MessageEmbed()
                .setTitle('Help Menu')
                .setDescription('You can find helpful informations here!')
                .setColor('#000000')
                .setImage("https://cdn.discordapp.com/attachments/838107054290894911/841973239299178526/smp.png")
                .addFields(
                    { name: 'PREFIX', value: 'This Bot uses the PREFIX: ^ \nIMPORTANT: Use this PREFIX at the start of every command.'},
                    { name: 'RANDOM', value: 'Random Message \nUSAGE: random'},
                    { name: 'STATS', value: `Look at your and other member's minecraft server stats. Stats will be updated every time the server restarts. \nUSAGE: stats @<username> <Statcategory> <Statitem/block/entity> \n EXAMPLE: stats @Lianecx mined iron_ore \n All Categories can be find either with ^stathelp or in this [Website](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names)!`},
                    { name: 'PINGCHAIN', value: 'Ping a User up to 100 times with configurable delay. \n USAGE: Pingchain @<username> <Pingnumber> <Delay between Pings in milliseconds> \IMPORTANT: The Pings will be automatically deleted after 3 minutes.'},
                    { name: 'FTP', value: 'Connect your minecraft Server with the bot. Can only be used by Admins. \n USAGE: ftp <host> <username> <password> <port (default 21)> <path to world folder. Default Path: minecraft/WORLDNAME>' },
                    { name: 'CONNECT', value: 'Connect your Discord Account with your Minecraft Account. \n USAGE: connect <Minecraftname>'},
                    { name: 'STATHELP', value: `Currently WIP, just use this [Website](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names) for now.`},
                    { name: 'STATDISABLE', value: 'Disable a specific statcategory/item/entity/block. \nIMPORTANT: Renaming the server will result in resetting all disabled stats!\nUSAGE: statdisable category/object <category/item/entity/block> \n EXAMPLE: statdisable category picked_up OR statdisable object blaze OR statdisable object netherite_ingot'},
                    { name: 'STATENABLE', value: 'Enable a disabled statcategory/item/entity/block. \nUSAGE: statenable category/object <category/item/entity/block> \n EXAMPLE: e.g. STATDISABLE'},
                    { name: 'STATSTATE', value: 'Look at all disabled statcategorys/items/entitys/blocks. \nUSAGE: statstate category/object <category/item/entity/block>/statstate(outputs states of all disabled categorys/objects) \n EXAMPLE: e.g. STATDISABLE'}
                );

                console.log(message.member.user.tag + ' executed ^help')
                message.channel.send(HelpEmbed)
            } else if(command === 'stathelp') {

                const statHelpEmbed = new Discord.MessageEmbed()
                .setTitle('Stat Help')
                .setDescription('All Stat Categories!')
                .setColor('#000000')
                .addFields(
                    {name: 'picked_up', value: 'Counts how often the player picked up an item.'},
                    {name: 'WIP', value: `This command is currently WIP. It wIll be updated soon. Just use this [Website](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names) for now`}
                ); 
                message.channel.send(statHelpEmbed)

            } else if(command === 'connect') {

                const ingameName = (args[0]);

                function getId(playername) {
                    return fetch(`https://api.mojang.com/users/profiles/minecraft/${playername}`)
                      .then(data => data.json())
                      .then(player => player.id);
                }
                
                getId(ingameName).then(id => {
                    message.reply(`Connected with Id: ${id}`)
                    console.log(message.member.user.tag + " connected with ID: " + id)
                })

                getId(ingameName).then(id => {
                  const connectionJson = {
                    "id": id
                  }

                    const connectionString = JSON.stringify(connectionJson, null, 2);

                    fs.writeFile('./connections/' + message.member.user.tag + '.json', connectionString, err => {
                        if (err) {
                            console.log('Error writing file', err)
                        } else {
                            console.log('Successfully wrote connectionfile')
                        }
                    })
                });
            } else if(command === 'ftp') {
                let host = (args[0]);
                let user = (args[1]);
                let password = (args[2]);
                let port = parseInt(args[3]);
                let path = (args[4])

                if (!message.member.hasPermission('ADMINISTRATOR')) {
                    message.reply("You are not an Admin!")
                    console.log(message.member.user.tag + ' executed ^ftp without admin!')
                    return;
                }

                console.log(message.member.user.tag + ' executed ^ftp in Server: ' + message.guild.name)

                if(!port) {
                    port = 21
                }

                const jsonFtp = {
                    "host": host,
                    "user": user,
                    "password": password,
                    "port": port,
                    "path": path
                }

                const ftpString = JSON.stringify(jsonFtp, null, 2);

                fs.writeFile('./ftp/' + message.guild.name + '.json', ftpString, err => {
                    if (err) {
                        console.log('Error writing file', err)
                    } else {
                        console.log('Successfully wrote file')
                        message.reply('Succesfully connected with server.')
                    }
                })
            } else if(command === 'statdisable') {

                const mode = (args[0]);
                const object = (args[1]);

                if (!message.member.hasPermission('ADMINISTRATOR')) {
                    message.reply("You are not an Admin!")
                    console.log(message.member.user.tag + ' executed ^statdisable without admin!')
                    return;
                }

                console.log(message.member.user.tag + ' executed ^statdisable ' + mode + ' ' + object)

                const disableJson = {
                    "disable": "disabled" 
                }

                const disableString = JSON.stringify(disableJson, null, 2);

                if(mode === 'category') {

                    fs.writeFile('./stats/disable/category/' + message.guild.name + "_" + object + '.json', disableString, err => {
                        if (err) {
                            console.log('Error writing disableJSON ', err)
                            message.reply("Error, please check ^help for correct usage.")
                        } else {
                            console.log('Successfully wrote disableJSON: ' + './stats/disable/object/' + message.guild.name + "_" + object + '.json')
                            message.reply('Disabling of ' + mode + ' ' + object + ' succesful.')
                        }
                    })
                } else if(mode === 'object') {

                        fs.writeFile('./stats/disable/object/' + message.guild.name + "_" + object + '.json', disableString, err => {
                            if (err) {
                                console.log('Error writing disableJSON ', err)
                                message.reply("Error, please check ^help for correct usage.")
                            } else {
                                console.log('Successfully wrote disableJSON: ' + './stats/disable/object/' + message.guild.name + "_" + object + '.json')
                                message.reply('Disabling of ' + mode + ' ' + object + ' succesful.')
                            }
                        })
                } else {
                    message.reply("Wrong Usage!")
                    return;
                }
            } else if(command === 'statenable') {
                const mode = (args[0]);
                const object = (args[1]);

                if (!message.member.hasPermission('ADMINISTRATOR')) {
                    message.reply("You are not an Admin!")
                    console.log(message.member.user.tag + ' executed ^statenable without admin!')
                    return;
                }

                console.log(message.member.user.tag + ' executed ^statenable ' + mode + ' ' + object)

                if(mode === 'category') {
                    fs.unlink('./stats/disable/category/' + message.guild.name + '_' + object + '.json', (err => {
                        if(err) {
                            console.log('Error deleting disableJSON ', err)
                            message.reply("Error, please check ^help for correct usage.")
                        }
                        console.log('Deleted disableJson: ' + message.guild.name + '_' + object + '.json')
                        message.reply('Category ['  + object + '] succesfully enabled!')
                    }));
                } else if (mode === 'object') {
                    fs.unlink('./stats/disable/object/' + message.guild.name + '_' + object + '.json', (err => {
                        if(err) {
                            console.log('Error deleting disableJSON ', err)
                            message.reply("Error, please check ^help for correct usage.")
                        }
                        console.log('Deleted disableJson: ' + message.guild.name + '_' + object + '.json')
                        message.reply('Object ['  + object + '] succesfully enabled!')
                    }));
                } else {
                    message.reply("Wrong Usage! Check ^help for correct usage.")
                    return;
                }
                    
            } else if (command === 'statstate') {
                const mode = (args[0]);
                const object = (args[1]);

                if (!mode) {
                    console.log(message.member.user.tag + ' executed ^statstate without args. Showing all disabled stats.')

                    const categoryFiles = fs.readdirSync('./stats/disable/category')
                    const objectFiles = fs.readdirSync('./stats/disable/object')

                    if(categoryFiles.length === 0 && objectFiles.length === 0) {
                        console.log('No disabled stats.')
                        message.reply('No disabled stats :)')
                        return;
                    } else if(categoryFiles.length === 0) {
                        const stateEmbed = new Discord.MessageEmbed()
                            .setTitle('Statstates')
                            .setColor('#5c1204')
                            .setAuthor('SMP Bot')
                            .addField('============\nDisabled Objects', '**============**');
                            objectFiles.forEach(entry => {
                                stateEmbed.addField(entry, 'disabled');
                            });
                        message.channel.send(stateEmbed)
                        return;
                    } else if(objectFiles.length === 0) {
                        const stateEmbed = new Discord.MessageEmbed()
                            .setTitle('Statstates')
                            .setColor('#5c1204')
                            .setAuthor('SMP Bot')
                            .addField('==============\nDisabled Categorys', '**==============**');
                            categoryFiles.forEach(entry => {
                                stateEmbed.addField(entry, 'disabled');
                            });
                        message.channel.send(stateEmbed)
                        return;
                    }

                    const stateEmbed = new Discord.MessageEmbed()
                    .setTitle('Statstates')
                    .setColor('#5c1204')
                    .setAuthor('SMP Bot')
                    .addField('==============\nDisabled Categorys', '**==============**');
                    categoryFiles.forEach(entry => {
                        stateEmbed.addField(entry, 'disabled');
                    });
                    stateEmbed.addField('============\nDisabled Objects', '**============**')
                    objectFiles.forEach(entry => {
                        stateEmbed.addField(entry, 'disabled');
                    });


                    message.channel.send(stateEmbed)
                    return;
                }

                console.log(message.member.user.tag + ' executed ^statstate ' + mode + ' ' + object)

                if(mode === 'category') {
                    fs.readFile('./stats/disable/category/' + message.guild.name + "_" + object + '.json', 'utf8', (err, stateJson) => {
                        if(err) {
                            message.reply('Category [' + object + '] enabled!')
                            console.log('Could not find state file. Category [' + object + '] not disabled! ', err);
                            return;
                        }
                        try {
                            const stateData = JSON.parse(stateJson);
                                if (stateData.disable === 'disabled'){
                                    console.log('Category [' + object + '] disabled')
                                    message.reply('Category [' + object + '] disabled')
                                } else {
                                    console.log("Error reading stateJson.")
                                    message.reply('Error! Try again!')
                                }
                        } catch (err) {
                            console.log('Error parsing/reading stateJSON string: ', err);
                            message.reply('Error! Try again!')
                        }
                    })
                } else if (mode === 'object') {
                    fs.readFile('./stats/disable/object/' +  message.guild.name + "_" + object + '.json', 'utf8', (err, stateJson) => {
                        if(err) {
                            message.reply('Object [' + object + '] enabled!')
                            console.log('Could not find state file. Object [' + object + '] not disabled! ', err);
                            return;
                        }
                        try {
                            const stateData = JSON.parse(stateJson);
                                if (stateData.disable === 'disabled'){
                                    console.log('Object [' + object + '] disabled')
                                    message.reply('Object [' + object + '] disabled')
                                } else {
                                    console.log("Error reading/parsing stateJson string.")
                                    message.reply('Error! Try again!')
                                }
                        } catch (err) {
                            console.log('Error parsing stateJSON string: ', err);
                            message.reply('Error! Try again!')
                        }
                    })
                } else {
                    message.reply('Wrong Usage! Check ^help for correct usage.')
                }
            }
        })
client.login(token)

    
