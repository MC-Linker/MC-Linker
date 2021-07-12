module.exports = {
    name: 'inventorys',
    aliases: ['inv', 'inventory'],
    usage: 'inventory <mention/username>',
    example: 'inventory @Lianecx **//** inventory xXgamerkidXx',
    description: "**WIP** Get a list of a player's inventory.",
    async execute(message, args) {
		const utils = require('../utils');
		const nbt = require('nbt');
		const fs = require('fs');
        const ftp = require('../ftpConnect');

        if(!args[0]) {
            console.log(message.member.user.tag + ' executed ^inv without args');
            message.reply(':warning: Please specify the user you want to get the inventory from.');
            return;
        }
		
		let taggedName;
		const uuidv4 = await utils.getUUIDv4(args[0], message);
        if(!message.mentions.users.size) {
            taggedName = (args[0]);
        } else {
            taggedName = message.mentions.users.first().tag;
        }
        await ftp.get(`/playerdata/${uuidv4}.dat`, `./playernbt/${uuidv4}.dat`, message);
		
		const playerNBT = fs.readFileSync(`./playernbt/${uuidv4}.dat`);
        // @ts-ignore
        nbt.parse(playerNBT, function(err, playerData) {
            if (err) {
                console.log('Error trying to parse player NBT', err);
                message.reply('<:Error:849215023264169985> Error trying to read inventory');
                return;
            }
            

            const inventory = playerData.value['Inventory'].value['value']

            let invMsg = "Here's the inventory of **" + taggedName + '**:\n';

            console.log(inventory)
            for(let i = 0; i < inventory.length; i++) {
                invMsg = invMsg += 'Slot: ' + inventory[i]['Slot'].value + ': ' + inventory[i]['id'].value + ', ' + inventory[i]['Count'].value + '\n'
            }
            message.reply(invMsg);
        });
	}
}