module.exports = {
    name: 'statenable',
    description: 'Enable a disabled statcategory/item/entity/block. Can only be used by admins. \nUSAGE: statenable category/object <category/item/entity/block **id**> \n EXAMPLE: e.g. STATDISABLE',
    execute(message, args){

        const fs = require('fs');

        const mode = (args[0]);
        const object = (args[1]);

        if (!message.member.hasPermission('ADMINISTRATOR')) {
            message.reply(":warning: You are not an Admin!")
            console.log(message.member.user.tag + ' executed ^statenable without admin in ' + message.guild.name)
            return;
        }

        console.log(message.member.user.tag + ' executed ^statenable ' + mode + ' ' + object + ' in ' + message.guild.name)

        if(mode === 'category') {
            fs.unlink('./disable/stats/category/' + message.guild.id + '_' + object, (err => {
                if(err) {
                    console.log('Error deleting disableFile ', err)
                    message.reply("<:Error:849215023264169985> Error, please check ^help statenable for correct usage.")
                }
                console.log('Deleted disableFile: ' + message.guild.id + '_' + object)
                message.reply('<:Checkmark:849224496232660992> Category [**'  + object + '**] succesfully enabled!')
            }));
        } else if (mode === 'object') {
            fs.unlink('./disable/stats/object/' + message.guild.id + '_' + object, (err => {
                if(err) {
                    console.log('Error deleting disableFile ', err)
                    message.reply("<:Error:849215023264169985> Error. Is stat already enabled? ^help statenable for correct usage.")
                } else {
                    console.log('Deleted disableFile: ' + message.guild.id + '_' + object)
                    message.reply('<:Checkmark:849224496232660992> Object [**'  + object + '**] succesfully enabled!')
                }
                
            }));
        } else {
            message.reply("<:Error:849215023264169985> Wrong Usage! Check ^help statenable for correct usage.")
            return;
        }
    }
}