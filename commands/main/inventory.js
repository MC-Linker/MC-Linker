const utils = require('../../api/utils');
const nbt = require('nbt');
const fs = require('fs-extra');
const ftp = require('../../api/ftp');
const Canvas = require('canvas');
const Discord = require('discord.js');
const fetch = require('node-fetch');
const { keys, addPh, getEmbedBuilder, ph } = require('../../api/messages');

async function execute(message, args) {
    const user = message.mentions.users.first() ?? args[0];
    if(!user) {
        message.respond(keys.commands.inventory.warnings.no_username);
        return;
    }

    const uuidv4 = await utils.getUUIDv4(user, message);
    if(!uuidv4) return;

    const worldPath = await utils.getWorldPath(message.guildId, message);
    if(!worldPath) return;

    const nbtFile = await ftp.get(`${worldPath}/playerdata/${uuidv4}.dat`, `./userdata/playernbt/${uuidv4}.dat`, message);
    if(!nbtFile) return;

    fs.readFile(`./userdata/playernbt/${uuidv4}.dat`, (err, playerNBT) => {
        if(err) {
            message.respond(keys.commands.inventory.errors.could_not_read_file, ph.fromError(err));
            return;
        }

        nbt.parse(playerNBT, async (err, playerData) => {
            if (err) {
                message.respond(keys.commands.inventory.errors.could_not_parse, ph.fromError(err));
                return;
            }

            const inventory = playerData.value['Inventory'].value.value;

            const invCanvas = Canvas.createCanvas(352, 332);
            const ctx = invCanvas.getContext('2d');
            const background = await Canvas.loadImage('./resources/images/other/inventory_blank.png');
            ctx.drawImage(background, 0, 0, invCanvas.width, invCanvas.height);

            Canvas.registerFont('./resources/fonts/Minecraft.ttf', { family: 'Minecraft' });

            let enchantEmbed = new Discord.MessageEmbed()
                .setTitle(keys.commands.inventory.success.enchantments.title)
                .setColor(keys.commands.inventory.success.enchantments.color);

            let slotDims = [16, 284];

            for(let i = 0; i < inventory.length; i++) {
                const slot = inventory[i]['Slot'].value;
                const id = inventory[i].id.value;
                const itemImgName = id.split(':').pop();
                const count = inventory[i]['Count'].value;
                const damage = inventory[i].tag?.value['Damage']?.value;
                const enchantments = inventory[i].tag?.value['Enchantments']?.value.value;

                if(enchantments) {
                    const formattedItem = id.replace('minecraft:', '').replaceAll('_', ' ').cap();

                    let invField = `\n${addPh(
                        keys.commands.inventory.success.enchantments.fields.enchantment.content_slot,
                        { "item_name": formattedItem, "slot": slot }
                    )}`;

                    for(const enchantment of enchantments) {
                        const formattedEnchant = enchantment.id.value.replace('minecraft:', '').replaceAll('_', ' ').cap();

                         invField += `\n${addPh(
                             keys.commands.inventory.success.enchantments.fields.enchantment.content_enchantment, 
                             { "enchantment_name": formattedEnchant, "enchantment_level": enchantment.lvl.value }
                         )}`;
                    }

                    enchantEmbed.addField(
                        keys.commands.inventory.success.enchantments.fields.enchantment.title,
                        invField,
                        keys.commands.inventory.success.enchantments.fields.enchantment.inline
                    );
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
                };
                slotDims = allSlotDims[slot];

                try {
                    //Draw image
                    const itemImg = await Canvas.loadImage(`./resources/images/minecraft/items/${itemImgName}.png`);
                    ctx.drawImage(itemImg, 0, 0, 80, 80, slotDims[0], slotDims[1], 32, 32);
                } catch (err) {
                    //Draw name
                    console.log(addPh(keys.commands.inventory.errors.no_image.console, { "item_name": itemImgName }));
                    ctx.font = '6px Minecraft'; ctx.fillStyle = '#000000';
                    ctx.fillText(itemImgName, slotDims[0], slotDims[1] + 16);
                }

                //Draw count
                if(count > 1) {
                    ctx.font = '14px Minecraft'; ctx.fillStyle = '#ffffff';
                    ctx.fillText(count, slotDims[0], slotDims[1] + 32, 15);
                }

                if(damage) {
                    const durabilityJson = await fs.readFile('./resources/data/durability.json', 'utf-8');

                    const durabilityData = JSON.parse(durabilityJson);
                    const maxDurability = durabilityData[itemImgName];

                    if(maxDurability) {
                        const durabilityPercent = 100-damage / maxDurability * 100;
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
            const invEmbed = getEmbedBuilder(keys.commands.inventory.success.final, ph.fromStd(message), { username: user });

            if(enchantEmbed.fields.length >= 1) message.replyOptions({ files: [invImg], embeds: [invEmbed, enchantEmbed] });
            else message.replyOptions({ files: [invImg], embeds: [invEmbed] });
        });
    });
}

module.exports = { execute };