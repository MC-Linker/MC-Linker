module.exports = {
    name: 'statstate',
    description: "Look at all disabled statcategorys/items/entitys/blocks. \nUSAGE: statstate category/object <category/item/entity/block>/statstate(outputs states of all disabled categorys/objects) \n EXAMPLE: e.g. STATDISABLE",
    execute(message, args){

        const Discord = require('discord.js');
        const fs = require('fs');

        const mode = (args[0]);
        const object = (args[1]);

        if (!mode) {
            console.log(message.member.user.tag + ' executed ^statstate without args. Showing all disabled stats.')

            const categoryFiles = fs.readdirSync('./stats/disable/category')
            const objectFiles = fs.readdirSync('./stats/disable/object')

            const indexC = categoryFiles.indexOf('GitInit.json');
            const indexO = objectFiles.indexOf('GitInit.json');
            if (indexC > -1) {
              categoryFiles.splice(indexC, 1);
            } 
            if (indexO > -1) {
              objectFiles.splice(indexO, 1);
            }

            for(var i = 0; i < categoryFiles.length; i++) {
                categoryFiles[i] = categoryFiles[i].replace(`${message.guild.name}_`, '');
                categoryFiles[i] = categoryFiles[i].replace('.json', '');
            }
            for(var i = 0; i < objectFiles.length; i++) {
                objectFiles[i] = objectFiles[i].replace(`${message.guild.name}_`, '');
                objectFiles[i] = objectFiles[i].replace('.json', '');
            }

            if(categoryFiles.length === 0 && objectFiles.length === 0) {
                console.log('No disabled stats.')
                message.reply('No disabled stats :)')
                return;
            } else if(categoryFiles.length === 0) {
                const stateEmbed = new Discord.MessageEmbed()
                    .setTitle('Statstates')
                    .setColor('#5c1204')
                    .setAuthor('SMP Bot')
                    .addField('============\nDisabled Objects', '**============**')
                    objectFiles.forEach(file => {
                        stateEmbed.addField(file, 'disabled');
                    });
                message.channel.send(stateEmbed)
                return;
            } else if(objectFiles.length === 0) {
                const stateEmbed = new Discord.MessageEmbed()
                    .setTitle('Statstates')
                    .setColor('#5c1204')
                    .setAuthor('SMP Bot')
                    .addField('==============\nDisabled Categorys', '**==============**')
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
            .addField('==============\nDisabled Categorys', '**==============**')
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
}


