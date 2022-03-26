const utils = require('../../api/utils');
const nbt = require('nbt');
const fs = require('fs');
const ftp = require('../../api/ftp');
const Canvas = require('canvas');
const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const fetch = require('node-fetch');

module.exports = {
    name: 'inventory',
    aliases: ['inv', 'inventories'],
    usage: 'inventory <mention/username>',
    example: '/inventory @Lianecx',
    description: 'Get an image of the current player\'s inventory.',
    data: new SlashCommandBuilder()
            .setName('inventory')
            .setDescription('Get an image of the current player\'s inventory.')
            .addUserOption(option =>
                option.setName('user')
                .setDescription('Set the user you want to get the inventory from.')
                .setRequired(true)
            ),
    async execute(message, args) {
        const username = message.mentions.users.first()?.tag ?? args[0];
        if(!username) {
            console.log(`${message.member.user.tag} executed /inv without username in ${message.guild.name}`);
            message.reply(':warning: Please specify the player.');
            return;
        }

        console.log(`${message.member.user.tag} executed /inv ${username} in ${message.guild.name}`);

        const uuidv4 = await utils.getUUIDv4(args[0], message.mentions.users.first()?.id, message);
        if(!uuidv4) return;

        const worldPath = await utils.getWorldPath(message.guildId, message);
        if(!worldPath) return;

        const nbtFile = await ftp.get(`${worldPath}/playerdata/${uuidv4}.dat`, `./userdata/playernbt/${uuidv4}.dat`, message);
        if(!nbtFile) return;

        fs.readFile(`./userdata/playernbt/${uuidv4}.dat`, (err, playerNBT) => {
            if(err) {
                message.reply('<:Error:849215023264169985> Could not read inventory.');
				console.log('Error reading nbtFile from disk: ', err);
				return;
            }

            nbt.parse(playerNBT, async (err, playerData) => {
                if (err) {
                    console.log('Error trying to parse player NBT', err);
                    message.reply('<:Error:849215023264169985> Error trying to read inventory');
                    return;
                }

                const inventory = playerData.value['Inventory'].value.value;

                const invCanvas = Canvas.createCanvas(352, 332);
                const ctx = invCanvas.getContext('2d');
                const background = await Canvas.loadImage('./resources/images/other/inventory_blank.png');
                ctx.drawImage(background, 0, 0, invCanvas.width, invCanvas.height);

                Canvas.registerFont('./resources/fonts/Minecraft.ttf', { family: 'Minecraft' });

                let enchantEmbed = new Discord.MessageEmbed()
                    .setAuthor({ name: 'Inventory Enchantments', iconURL: message.client.user.displayAvatarURL({ format: 'png' }) })
                    .setColor('ORANGE');

                let slotDims = [16, 284];

                for(let i = 0; i < inventory.length; i++) {
                    const slot = inventory[i]['Slot'].value;
                    const id = inventory[i].id.value;
                    const itemImgName = id.split(':').pop();
                    const count = inventory[i]['Count'].value;
                    const damage = inventory[i].tag?.value['Damage']?.value;
                    const enchantments = inventory[i].tag?.value['Enchantments']?.value.value;

                    if(enchantments) {
                        const formattedItem = id.toString().replace('minecraft:', '').replaceAll('_', ' ').cap();

                        let invField = `\n**Slot ${slot}: ${formattedItem}:**`;
                        for(const enchantment of enchantments) {
                            const formattedEnchant = enchantment.id.value.replace('minecraft:', '').replaceAll('_', ' ').cap();

                            if(enchantment.lvl.value === 1) {
                                invField += `\n-${formattedEnchant}`
                            } else {
                                invField += `\n-${formattedEnchant} ${enchantment.lvl.value}`;
                            }
                        }
                        enchantEmbed.addField('\u200B', invField, true);
                    }

                    const allSlotDims = {
                        0: [16, 284],
                        1: [52, 284],
                        2: [88, 284],
                        3: [124, 284],
                        4: [160, 284],
                        5: [196, 284],
                        6: [232, 284],
                        7: [268, 284],
                        8: [304, 284],
                        9: [16, 168],
                        10: [52, 168],
                        11: [88, 168],
                        12: [124, 168],
                        13: [160, 168],
                        14: [196, 168],
                        15: [232, 168],
                        16: [268, 168],
                        17: [304, 168],
                        18: [16, 204],
                        19: [52, 204],
                        20: [88, 204],
                        21: [124, 204],
                        22: [160, 204],
                        23: [196, 204],
                        24: [232, 204],
                        25: [268, 204],
                        26: [304, 204],
                        27: [16, 240],
                        28: [52, 240],
                        29: [88, 240],
                        30: [124, 240],
                        31: [160, 240],
                        32: [196, 240],
                        33: [232, 240],
                        34: [268, 240],
                        35: [304, 240],
                        100: [16, 124],
                        101: [16, 88],
                        102: [16, 52],
                        103: [16, 16],
                        "-106": [154, 124],
                    }
                    slotDims = allSlotDims[slot];

                    try {
                        const itemImg = await Canvas.loadImage(`./resources/images/minecraft/items/${itemImgName}.png`);
                        ctx.drawImage(itemImg, 0, 0, 80, 80, slotDims[0], slotDims[1], 32, 32);

                        if(count > 1) {
                            ctx.font = '14px Minecraft';
                            ctx.fillStyle = '#ffffff';
                            ctx.fillText(count, slotDims[0], slotDims[1] + 32, 15);
                        }
                    } catch (err) {
                        console.log(`Error trying to apply img: ${id}. Applying text...`);
                        ctx.font = '6px Minecraft'; ctx.fillStyle = '#000000';
                        ctx.fillText(itemImgName, slotDims[0], slotDims[1] + 16);
                        if(count > 1) {
                            ctx.font = '14px Minecraft'; ctx.fillStyle = '#ffffff';
                            ctx.fillText(count, slotDims[0], slotDims[1] + 32, 15);
                        }
                    }

                    if(damage) {
                        const durabilityJson = fs.readFileSync('./resources/data/durability.json', 'utf-8');

                        const durabilityData = JSON.parse(durabilityJson);
                        const maxDurability = durabilityData[itemImgName];

                        if(maxDurability) {
                            const durabilityPercent = 100-(damage / maxDurability * 100);
                            const durabilityPx = Math.floor(durabilityPercent / 100 * 34);

                            const r = Math.floor((100 - durabilityPercent)*2.56);
                            const g = Math.floor(durabilityPercent*2.56);
                            const rgb = [r, g, 0];

                            ctx.strokeStyle = `rgb(${rgb.join(',')})`; ctx.fillStyle = `rgb(${rgb.join(',')})`; ctx.lineWidth = 3;
                            ctx.beginPath();
                            ctx.moveTo(slotDims[0], slotDims[1] + 28);
                            ctx.lineTo(slotDims[0] + durabilityPx, slotDims[1] + 28);
                            ctx.stroke();
                            ctx.closePath();

                            ctx.strokeStyle = `#000000`; ctx.fillStyle = `#000000`; ctx.lineWidth = 3;
                            ctx.beginPath();
                            ctx.moveTo(slotDims[0], slotDims[1] + 31);
                            ctx.lineTo(slotDims[0] + 33, slotDims[1] + 31);
                            ctx.stroke();
                            ctx.closePath();
                        }
                    }
                }

                const skinJson = await fetch(`https://minecraft-api.com/api/skins/${uuidv4}/body/10.5/10/json`);
                const { skin: skinBase64 } = await skinJson.json();
                const skinImg = await Canvas.loadImage(`data:image/png;base64, ${skinBase64}`);
                ctx.drawImage(skinImg, 70, 20, 65, 131);

                const invImg = new Discord.MessageAttachment(invCanvas.toBuffer(), `Inventory_Player.png`);
                const invEmbed = new Discord.MessageEmbed()
                    .setTitle("Minecraft Player Inventory")
                    .setDescription(`<:Checkmark:849224496232660992> Here's the inventory of **${username}**:\n`)
                    .setImage(`attachment://Inventory_Player.png`);

                if(enchantEmbed.fields.length >= 1) message.reply({ files: [invImg], embeds: [invEmbed, enchantEmbed] });
                else message.reply({ files: [invImg], embeds: [invEmbed] });
            });
        });
	}
}