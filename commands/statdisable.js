module.exports = {
    name: 'statdisable',
    description: 'Disable a specific statcategory/item/entity/block. \nIMPORTANT: Renaming the server will result in resetting all disabled stats!\nUSAGE: statdisable category/object <category/item/entity/block **id**> \n EXAMPLE: statdisable category picked_up OR statdisable object blaze OR statdisable object netherite_ingot',
    execute(message, args){

        const fs = require('fs');

        const mode = (args[0]);
        const object = (args[1]);

        if (!message.member.hasPermission('ADMINISTRATOR')) {
            message.reply(":warning: You are not an Admin!")
            console.log(message.member.user.tag + ' executed ^statdisable without admin in ' + message.guild.name)
            return;
        }

        console.log(message.member.user.tag + ' executed ^statdisable ' + mode + ' ' + object + ' in ' + message.guild.name)

        if(mode === 'category') {

            fs.writeFile('./disable/stats/category/' + message.guild.id + "_" + object, '\u200b', err => {
                if (err) {
                    console.log('Error writing disableFile ', err)
                    message.reply("<:Error:849215023264169985> Error, please check ^help statdisable for correct usage.")
                } else {
                    console.log('Successfully wrote disableFile: ' + './disable/stats/object/' + message.guild.id + "_" + object);
                    message.reply('<:Checkmark:849224496232660992> Disabling of **' + mode + ' ' + object + '** succesful.')
                }
            })
        } else if(mode === 'object') {

                fs.writeFile('./disable/stats/' + message.guild.id + "_" + object, '\u200b', err => {
                    if (err) {
                        console.log('Error writing disableFile ', err)
                        message.reply("<:Error:849215023264169985> Error, please check ^help statdisable for correct usage.")
                    } else {
                        console.log('Successfully wrote disableFile: ' + './disable/stats/object/' + message.guild.id + "_" + object);
                        message.reply('<:Checkmark:849224496232660992> Disabling of **' + mode + ' ' + object + '** succesful.')
                    }
                })
        } else {
            message.reply("<:Error:849215023264169985> Wrong Usage!")
            return;
        }
    }
}