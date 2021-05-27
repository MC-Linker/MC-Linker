module.exports = {
    name: 'statenable',
    description: "this is a ping command!",
    execute(message, args){

        const fs = require('fs');

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
    }
}