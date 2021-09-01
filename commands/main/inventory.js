const utils = require('../../utils');
const nbt = require('nbt');
const fs = require('fs');
const ftp = require('../../ftp');
const Canvas = require('canvas');
const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    name: 'inventory',
    aliases: ['inv', 'inventories', 'inventorys'],
    usage: 'inventory <mention/username>',
    example: 'inventory @Lianecx **//** inventory xXgamerkidXx',
    description: "Get an image of the current player's inventory.",
    data: new SlashCommandBuilder()
            .setName('inventory')
            .setDescription('Get an image of the current player\'s inventory.')
            .addUserOption(option =>
                option.setName('user')
                .setDescription('Set the user you want to get the inventory from.')
                .setRequired(true)
            ),
    async execute(message, args) {
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
        console.log(message.member.user.tag + ' executed ^inventories with user: ' + taggedName + ' in ' + message.guild.name);

		const uuidv4 = await utils.getUUIDv4(args[0], message);
        if(uuidv4 === undefined) {
            return;
        }

        const worldPath = await utils.getWorldPath(message);
        if(worldPath === undefined) {
            return;
        }
        const nbtFile = await ftp.get(`${worldPath}/playerdata/${uuidv4}.dat`, `./playernbt/${uuidv4}.dat`, message);
        if(nbtFile === false) {
            return;
        }

		fs.readFile(`./playernbt/${uuidv4}.dat`, (err, playerNBT) => {
            if(err) {
                message.reply('<:Error:849215023264169985> Could not read inventory.');
				console.log('Error reading nbtFile from disk: ', err);
				return;
            }

            nbt.parse(playerNBT, async function(err, playerData) {
                if (err) {
                    console.log('Error trying to parse player NBT', err);
                    message.reply('<:Error:849215023264169985> Error trying to read inventory');
                    return;
                }

                const inventory = playerData.value['Inventory'].value['value']

                const invCanvas = Canvas.createCanvas(352, 332);
                const ctx = invCanvas.getContext('2d');
                const background = await Canvas.loadImage('./images/_other/inventoryBlank.png');
                ctx.drawImage(background, 0, 0, invCanvas.width, invCanvas.height);

                Canvas.registerFont('./fonts/Minecraft.ttf', { family: 'Minecraft' });

                let invEmbed = new Discord.MessageEmbed()
                    .setAuthor('Inventory Enchantments', 'https://cdn.discordapp.com/attachments/844493685244297226/847447724391399474/smp.png')
                    .setColor('ORANGE');

                let slotDim = [16, 284];
                for(let i = 0; i < inventory.length; i++) {
                    const slot = inventory[i]['Slot'].value;
                    const id = inventory[i]['id'].value;
                    const count = inventory[i]['Count'].value;
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
                        if(count > 1) {ctx.font = '14px Minecraft'; ctx.fillStyle = '#ffffff'; ctx.fillText(count, slotDim[0], slotDim[1] + 32, 15)}
                    } catch (err) {
                        console.log('Error trying to apply img: ' + id + ' Applying text...');
                        ctx.font = '6px Minecraft';
                        ctx.fillStyle = '#000000';
                        ctx.fillText(itemImgName, slotDim[0], slotDim[1] + 16);
                        if(count > 1) {ctx.font = '14px Minecraft'; ctx.fillStyle = '#ffffff'; ctx.fillText(count, slotDim[0], slotDim[1] + 32, 15)}
                    }
                    //invMsg = invMsg += 'Slot: ' + inventory[i]['Slot'].value + ': ' + inventory[i]['id'].value + ', ' + inventory[i]['Count'].value + '\n'
                }
                const invImg = new Discord.MessageAttachment(invCanvas.toBuffer(), 'inventoryImage.png');

                if(invEmbed.fields.length >= 1) {
                    message.reply({ content: "<:Checkmark:849224496232660992> Here's the inventory of **" + taggedName + '**:\n', files: [invImg], embeds: [invEmbed] });
                } else {
                    message.reply({ content: "<:Checkmark:849224496232660992> Here's the inventory of **" + taggedName + '**:\n', files: [invImg] }) 
                }
            });
        });


	}
}