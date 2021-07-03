module.exports = {
    name: 'statsstate',
    aliases: ['statstate', 'ss'],
    usage: 'statsstate category/object <category/item/entity/block **id**>',
    example: 'statsstate => outputs all disabled stats **//** e.g. STATSDISABLE',
    description: 'Look at all disabled statcategorys/items/entitys/blocks.',
    execute(message, args){

        const Discord = require('discord.js');
        const fs = require('fs');

        const mode = (args[0]);
        const object = (args[1]);

        if (!mode) {
            console.log(message.member.user.tag + ' executed ^statstate without args in ' + message.guild.name + '. Showing all disabled stats.')

            const categoryFiles = fs.readdirSync('./disable/stats/category');
            const objectFiles = fs.readdirSync('./disable/stats/object');

            const indexC = categoryFiles.indexOf('GitInit.json');
            const indexO = objectFiles.indexOf('GitInit.json');
            if (indexC > -1) {
              categoryFiles.splice(indexC, 1);
            } 
            if (indexO > -1) {
              objectFiles.splice(indexO, 1);
            }
          
            for(let i = 0; i < categoryFiles.length; i++) {
                categoryFiles[i] = categoryFiles[i].replace(`${message.guild.id}_`, '');
                categoryFiles[i] = categoryFiles[i].replace('.json', '');
            }
            for(let i = 0; i < objectFiles.length; i++) {
                objectFiles[i] = objectFiles[i].replace(`${message.guild.id}_`, '');
                objectFiles[i] = objectFiles[i].replace('.json', '');
            }

            if(categoryFiles.length === 0 && objectFiles.length === 0) {
                console.log('No disabled stats.')
                message.reply('<:Checkmark:849224496232660992> No disabled stats :)')
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

        console.log(message.member.user.tag + ' executed ^statstate ' + mode + ' ' + object + ' in ' + message.guild.name)

        if(mode === 'category') {
            fs.access('./disable/stats/category/' + message.guild.id + "_" + object, fs.constants.F_OK, (err) => {
                if (err) {
                    message.reply('<:Checkmark:849224496232660992> Category [**' + object + '**] enabled!')
                    console.log('Could not find state file. Category [' + object + '] not disabled! ', err);
                    return;
                }
                else {
                    console.log('Category [' + object + '] disabled')
                    message.reply(':no_entry: Category [**' + object + '**] disabled')
                }
            });
        } else if (mode === 'object') {
            fs.access('./disable/stats/object/' + message.guild.id + "_" + object, fs.constants.F_OK, (err) => {
                if (err) {
                    message.reply('<:Checkmark:849224496232660992> Object [**' + object + '**] enabled!')
                    console.log('Could not find state file. Object [' + object + '] not disabled! ', err);
                    return;
                }
                else {
                    console.log('Object [' + object + '] disabled')
                    message.reply(':no_entry: Object [**' + object + '**] disabled')
                }
            })
        } else {
            console.log("Arg neither object or category.")
            message.reply('<:Error:849215023264169985> Wrong Usage! Check ^help statstate for correct usage.')
        }
    }
}


