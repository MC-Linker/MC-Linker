import Canvas from 'skia-canvas';
import Discord, { ButtonStyle } from 'discord.js';
import MinecraftData from 'minecraft-data';
import { addPh, getComponent, getEmbed, ph } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import Pagination from '../../structures/helpers/Pagination.js';
import {
    drawMinecraftNumber,
    getLivePlayerNbt,
    MinecraftDataVersion,
    stringifyMinecraftJson,
    wrapText,
} from '../../utilities/utils.js';
import potionColors from '../../resources/data/potion_colors.json' with { type: 'json' };
import logger from '../../utilities/logger.js';

const mcData = MinecraftData(MinecraftDataVersion);

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

export default class Inventory extends Command {

    constructor() {
        super({
            name: 'inventory',
            requiresUserIndex: 0,
            category: 'main',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        /** @type {UserResponse} */
        const user = args[0];
        const showDetails = args[1];

        const playerData = await getLivePlayerNbt(server, user, interaction);
        if(!playerData) return;

        //Convert slots to network slots
        playerData.Inventory = playerData.Inventory.map(item => {
            return {
                ...item,
                slot: this.dataSlotToNetworkSlot(item.Slot ?? item.slot),
            };
        });

        const itemButtons = [];
        const {
            canvas: invCanvas,
            ctx,
        } = await renderContainer(
            './resources/images/containers/inventory_blank.png',
            playerData.Inventory,
            Object.assign({}, mainInvSlotCoords, armorSlotCoords, hotbarSlotCoords),
            showDetails ? this.pushInvButton.bind(null, itemButtons, 44, true) : () => {
            }, //Push itemButtons if showDetails is set to true
        );

        async function getSkin(uuidOrUsername) {
            const skinJson = await fetch(`https://minecraft-api.com/api/skins/${uuidOrUsername}/body/10.5/10/json`);
            const { skin } = await skinJson.json();
            const image = await Canvas.loadImage(`data:image/png;base64, ${skin}`);
            //check dimensions of skinImg
            if(image.width !== 195 || image.height !== 393) return await getSkin('MHF_Steve');
            return image;
        }

        const skinImg = await getSkin(server.online ? user.uuid : user.username);
        ctx.drawImage(skinImg, 70, 20, 65, 131);

        const invAttach = new Discord.AttachmentBuilder(
            await invCanvas.toBuffer('png'),
            { name: 'Inventory_Player.png', description: keys.commands.inventory.inventory_description },
        );
        const invEmbed = getEmbed(keys.commands.inventory.success.final, ph.emojisAndColors(), { username: user.username });
        // Send without buttons if showDetails is false
        if(!showDetails) return await interaction.replyOptions({ files: [invAttach], embeds: [invEmbed] });

        const paginationPages = await this.getInventoryPages(itemButtons, playerData.Inventory, user.username, invEmbed, invAttach);
        const pagination = new Pagination(client, interaction, paginationPages, {
            showStartPageOnce: true,
            highlightSelectedButton: ButtonStyle.Primary,
            timeout: 60000 * 5, // 5 minutes
        });
        await pagination.start();
    }


    addInfo(embed, tag, itemStats) {
        let addedInfo = false;

        if(!tag) return addedInfo;

        //Add durability info
        if((tag['minecraft:damage'] || tag.Damage) && itemStats?.maxDurability) {
            const damage = tag['minecraft:damage'] ?? tag.Damage;

            embed.addFields(addPh(
                keys.commands.inventory.success.item_durability.embeds[0].fields,
                {
                    durability: itemStats.maxDurability - damage,
                    max_durability: itemStats.maxDurability,
                },
            ));

            addedInfo = true;
        }

        //Add lore info
        if(tag['minecraft:lore'] || tag.display?.Lore) {
            const lore = tag['minecraft:lore'] ?? tag.display.Lore;

            embed.addFields(addPh(
                keys.commands.inventory.success.item_lore.embeds[0].fields,
                {
                    lore_json: lore,
                    lore: stringifyMinecraftJson(lore),
                },
            ));

            addedInfo = true;
        }

        //Add custom name info
        if(tag['minecraft:custom_name'] || tag.display?.Name) {
            const customName = tag['minecraft:custom_name'] ?? tag.display.Name;

            embed.addFields(addPh(
                keys.commands.inventory.success.item_custom_name.embeds[0].fields,
                {
                    custom_name_json: customName,
                    custom_name: stringifyMinecraftJson(customName),
                },
            ));

            addedInfo = true;
        }

        //Add enchantments info
        if(tag['minecraft:enchantments'] || tag['minecraft:stored_enchantments'] || tag.Enchantments || tag.StoredEnchantments) {
            const enchantments = tag['minecraft:enchantments']?.levels ?? tag['minecraft:stored_enchantments']?.levels ?? tag.Enchantments ?? tag.StoredEnchantments;

            let formattedEnchantments;
            if(tag['minecraft:enchantments'] || tag['minecraft:stored_enchantments']) {
                formattedEnchantments = Object.entries(enchantments).map(([id, lvl]) => {
                    return `- ${mcData.enchantmentsByName[id.split(':').pop()]?.displayName ?? id} ${this.romanNumber(lvl)}`;
                }).join('\n');
            }
            else {
                formattedEnchantments = enchantments.map(ench => {
                    return `- ${mcData.enchantmentsByName[ench.id.split(':').pop()]?.displayName ?? ench.id} ${this.romanNumber(ench.lvl)}`;
                }).join('\n');
            }

            embed.addFields(addPh(
                keys.commands.inventory.success.item_enchantments.embeds[0].fields,
                { enchantments: formattedEnchantments },
            ));

            addedInfo = true;
        }

        if(tag['minecraft:potion_contents'] || tag?.Potion) {
            const effectByPotionId = {
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
                //TODO replace with mcData
                'infestation': `- Infestation (3:00)`,
                'oozing': `- Oozing (3:00)`,
                'weaving': `- Weaving (3:00)`,
                'wind_charging': `- Wind Charging (3:00)`,
                'mundane': `- No Effects (Mundane)`,
                'thick': `- No Effects (Thick)`,
                'awkward': `- No Effects (Awkward)`,
                'water': `- No Effects (Water)`,
            };

            const potionId = tag['minecraft:potion_contents']?.potion ?? tag.Potion;
            const formattedEffects = effectByPotionId[potionId.split(':').pop()];
            embed.addFields(addPh(
                keys.commands.inventory.success.item_potion.embeds[0].fields,
                { effects: formattedEffects },
            ));

            addedInfo = true;
        }

        return addedInfo;
    }

    pushInvButton(buttons, maxSlot, doUseArmorSlots, item, index) {
        if(item.slot > maxSlot) return;

        //Push button for each item in the inventory
        const itemId = item.id.split(':').pop();
        const slot = item.slot;
        buttons.push(getComponent(
            keys.commands.inventory.success.item_button,
            {
                slot: doUseArmorSlots && armorSlotNames[slot] ? armorSlotNames[slot] : `#${slot}`,
                index: item.parentIndex ? `${item.parentIndex}_${index}` : index,
                name: mcData.itemsByName[itemId]?.displayName ?? itemId,
            },
        ));
    }

    /**
     * Constructs pagination pages for the specified inventory and buttons
     * @param {Discord.ButtonBuilder[]} inventoryButtons - The buttons to use for each item in the inventory
     * @param {Object} inventory - The inventory nbt data to use
     * @param {string} username - The username of the player
     * @param {Discord.EmbedBuilder} embed - The embed to use for each of the pages
     * @param {Discord.AttachmentBuilder} attach - The attachment to use for each of the pages
     * @returns {Promise<PaginationPages>}
     */
    async getInventoryPages(inventoryButtons, inventory, username, embed, attach) {
        /** @type {PaginationPages} */
        const paginationPages = {};

        for(const button of inventoryButtons) {
            const buttonId = button.data.custom_id;

            const index = parseInt(buttonId.match(/\d+/g)[0]); //Match first number in button id

            /** @type {object} */
            let item = inventory[index];
            let indexOfIndex = 0; //Index of the item index in the buttonId

            //If parent item is a shulker, get item from shulker inventory
            const indexes = buttonId.split('_').slice(2);
            for(const i of indexes) {
                item = item.components?.['minecraft:container']?.[i] ?? item.tag.BlockEntityTag.Items[i];
                indexOfIndex++;
            }

            const formattedId = item.id.split(':').pop();
            const slot = item.slot;
            const itemStats = mcData.itemsByName[formattedId];

            const itemEmbed = getEmbed(
                keys.commands.inventory.success.item,
                {
                    slot_name: armorSlotNames[slot] ?? addPh(keys.commands.inventory.slots.default, { slot }),
                    name: itemStats?.displayName ?? formattedId,
                    id: item.id,
                    count: item.count ?? item.Count,
                    max_count: itemStats?.stackSize ?? 64,
                    username: username,
                    avatar: `https://minotar.net/helm/${username}/64.png`,
                },
                ph.emojisAndColors(),
            );
            const isSpecialItem = this.addInfo(itemEmbed, item.components ?? item.tag, itemStats);

            //If item is a shulker, render shulker inventory
            if(formattedId.endsWith('shulker_box') && (item.components?.['minecraft:container'] ?? item.tag?.BlockEntityTag?.Items)) {
                const shulkerItems = item.components?.['minecraft:container'] ?? item.tag.BlockEntityTag.Items;

                //Increase slot numbers by 18 in inventory
                const mappedInvItems = inventory.map(item => {
                    if(armorSlotCoords[item.slot]) return; //Exclude armor slots
                    return {
                        ...item,
                        slot: item.slot + 18,
                    };
                }).filter(i => i); //Remove undefined items

                //Add parentIndex to shulker items to add in customId on buttons
                const mappedShulkerItems = shulkerItems.map(item => {
                    return {
                        ...item,
                        parentIndex: buttonId.split(/slot_?/).pop(),
                        slot: item.Slot ?? item.slot,
                    };
                });

                //Shulker Items + Inventory
                const allItems = mappedShulkerItems.concat(mappedInvItems);

                const shulkerButtons = []; //Clear previous buttons
                const { canvas: shulkerImage } = await renderContainer(
                    './resources/images/containers/shulker_blank.png',
                    allItems,
                    shulkerSlotCoords,
                    this.pushInvButton.bind(null, shulkerButtons, 26, false),
                );

                const shulkerAttach = new Discord.AttachmentBuilder(
                    await shulkerImage.toBuffer('png'),
                    { name: `Shulker_Contents.png`, description: keys.commands.inventory.shulker_description },
                );
                const shulkerEmbed = getEmbed(keys.commands.inventory.success.final_shulker, ph.emojisAndColors(), { username });

                paginationPages[buttonId] = {
                    button,
                    pages: {
                        ...await this.getInventoryPages(
                            shulkerButtons,
                            inventory,
                            username,
                            shulkerEmbed,
                            shulkerAttach,
                        ),
                    },
                };

                //Push shulkerItemEmbed to first page
                if(isSpecialItem) paginationPages[buttonId].pages['slot_start'].options.embeds.push(itemEmbed);
            }
            //Only add page for items that have special info
            else if(isSpecialItem) {
                paginationPages[buttonId] = {
                    button,
                    options: {
                        embeds: [embed, itemEmbed],
                    },
                };
            }
        }
        paginationPages['slot_start'] = {
            startPage: true,
            options: {
                embeds: [embed],
                files: [attach],
            },
        };

        return paginationPages;
    }

    romanNumber(number) {
        //Enchantments don't show level 1
        if(number === 1) return '';

        //Convert integers to roman numbers
        const romanNumerals = ['I', 'II', 'III', 'IV', 'V'];
        return romanNumerals[number - 1] ?? number;
    }

    // https://gist.github.com/ddevault/459a1691c3dd751db160
    dataSlotToNetworkSlot(index) {
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
}

// noinspection JSUnusedLocalSymbols
async function renderContainer(backgroundPath, items, slotCoords, loopCode = (item, index) => {}) {
    const background = await Canvas.loadImage(backgroundPath);
    const canvas = new Canvas.Canvas(background.width, background.height);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    for(let i = 0; i < items.length; i++) {
        const slot = items[i].slot;
        const itemId = items[i].id.split(':').pop();
        const count = items[i].Count;
        const damage = items[i].tag?.Damage;

        const [x, y] = slotCoords[slot] ?? [];
        if(!x || !y) continue; //Continue for modded slots

        drawImage: try {
            if(itemId === 'air') break drawImage;

            let itemImg;
            if(itemId === 'potion' || itemId === 'splash_potion' || itemId === 'lingering_potion') {
                const potionId = items[i].components?.['minecraft:potion_contents']?.potion ?? items[i].tag?.Potion;
                const potionImg = await Canvas.loadImage(`./resources/images/items/${itemId}.png`);
                const potionOverlayImg = await Canvas.loadImage(`./resources/images/items/potion_overlay.png`);
                const potionColor = potionColors[potionId.replace(/(minecraft:)?(long_|strong_)?/, '')] ?? potionColors['uncraftable'];

                const potionCanvas = new Canvas.Canvas(32, 32);
                const potionCtx = potionCanvas.getContext('2d');

                potionCtx.drawImage(potionOverlayImg, 0, 0, 32, 32);

                potionCtx.imageSmoothingEnabled = false;
                potionCtx.globalCompositeOperation = 'multiply';
                potionCtx.fillStyle = potionColor;
                potionCtx.fillRect(0, 0, 32, 32);

                potionCtx.globalCompositeOperation = 'destination-in';
                potionCtx.drawImage(potionOverlayImg, 0, 0, 32, 32);

                potionCtx.globalCompositeOperation = 'source-over';
                potionCtx.drawImage(potionImg, 0, 0, 32, 32);

                itemImg = potionCanvas;
            }
            else itemImg = await Canvas.loadImage(`./resources/images/items/${itemId}.png`);

            ctx.drawImage(itemImg, x, y, 32, 32);
        }
        catch(err) {
            //Draw name
            logger.info(addPh(keys.commands.inventory.errors.no_image.console, { 'item_name': itemId }));
            ctx.font = '8px Minecraft';
            ctx.fillStyle = '#000';
            const lines = wrapText(ctx, mcData.itemsByName[itemId]?.displayName ?? itemId, 32);
            lines.forEach((line, i) => ctx.fillText(line, x, y + 8 + i * 8));
        }

        //Draw count
        if(count > 1) drawMinecraftNumber(ctx, count, x, y + 16, 10, 14);

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
