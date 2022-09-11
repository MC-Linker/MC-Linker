const utils = require('../../api/utils');
const nbt = require('prismarine-nbt');
const Canvas = require('@napi-rs/canvas');
const Discord = require('discord.js');
const fetch = require('node-fetch');
const mcData = require('minecraft-data')('1.19.2');
const { keys, addPh, getEmbed, ph, getComponent, createActionRows } = require('../../api/messages');

const armorSlotCoords = {
    5: [16, 16],
    6: [16, 52],
    7: [16, 88],
    8: [16, 124],
    45: [154, 124],
};
const mainInvSlotCoords = {
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
};
const hotbarSlotCoords = {
    36: [16, 284],
    37: [52, 284],
    38: [88, 284],
    39: [124, 284],
    40: [160, 284],
    41: [196, 284],
    42: [232, 284],
    43: [268, 284],
    44: [304, 284],
};

//Construct shulkerSlotCoords from player inventory
const shulkerSlotCoords = Object.assign(
    //Move mainInvSlotCoords up by 132 and decrease slot number by 9
    Object.fromEntries(Object.entries(mainInvSlotCoords)
        .map(([slot, [x, y]]) => [slot - 9, [x, y - 132]])),
    //Increase slot numbers by 18
    Object.fromEntries(Object.entries(Object.assign({}, mainInvSlotCoords, hotbarSlotCoords))
        .map(([slot, [x, y]]) => [+slot + 18, [x, y]])),
);

const armorSlotNames = {
    5: keys.commands.inventory.slots.head,
    6: keys.commands.inventory.slots.chest,
    7: keys.commands.inventory.slots.legs,
    8: keys.commands.inventory.slots.feet,
    45: keys.commands.inventory.slots.offhand,
};

async function execute(message, args) {
    const user = message.mentions.users.first() ?? args[0];
    const showDetails = typeof args[1] === 'boolean' ? args[1] : args[1]?.toLowerCase() === 'true';
    if(!user) {
        message.respond(keys.commands.inventory.warnings.no_username);
        return;
    }

    const uuid = await utils.getUUID(user, message.guildId, message);
    if(!uuid) return;

    const worldPath = await utils.getWorldPath(message.guildId, message);
    if(!worldPath) return;

    const nbtFile = await ftp.get(`${worldPath}/playerdata/${uuid}.dat`, `./userdata/playernbt/${uuid}.dat`, message.guildId, message);
    if(!nbtFile) return;

    let playerData;
    try {
        playerData = await nbt.parse(nbtFile, 'big');
        playerData = nbt.simplify(playerData.parsed);
    }
    catch(err) {
        message.respond(keys.commands.inventory.errors.could_not_parse, ph.error(err));
        return;
    }

    //Convert slots to network slots
    playerData.Inventory = playerData.Inventory.map(item => {
        return {
            ...item,
            Slot: dataSlotToNetworkSlot(item.Slot),
        };
    });

    const itemButtons = [];
    const {
        canvas: invCanvas,
        ctx,
    } = await renderContainer(
        './resources/images/other/inventory_blank.png',
        playerData.Inventory,
        Object.assign({}, mainInvSlotCoords, armorSlotCoords, hotbarSlotCoords),
        showDetails ? pushInvButton.bind(null, itemButtons) : () => {}, //Push itemButtons if showDetails is set to true
    );

    //Draw skin in inventory
    const skinJson = await fetch(`https://minecraft-api.com/api/skins/${uuid}/body/10.5/10/json`);
    const { skin: skinBase64 } = await skinJson.json();
    const skinImg = await Canvas.loadImage(`data:image/png;base64, ${skinBase64}`);
    ctx.drawImage(skinImg, 70, 20, 65, 131);

    const invAttach = new Discord.AttachmentBuilder(
        invCanvas.toBuffer('image/png'),
        { name: `Inventory_Player.png`, description: keys.commands.inventory.inventory_description },
    );
    const invEmbed = getEmbed(keys.commands.inventory.success.final, ph.std(message), { username: user });

    const replyOptions = {
        files: [invAttach],
        embeds: [invEmbed],
        components: getComponentOption(
            itemButtons,
            getComponent(keys.commands.inventory.success.next_button, { id: 'slot_next' }),
        ),
    };

    const invMessage = await message.replyOptions(replyOptions);

    //Create component collector for slot buttons
    const collector = invMessage.createMessageComponentCollector({
        componentType: Discord.ComponentType.Button,
        time: 120_000,
    });

    let shulkerButtons = [];
    collector.on('collect', async button => {
        const buttonId = button.customId;
        if(!buttonId.startsWith('slot')) return;

        if(button.user.id !== message.member.user.id) {
            const notAuthorEmbed = getEmbed(keys.commands.inventory.warnings.not_author_button, ph.emojis());
            button.reply({ embeds: [notAuthorEmbed], ephemeral: true });
            return;
        }
        if(buttonId === 'slot_next' || buttonId === 'slot_next_shulker') {
            const backButton = getComponent(
                keys.commands.inventory.success.back_button,
                { id: buttonId === 'slot_next' ? 'slot_back' : 'slot_back_shulker' },
            );
            const replyButtons = buttonId === 'slot_next' ? itemButtons.slice(24) : shulkerButtons.slice(24);
            replyButtons.push(backButton);
            button.update({ components: createActionRows(replyButtons) });
            return;
        }
        else if(buttonId === 'slot_back' || buttonId === 'slot_back_shulker') {
            const replyComponents = getComponentOption(
                buttonId === 'slot_back' ? itemButtons : shulkerButtons,
                getComponent(keys.commands.inventory.success.next_button, { id: buttonId === 'slot_back' ? 'slot_next' : 'slot_next_shulker' }),
            );

            const replyOptions = { components: replyComponents };

            //When going back from shulker to inventory, reset image
            if(buttonId === 'slot_back' && button.message.embeds[0]?.image.url.endsWith('Shulker_Contents.png')) {
                invEmbed.setImage('attachment://Inventory_Player.png');
                replyOptions.embeds = [invEmbed];
                replyOptions.files = [invAttach];
            }
            button.update(replyOptions);
            return;
        }

        const index = parseInt(buttonId.split('_').pop());
        let item = playerData.Inventory[index];
        //If item is a shulker, get item from shulker inventory
        if(buttonId.includes('_shulker_')) {
            const shulkerIndex = parseInt(buttonId.split('_')[2]);
            item = item.tag.BlockEntityTag.Items[shulkerIndex];
        }

        const formattedId = item.id.split(':').pop();
        const slot = item.Slot;
        const itemStats = mcData.itemsByName[formattedId];

        const username = user instanceof Discord.User ? await utils.getUsername(user.id) : user;
        const itemEmbed = getEmbed(
            keys.commands.inventory.success.item,
            {
                slot_name: armorSlotNames[slot] ?? addPh(keys.commands.inventory.slots.default, { slot }),
                name: itemStats?.displayName ?? formattedId,
                id: item.id,
                count: item.Count,
                max_count: itemStats?.stackSize ?? 64,
                username,
                avatar: `https://minotar.net/helm/${username}/64.png`,
            },
            ph.emojis(),
        );
        addInfo(itemEmbed, item.tag, itemStats);

        if(item.tag?.BlockEntityTag?.Items) {
            //Increase slot numbers by 18 in inventory
            const mappedInvItems = playerData.Inventory.map(item => {
                if(armorSlotCoords[item.Slot]) return; //Exclude armor slots
                return {
                    ...item,
                    Slot: item.Slot + 18,
                };
            }).filter(i => i); //Remove undefined items

            //Add parentIndex to shulker items to add in customId on buttons
            const mappedShulkerItems = item.tag.BlockEntityTag.Items.map(item => {
                return {
                    ...item,
                    parentIndex: index,
                };
            });

            //Shulker Items + Inventory
            const allItems = mappedShulkerItems.concat(mappedInvItems);

            shulkerButtons = []; //Clear previous buttons
            const { canvas: shulkerImage } = await renderContainer(
                './resources/images/other/shulker_blank.png',
                allItems,
                shulkerSlotCoords,
                pushShulkerButton.bind(null, shulkerButtons),
            );

            //Push to 24th slot if more than 25 items to make sure both back and next buttons are sent
            shulkerButtons.splice(
                shulkerButtons.length > 25 ? 23 : 24,
                0,
                getComponent(keys.commands.inventory.success.back_button, { id: 'slot_back' }),
            );

            const shulkerAttach = new Discord.AttachmentBuilder(
                shulkerImage.toBuffer('image/png'),
                { name: `Shulker_Contents.png`, description: keys.commands.inventory.shulker_description },
            );

            invEmbed.setImage('attachment://Shulker_Contents.png');
            button.update({
                embeds: [invEmbed],
                files: [shulkerAttach],
                components: getComponentOption(
                    shulkerButtons,
                    getComponent(keys.commands.inventory.success.next_button, { id: 'slot_next_shulker' }),
                ),
            });
        }
        else if(buttonId.includes('_shulker_')) {
            button.update({ embeds: [invEmbed, itemEmbed] });
        }
        else if(button.message.embeds[0]?.image.url.endsWith('Shulker_Contents.png')) {
            invEmbed.setImage('attachment://Inventory_Player.png');
            button.update(replyOptions);
        }
        else {
            button.update({ embeds: [invEmbed, itemEmbed] });
        }
    });
}

async function renderContainer(backgroundPath, items, slotCoords, loopCode = (item, index) => {}) {
    const canvas = Canvas.createCanvas(352, 332);
    const ctx = canvas.getContext('2d');
    const background = await Canvas.loadImage(backgroundPath);
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    for(let i = 0; i < items.length; i++) {
        const slot = items[i].Slot;
        const itemId = items[i].id.split(':').pop();
        const count = items[i].Count;
        const damage = items[i].tag?.Damage;

        const [x, y] = slotCoords[slot] ?? [];
        if(!x || !y) continue; //Continue for modded slots

        try {
            //Draw image
            const itemImg = await Canvas.loadImage(`./resources/images/minecraft/items/${itemId}.png`);
            ctx.drawImage(itemImg, 0, 0, 80, 80, x, y, 32, 32);
        }
        catch(err) {
            //Draw name
            console.log(addPh(keys.commands.inventory.errors.no_image.console, { 'item_name': itemId }));
            ctx.font = '6px Minecraft';
            ctx.fillStyle = '#000';
            ctx.fillText(itemId, x, y + 16);
        }

        //Draw count
        if(count > 1) {
            ctx.font = '14px Minecraft';
            ctx.fillStyle = '#fff';
            ctx.fillText(count.toString(), x, y + 32);
        }

        const maxDurability = mcData.itemsByName[itemId]?.maxDurability;
        if(damage && maxDurability) {
            const durabilityPercent = 100 - damage / maxDurability * 100;
            const durabilityPx = Math.floor(durabilityPercent / 100 * 34);

            //Get gradient color between green and red
            const r = Math.floor((100 - durabilityPercent) * 2.56);
            const g = Math.floor(durabilityPercent * 2.56);
            const rgb = [r, g, 0];

            //Draw durability bar
            ctx.strokeStyle = `rgb(${rgb.join(',')})`;
            ctx.fillStyle = `rgb(${rgb.join(',')})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y + 28);
            ctx.lineTo(x + durabilityPx, y + 28);
            ctx.stroke();
            ctx.closePath();

            ctx.strokeStyle = `#000000`;
            ctx.fillStyle = `#000000`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y + 31);
            ctx.lineTo(x + 33, y + 31);
            ctx.stroke();
            ctx.closePath();
        }

        loopCode(items[i], i);
    }

    return { canvas, ctx };
}

function addInfo(embed, tag, itemStats) {
    //Add durability info
    if(tag?.Damage && itemStats?.maxDurability) {
        embed.addFields(addPh(
            keys.commands.inventory.success.item_durability.embeds[0].fields,
            {
                durability: itemStats.maxDurability - tag.Damage,
                max_durability: itemStats.maxDurability,
            },
        ));
    }

    //Add lore info
    if(tag?.display?.Lore) {
        embed.addFields(addPh(
            keys.commands.inventory.success.item_lore.embeds[0].fields,
            { lore: tag.display.Lore },
        ));
    }

    //Add custom name info
    if(tag?.display?.Name) {
        embed.addFields(addPh(
            keys.commands.inventory.success.item_custom_name.embeds[0].fields,
            { custom_name_json: tag.display.Name, custom_name: JSON.parse(tag.display.Name).text },
        ));
    }

    //Add enchantments info
    if(tag?.Enchantments || tag?.StoredEnchantments) {
        const allEnchantments = tag?.Enchantments ?? tag.StoredEnchantments;
        const formattedEnchantments = allEnchantments.map(ench => {
            return `- ${mcData.enchantmentsByName[ench.id.split(':').pop()]?.displayName ?? ench.id} ${romanNumber(ench.lvl)}`;
        }).join('\n');

        embed.addFields(addPh(
            keys.commands.inventory.success.item_enchantments.embeds[0].fields,
            { enchantments: formattedEnchantments },
        ));
    }

    if(tag?.Potion) {
        const effectByPotionName = {
            'fire_resistance': `- ${mcData.effectsByName['FireResistance'].displayName} (3:00)`,
            'long_fire_resistance': `- ${mcData.effectsByName['FireResistance'].displayName} (8:00)`,
            'healing': `- ${mcData.effectsByName['InstantHealth'].displayName}`,
            'strong_healing': `- ${mcData.effectsByName['InstantHealth'].displayName} II`,
            'slow_falling': `- ${mcData.effectsByName['SlowFalling'].displayName} (1:30)`,
            'long_slow_falling': `- ${mcData.effectsByName['SlowFalling'].displayName} (4:00)`,
            'night_vision': `- ${mcData.effectsByName['NightVision'].displayName} (3:00)`,
            'long_night_vision': `- ${mcData.effectsByName['NightVision'].displayName} (8:00)`,
            'regeneration': `- ${mcData.effectsByName['Regeneration'].displayName} (0:45)`,
            'long_regeneration': `- ${mcData.effectsByName['Regeneration'].displayName} (1:30)`,
            'strong_regeneration': `- ${mcData.effectsByName['Regeneration'].displayName} II (0:22)`,
            'swiftness': `- ${mcData.effectsByName['Speed'].displayName} (3:00)`,
            'long_swiftness': `- ${mcData.effectsByName['Speed'].displayName} (8:00)`,
            'strong_swiftness': `- ${mcData.effectsByName['Speed'].displayName} II (1:30)`,
            'leaping': `- ${mcData.effectsByName['JumpBoost'].displayName} (3:00)`,
            'long_leaping': `- ${mcData.effectsByName['JumpBoost'].displayName} (8:00)`,
            'strong_leaping': `- ${mcData.effectsByName['JumpBoost'].displayName} II (1:30)`,
            'strength': `- ${mcData.effectsByName['Strength'].displayName} (3:00)`,
            'long_strength': `- ${mcData.effectsByName['Strength'].displayName} (8:00)`,
            'strong_strength': `- ${mcData.effectsByName['Strength'].displayName} II (1:30)`,
            'invisibility': `- ${mcData.effectsByName['Invisibility'].displayName} (3:00)`,
            'long_invisibility': `- ${mcData.effectsByName['Invisibility'].displayName} (8:00)`,
            'water_breathing': `- ${mcData.effectsByName['WaterBreathing'].displayName} (3:00)`,
            'long_water_breathing': `- ${mcData.effectsByName['WaterBreathing'].displayName} (8:00)`,
            'slowness': `- ${mcData.effectsByName['Slowness'].displayName} (3:00)`,
            'long_slowness': `- ${mcData.effectsByName['Slowness'].displayName} (4:00)`,
            'strong_slowness': `- ${mcData.effectsByName['Slowness'].displayName} IV (0:20)`,
            'harming': `- ${mcData.effectsByName['InstantDamage'].displayName}`,
            'strong_harming': `- ${mcData.effectsByName['InstantDamage'].displayName} II`,
            'weakness': `- ${mcData.effectsByName['Weakness'].displayName} (1:30)`,
            'long_weakness': `- ${mcData.effectsByName['Weakness'].displayName} (4:00)`,
            'poison': `- ${mcData.effectsByName['Poison'].displayName} (0:30)`,
            'long_poison': `- ${mcData.effectsByName['Poison'].displayName} (1:30)`,
            'strong_poison': `- ${mcData.effectsByName['Poison'].displayName} II (0:21)`,
            'turtle_master': `- ${mcData.effectsByName['Slowness'].displayName} IV (0:20)\n- ${mcData.effectsByName['Resistance'].displayName} III (0:20)`,
            'strong_turtle_master': `- ${mcData.effectsByName['Slowness'].displayName} VI (0:20)\n- ${mcData.effectsByName['Resistance'].displayName} IV (0:20)`,
            'long_turtle_master': `- ${mcData.effectsByName['Slowness'].displayName} IV (0:40)\n- ${mcData.effectsByName['Resistance'].displayName} III (0:40)`,
        };

        const formattedEffects = effectByPotionName[tag?.Potion?.split(':').pop()];
        embed.addFields(addPh(
            keys.commands.inventory.success.item_potion.embeds[0].fields,
            { effects: formattedEffects },
        ));
    }
}

function pushInvButton(buttons, item, index) {
    //Push button for each item in the inventory
    const itemId = item.id.split(':').pop();
    const slot = item.Slot;
    buttons.push(getComponent(
        keys.commands.inventory.success.item_button,
        {
            slot: armorSlotNames[slot] ?? `#${slot}`,
            index,
            name: mcData.itemsByName[itemId]?.displayName ?? itemId,
        },
    ));
}

function pushShulkerButton(buttons, item, index) {
    //Push button for each item in the shulker
    const itemId = item.id.split(':').pop();
    if(item.Slot > 26) return; //Only push shulker items

    buttons.push(getComponent(
        keys.commands.inventory.success.item_button,
        {
            slot: `#${item.Slot}`,
            index: `shulker_${index}_${item.parentIndex}`,
            name: mcData.itemsByName[itemId]?.displayName ?? itemId,
        },
    ));
}

function getComponentOption(allButtons, nextButton) {
    if(allButtons.length === 0) return [];

    //Replace last button with next button if more than 25 items
    if(allButtons.length > 25) {
        const replyButtons = allButtons.slice(0, 24);
        replyButtons.push(nextButton);
        return createActionRows(replyButtons);
    }
    else return createActionRows(allButtons.slice(0, 25));
}

function romanNumber(number) {
    //Enchantments don't show level 1
    if(number === 1) return '';

    //Convert integers to roman numbers
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V'];
    return romanNumerals[number - 1] ?? number;
}

//https://gist.github.com/ddevault/459a1691c3dd751db160
function dataSlotToNetworkSlot(index) {
    if(index === 100)
        index = 8;
    else if(index === 101)
        index = 7;
    else if(index === 102)
        index = 6;
    else if(index === 103)
        index = 5;
    else if(index === -106)
        index = 45;
    else if(index <= 8)
        index += 36;
    else if(index >= 80 && index <= 83)
        index -= 79;
    return index;
}

module.exports = { execute };