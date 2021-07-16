module.exports = {
    name: 'inventorys',
    aliases: ['inv', 'inventory'],
    usage: 'inventory <mention/username>',
    example: 'inventory @Lianecx **//** inventory xXgamerkidXx',
    description: "Get an image of a player's inventory.",
    async execute(message, args) {
		const utils = require('../utils');
		const nbt = require('nbt');
		const fs = require('fs');
        const ftp = require('../ftpConnect');
        const Canvas = require('canvas');
        const Discord = require('discord.js');

        if(!args[0]) {
            console.log(message.member.user.tag + ' executed ^inv without args in ' + message.guild.name);
            message.reply(':warning: Please specify the user you want to get the inventory from.');
            return;
        }

        let taggedName;
        if(!message.mentions.users.size) {
            taggedName = (args[0]);
        } else {
            taggedName = message.mentions.users.first().tag;
        }
        console.log(message.member.user.tag + ' executed ^inventorys with user: ' + taggedName + ' in ' + message.guild.name);

		const uuidv4 = await utils.getUUIDv4(args[0], message);
        if(uuidv4 === undefined) {
            return;
        }

        await ftp.get(`/playerdata/${uuidv4}.dat`, `./playernbt/${uuidv4}.dat`, message);
		
		const playerNBT = fs.readFileSync(`./playernbt/${uuidv4}.dat`);
        // @ts-ignore
        nbt.parse(playerNBT, async function(err, playerData) {
            if (err) {
                console.log('Error trying to parse player NBT', err);
                message.reply('<:Error:849215023264169985> Error trying to read inventory');
                return;
            }
            
            const inventory = playerData.value['Inventory'].value['value']

            //const itemImg = await Canvas.loadImage('./images/acacia_boat.png');
            //ctx.drawImage(itemImg, 0, 0, 80, 80, 7, 7, 17, 17);

            //let invMsg = "Here's the inventory of **" + taggedName + '**:\n';
            const invCanvas = Canvas.createCanvas(352, 332);
            const ctx = invCanvas.getContext('2d');
            const background = await Canvas.loadImage('./images/_other/inventoryBlank.png');
            ctx.drawImage(background, 0, 0, invCanvas.width, invCanvas.height);

            let invEmbed = new Discord.MessageEmbed;
            invEmbed
                .setAuthor('Inventory Enchantments', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                .setColor('ORANGE')
            let slotDim = [16, 284];
            Canvas.registerFont('./MinecraftReg.ttf', { family: 'Minecraft Regular' });
            for(let i = 0; i < inventory.length; i++) {
                const slot = inventory[i]['Slot'].value;
                const id = inventory[i]['id'].value;
                const count = inventory[i]['Count'].value;
                let maxDamage;
                let damage;
                if(inventory[i]['tag'] !== undefined) {
                    let invField = '';
                    if(inventory[i]['tag'].value['Enchantments'] !== undefined) {
                        invField += `\n**Slot ${slot}: ${id.split('minecraft:').pop()}:**`;
                        const enchantments = inventory[i]['tag'].value['Enchantments'].value['value'];
                        for(let b = 0; b < enchantments.length; b++) {
                            if(enchantments[b]['lvl'].value === 1){
                                invField += `\n-${enchantments[b]['id'].value.split('minecraft:').pop()}`;
                            } else {
                                invField += `\n-${enchantments[b]['id'].value.split('minecraft:').pop()} ${enchantments[b]['lvl'].value}`;
                            }
                        }
                        invEmbed.addField('\u200B', invField, true);
                    }
                    /*if(inventory[i]['tag'].value['Damage'] !== undefined) {
                        damage = inventory[i]['tag'].value['Damage'].value;
                        if(inventory[i]['tag'].value['Enchantments'] !== undefined) {
                            invField += '\n**Damage:** ' + damage;
                        } else {
                            invField += `\n**Slot ${slot}: ${id.split('minecraft:').pop()}**\n**Damage:** ${damage}`;
                        }
                        invEmbed.addField('\u200B', invField, true);
                    }*/
                }
                const itemImgName = id.split('minecraft:').pop();

                if(slot <= 8 && slot >= 1) {slotDim[0] += 36}

                if(slot === 9) {slotDim[0] = 16; slotDim[1] = 168}
                if (slot <= 17 && slot >= 10) {slotDim[0] += 36}

                if(slot === 18) {slotDim[0] = 16; slotDim[1] = 204}
                if(slot <= 26 && slot >= 19) {slotDim[0] += 36}

                if(slot === 27) {slotDim[0] = 16; slotDim[1] = 240}
                if(slot <= 35 && slot >= 28) {slotDim[0] += 36}

                if(slot === 100) {slotDim[0] = 16; slotDim[1] = 124}
                if(slot === 101) {slotDim[0] = 16; slotDim[1] = 88}
                if(slot === 102) {slotDim[0] = 16; slotDim[1] = 52}
                if(slot === 103) {slotDim[0] = 16; slotDim[1] = 16}
                if(slot === -106) {slotDim[0] = 154; slotDim[1] = 124}

                try {
                    const itemImg = await Canvas.loadImage(`./images/${itemImgName}.png`);
                    ctx.drawImage(itemImg, 0, 0, 80, 80, slotDim[0], slotDim[1], 32, 32);
                    if(count > 1) {ctx.font = '14px Minecraft Regular'; ctx.fillStyle = '#ffffff'; ctx.fillText(count, slotDim[0], slotDim[1] + 32, 15)}
                } catch (err) {
                    console.log('Error trying to apply img: ' + id + ' Applying text...');
                    ctx.font = '6px Minecraft Regular';
                    ctx.fillStyle = '#000000';
                    ctx.fillText(itemImgName, slotDim[0], slotDim[1] + 16);
                    if(count > 1) {ctx.font = '14px Minecraft Regular'; ctx.fillStyle = '#ffffff'; ctx.fillText(count, slotDim[0], slotDim[1] + 32, 15)}
                }
                //invMsg = invMsg += 'Slot: ' + inventory[i]['Slot'].value + ': ' + inventory[i]['id'].value + ', ' + inventory[i]['Count'].value + '\n'
            }
            const invImg = new Discord.MessageAttachment(invCanvas.toBuffer(), 'inventoryImage.png');
            message.reply("Here's the inventory of **" + taggedName + '**:\n', invImg).then(() => {
                if(invEmbed.fields.length >= 1) {
                    message.reply(invEmbed);
                }
            })
        });
	}
}