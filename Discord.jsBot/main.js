console.log('Loading...')

const Discord = require('discord.js')
const { prefix, token } = require('./config.json');
const client = new Discord.Client()
const fs = require('fs');
const fetch = require('node-fetch');


client.once('ready', () => {
    console.log('Bot logged in as ' + client.user.tag + '!')
    console.log('Der Bot ist auf ' + client.guilds.cache.size + ' servers!')
})

async function sleep(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
} 

client.on('guildMemberAdd', async member => {
    const channel = member.guild.channels.cache.get('800751473309777950');
    if (!channel) return;
    channel.send(`Welcome to the Boringcraft SMP <@${member.id}> \n The Minecraft Server in which you definitely get bored.`)
});

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

                console.log(message.member.user.tag + ' executed ^stats with taggedUser: ' + taggedUser.tag);

                fs.readFile('./connections/' + taggedUser.tag + '.json', 'utf8', (err, jsonString) => {
                    if(err) {
                        message.channel.send('User isnt connected!')
                        console.log('Error reading file from disk: ', err);
                            return;
                    } else {
                        try {
                            const data = JSON.parse(jsonString);
                            let minecraftId = data.id;
                            const { join } = require('path');
                            const { readdirSync, renameSync } = require('fs');
                            const files = readdirSync('./stats');
                            
                            
                            fs.readFile('./ftp/' + message.guild.name + '.json', 'utf8', (err, jsonString) => {
                                if(err) {
                                    console.log('Error reading file from disk: ', err);
                                    return;
                                } else {
                                    try {
                                        const data = JSON.parse(jsonString);
                                        let host = data.host
                                        let port = data.port
                                        let user = data.user
                                        let password = data.password
                                        var ftpClient = require('ftp-client'),
                                            config = {
                                                    host: host,
                                                    port: port,
                                                    user: user,
                                                    password: password
                                            },
                                            options = {
                                                    logging: 'basic'
                                            },
                                        clientFtp = new ftpClient(config, options);
                                        clientFtp.connect(function () {
                                        clientFtp.download(data.path + '/stats', './stats', {
                                            overwrite: 'all'
                                        }, function () {
                                            console.log('Tried downloading Stats.')
                                        });
                                        });
                                    } catch (err) {
                                        console.log('Error parsing JSON string: ', err);
                                    }
                                }                                
                            
                            })

                            files
                                .forEach(file => {
                                    const filePath = join('./stats', file);
                                    const newFilePath = join('./stats', file.replace(/\-/g, ''));

                                    renameSync(filePath, newFilePath);
                                });

                            fs.readFile('./stats/' + minecraftId + '.json', 'utf8', (err, jsonString) => {
                                if(err) {
                                    message.channel.send('Could not find stat file in Server. Member most likely never joined the server.')
                                    console.log('Error reading file from disk: ', err);
                                    return;
                                } else {
                                    try {
                                        const data = JSON.parse(jsonString);
                                        let searchName = data.stats["minecraft:" + statType]["minecraft:" + statObject]
                                            if (searchName){
                                                message.channel.send(searchName)
                                            } else {
                                                console.log("No Match found!")
                                                message.channel.send('No Match found! Stat is either 0 or mispelled!')
                                            }
                                    } catch (err) {
                                        console.log('Error parsing JSON string: ', err);
                                    }
                                }
                            }) 
                        } catch(err) {
                            console.log(err)
                        }
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
                    { name: 'STATDISABLE', value: 'Disable a specific statcategory/item/entity/block. Currently WIP. \nUSAGE: statdisable category/object <category/object> \n EXAMPLE: statdisable category picked_up OR statdisable object blaze OR statdisable object netherite_ingot'}
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
                    {name: 'OUTDATED', value: `This command is currently OUTDATED. It wIll be updated soon. Just use this [Website](https://minecraft.fandom.com/wiki/Statistics#Statistic_types_and_names) for now`}
                ); 
                message.channel.send(statHelpEmbed)

            } else if(command === 'connect') {

                const ingameName = (args[0]);

                function getId(playername) {
                    return fetch(`https://api.mojang.com/users/profiles/minecraft/${playername}`)
                      .then(data => data.json())
                      .then(player => player.id);
                }
                
                const minecraftId = getId(ingameName).then(id => {
                    message.channel.send(`Connected with Id: ${id}`)
                    console.log(id)
                })

                getId(ingameName).then(id => {
                  const connectionJson = {
                    "id": id
                  }
                  const jsonString = JSON.stringify(connectionJson, null, 2);

                fs.writeFile('./connections/' + message.member.user.tag + '.json', jsonString, err => {
                    if (err) {
                        console.log('Error writing file', err)
                    } else {
                        console.log('Successfully wrote file')
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
                    message.channel.send("You are not an Admin!")
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

                const jsonString = JSON.stringify(jsonFtp, null, 2);

                fs.writeFile('./ftp/' + message.guild.name + '.json', jsonString, err => {
                    if (err) {
                        console.log('Error writing file', err)
                    } else {
                        console.log('Successfully wrote file')
                        message.channel.send('Succesfully connected with server.')
                    }
                })
            } else if(command === 'statdisable') {

                const mode = (args[0]);
                const object = (args[1]);

                if (!message.member.hasPermission('ADMINISTRATOR')) {
                    message.channel.send("You are not an Admin!")
                    console.log(message.member.user.tag + ' executed ^statdisable without admin!')
                    return;
                }

                console.log(message.member.user.tag + ' executed ^statdisable.')

                if(mode === 'category') {

                    fs.writeFile('./stats/disable/category/' + object + '.json', jsonString, err => {
                        if (err) {
                            console.log('Error writing file', err)
                            message.channel.send("Error, please check ^help for correct usage.")
                        } else {
                            console.log('Successfully wrote file')
                            message.channel.send("Disabling succesful.")
                        }
                    })
                } else if(mode === 'object') {

                        fs.writeFile('./stats/disable/object/' + object + '.json', jsonString, err => {
                            if (err) {
                                console.log('Error writing file', err)
                                message.channel.send("Error, please check ^help for correct usage.")
                            } else {
                                console.log('Successfully wrote file')
                                message.channel.send("Disabling succesful.")
                            }
                        })
                } else {
                    message.channel.send("Wrong Usage!")
                    return;
                }
            }
        })
client.login(process.env.token)

    
