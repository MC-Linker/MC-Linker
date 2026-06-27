import Canvas from 'skia-canvas';
import Discord, { ButtonStyle } from 'discord.js';
import { addPh, getComponent, getEmbed, setCachedFooter } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import Pagination from '../../structures/helpers/Pagination.js';
import {
    getLivePlayerNbt,
    getMinecraftAvatarURL,
    getMinecraftData,
    stringifyMinecraftJson,
} from '../../utilities/utils.js';
import ContainerRenderer from '../../structures/render/ContainerRenderer.js';

export default class Inventory extends Command {

    _armorSlotNames = {
        5: keys.commands.inventory.slots.head,
        6: keys.commands.inventory.slots.chest,
        7: keys.commands.inventory.slots.legs,
        8: keys.commands.inventory.slots.feet,
        45: keys.commands.inventory.slots.offhand,
    };

    constructor() {
        super({
            name: 'inventory',
            requiresUserIndex: 0,
            category: 'main',
        });
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[UserResponse, boolean]} args - [0] The resolved user, [1] Whether to show item details.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const mcData = getMinecraftData(server.version);
        /** @type {UserResponse} */
        const user = args[0];
        const showDetails = args[1];

        const playerDataResult = await getLivePlayerNbt(server, user, interaction);
        if(!playerDataResult) return;

        const playerData = playerDataResult.data;
        const isCached = playerDataResult.cached;

        //Convert slots to network slots
        playerData.Inventory = playerData.Inventory.map(item => {
            return {
                ...item,
                slot: this.dataSlotToNetworkSlot(item.Slot ?? item.slot),
                count: item.Count ?? item.count,
            };
        });

        const renderer = new ContainerRenderer(server.version, interaction);

        const itemButtons = [];
        const {
            canvas: invCanvas,
            ctx,
        } = await renderer.renderInventory(playerData.Inventory, {
            loopCode: showDetails ? this.pushInvButton.bind(this, itemButtons, 44, true, mcData) : undefined,
            mcData,
            logger,
        });

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
        const invEmbed = getEmbed(keys.commands.inventory.success.final, { username: user.username });
        if(isCached) setCachedFooter(invEmbed);
        // Send without buttons if showDetails is false
        if(!showDetails) return await interaction.editReply({ files: [invAttach], embeds: [invEmbed] });

        const paginationPages = await this.getInventoryPages(itemButtons, playerData.Inventory, user.username, invEmbed, invAttach, mcData, renderer, logger);
        const pagination = new Pagination(client, interaction, paginationPages, {
            showStartPageOnce: true,
            highlightSelectedButton: ButtonStyle.Primary,
            timeout: 60000 * 5, // 5 minutes
        });
        await pagination.start();
    }

    /**
     * Pushes a button for an inventory item. Bound with leading args via `.bind(this, ...)`.
     * @param {Discord.ButtonBuilder[]} buttons - Accumulator the new button is pushed onto.
     * @param {number} maxSlot - Items in slots above this are skipped.
     * @param {boolean} doUseArmorSlots - Whether to label armor slots by name instead of index.
     * @param {import('minecraft-data').IndexedData} mcData - Minecraft data for the server version.
     * @param {object} item - The inventory item to build a button for.
     * @param {number} index - The item's index within its container.
     */
    pushInvButton(buttons, maxSlot, doUseArmorSlots, mcData, item, index) {
        if(item.slot > maxSlot) return;

        //Push button for each item in the inventory
        const itemId = item.id.split(':').pop();
        const slot = item.slot;
        const armorSlotNames = this._armorSlotNames;
        buttons.push(getComponent(
            keys.commands.inventory.success.item_button,
            {
                slot: doUseArmorSlots && armorSlotNames[slot] ? armorSlotNames[slot] : `#${slot}`,
                index: item.parentIndex ? `${item.parentIndex}_${index}` : index,
                name: mcData.itemsByName[itemId]?.displayName ?? itemId,
            },
        ));
    }

    addInfo(embed, tag, itemStats, mcData) {
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
            const enchantments = tag['minecraft:enchantments'] ?? tag['minecraft:stored_enchantments']?.levels ?? tag.Enchantments ?? tag.StoredEnchantments;

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
                'infestation': `- ${mcData.effectsByName['Infested']?.displayName ?? 'Infested'} (3:00)`,
                'oozing': `- ${mcData.effectsByName['Oozing']?.displayName ?? 'Oozing'} (3:00)`,
                'weaving': `- ${mcData.effectsByName['Weaving']?.displayName ?? 'Weaving'} (3:00)`,
                'wind_charging': `- ${mcData.effectsByName['WindCharged']?.displayName ?? 'Wind Charged'} (3:00)`,
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

    /**
     * Constructs pagination pages for the specified inventory and buttons
     * @param {Discord.ButtonBuilder[]} inventoryButtons - The buttons to use for each item in the inventory
     * @param {Object} inventory - The inventory nbt data to use
     * @param {string} username - The username of the player
     * @param {Discord.EmbedBuilder} embed - The embed to use for each of the pages
     * @param {Discord.AttachmentBuilder} attach - The attachment to use for each of the pages
     * @param {import('minecraft-data').IndexedData} mcData - The minecraft data for the server version
     * @param {ContainerRenderer} renderer - The container renderer (holds prepared assets + slot coords).
     * @param {import('../../utilities/logger/Logger.js').default} [logger] - Per-execution child logger.
     * @returns {Promise<PaginationPages>}
     */
    async getInventoryPages(inventoryButtons, inventory, username, embed, attach, mcData, renderer, logger = null) {
        const armorSlotCoords = renderer.armorSlotCoords;
        const armorSlotNames = this._armorSlotNames;
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
                item = item.components?.['minecraft:container']?.[i].item ?? item.tag.BlockEntityTag.Items[i];
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
                    avatar: await getMinecraftAvatarURL(username),
                },
            );
            const isSpecialItem = this.addInfo(itemEmbed, item.components ?? item.tag, itemStats, mcData);

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
                        ...(item.item ?? item),
                        parentIndex: buttonId.split(/slot_?/).pop(),
                        slot: item.Slot ?? item.slot,
                        count: item.item?.count ?? item.Count,
                    };
                });

                //Shulker Items + Inventory
                const allItems = mappedShulkerItems.concat(mappedInvItems);

                const shulkerButtons = []; //Clear previous buttons
                const { canvas: shulkerImage } = await renderer.renderShulker(allItems, {
                    loopCode: this.pushInvButton.bind(this, shulkerButtons, 26, false, mcData),
                    mcData,
                    logger,
                });

                const shulkerAttach = new Discord.AttachmentBuilder(
                    await shulkerImage.toBuffer('png'),
                    { name: `Shulker_Contents.png`, description: keys.commands.inventory.shulker_description },
                );
                const shulkerEmbed = getEmbed(keys.commands.inventory.success.final_shulker, { username });

                paginationPages[buttonId] = {
                    button,
                    pages: {
                        ...await this.getInventoryPages(
                            shulkerButtons,
                            inventory,
                            username,
                            shulkerEmbed,
                            shulkerAttach,
                            mcData,
                            renderer,
                            logger,
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
