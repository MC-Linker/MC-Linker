import * as utils from '../../utilities/utils.js';
import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import { FilePath } from '../../structures/Protocol.js';
import Canvas from 'skia-canvas';
import { addPh, getComponent, getEmbed, ph } from '../../utilities/messages.js';
import minecraft_data from 'minecraft-data';
import Discord from 'discord.js';
import Pagination from '../../structures/helpers/Pagination.js';

const mcData = minecraft_data('1.20.1');

const startCoords = [41, 135];
const yPadding = 7;
const numberPadding = [32, 19];
const maxItemAmountsY = 8;
const headerSize = 80;
const itemSize = 70;
const numberSize = [30, 45];
const itemPadding = (headerSize - itemSize) / 2;

export default class Stats extends Command {

    constructor() {
        super({
            name: 'stats',
            requiresUserIndex: 1,
            category: 'main',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const category = args[0];
        const user = args[1];
        const sorting = args[2] ?? 'descending';

        const argPlaceholder = { 'stat_category': category, 'username': user.username };

        if(server.settings.isDisabled('stats', category)) {
            return interaction.replyTl(keys.commands.stats.no_access.category_disabled, argPlaceholder);
        }

        const statFile = await server.protocol.get(FilePath.Stats(server.worldPath, user.uuid), `./download-cache/stats/${user.uuid}.json`);
        if(!await utils.handleProtocolResponse(statFile, server.protocol, interaction, {
            404: keys.api.command.errors.could_not_download_user_files,
        }, { category: 'stats' })) return;

        let stats;
        try {
            const statData = JSON.parse(statFile.data.toString());
            stats = statData.stats[`minecraft:${category}`];
            if(!stats) return interaction.replyTl(keys.commands.stats.errors.could_not_parse, argPlaceholder);
        }
        catch(err) {
            await interaction.replyTl(keys.commands.stats.errors.could_not_parse, argPlaceholder);
        }

        if(sorting === 'descending')
            stats = Object.fromEntries(Object.entries(stats).sort((a, b) => b[1] - a[1]));
        else if(sorting === 'ascending')
            stats = Object.fromEntries(Object.entries(stats).sort((a, b) => a[1] - b[1]));
        else if(sorting === 'alphabetically')
            stats = Object.fromEntries(Object.entries(stats).sort((a, b) => a[0].localeCompare(b[0])));

        const paginationPages = {};
        const currentItemAmounts = [0, 0];

        async function addStatisticPage(pageNumber = 0, startIndex = 0) {
            const background = await Canvas.loadImage('./resources/images/backgrounds/stats_background.png');
            const statsCanvas = new Canvas.Canvas(background.width, background.height);
            const ctx = statsCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(background, 0, 0, statsCanvas.width, statsCanvas.height);

            if(category === 'custom') {
                //TODO
                return;
            }

            const maxDigitsInColumn = columnIndex => {
                const numbersInColumn = Object.values(stats).slice(columnIndex * maxItemAmountsY, (columnIndex + 1) * maxItemAmountsY);
                if(numbersInColumn.length === 0) return 0;
                return Math.max(...numbersInColumn.map(num => num.toString().length));
            };
            const sizeOfItem = (digits = maxDigitsInColumn(currentItemAmounts[0])) => headerSize + numberPadding[0] * 2 + numberSize[0] * digits;

            let tempColumnIndex = currentItemAmounts[0];
            let sizeOfAllItems = 0;
            while(sizeOfAllItems + startCoords[0] + sizeOfItem(maxDigitsInColumn(tempColumnIndex)) <= statsCanvas.width) {
                if(maxDigitsInColumn(tempColumnIndex) === 0) break;
                sizeOfAllItems += sizeOfItem(maxDigitsInColumn(tempColumnIndex++));
            }

            let x = (statsCanvas.width - sizeOfAllItems) / 2;
            let y = startCoords[1];

            for(let [id, value] of Object.entries(stats).slice(startIndex)) {
                // Break if the next item will go out of bounds
                if(x + sizeOfItem(value.toString().length) >= statsCanvas.width) break;

                id = id.replace('minecraft:', '');

                //Draw header
                const headerImg = await Canvas.loadImage(`./resources/images/statistics/header.png`);
                ctx.drawImage(headerImg, x, y, headerSize, headerSize);

                try {
                    //Draw image
                    let img;
                    if(['killed', 'killed_by'].includes(category)) img = await Canvas.loadImage(`./resources/images/entities/${id}.png`);
                    else img = await Canvas.loadImage(`./resources/images/items/${id}.png`);

                    ctx.drawImage(
                        img,
                        x + itemPadding,
                        y + itemPadding,
                        itemSize, itemSize,
                    );
                }
                catch(err) {
                    //Draw name
                    console.log(addPh(keys.commands.inventory.errors.no_image.console, { 'item_name': id }));
                    const fontSize = 12;
                    ctx.font = `${fontSize}px Minecraft`;
                    ctx.fillStyle = '#000';

                    let displayName;
                    if(['killed', 'killed_by'].includes(category)) displayName = mcData.entitiesByName[id]?.displayName;
                    else displayName = mcData.itemsByName[id]?.displayName;
                    if(!displayName) displayName = id;
                    const lines = utils.wrapText(ctx, displayName, itemSize);
                    lines.forEach((line, i) => ctx.fillText(line, x + itemPadding, y + itemPadding + fontSize + i * fontSize));
                }

                // Draw number
                await utils.drawMinecraftNumber(
                    ctx, value,
                    x + headerSize + numberPadding[0],
                    y + numberPadding[1],
                    numberSize[0], numberSize[1],
                );

                currentItemAmounts[1]++;
                if(currentItemAmounts[1] >= maxItemAmountsY) {
                    y = startCoords[1];
                    x += sizeOfItem();

                    currentItemAmounts[1] = 0;
                    currentItemAmounts[0]++;
                }
                else y += headerSize + yPadding;
            }

            // Draw statistics text
            ctx.font = '64px Minecraft';
            ctx.fillStyle = '#fff';
            const text = addPh(keys.commands.stats.success.title, { category: category.toTitleCase(true) });
            const textWidth = ctx.measureText(text).width;
            utils.drawMinecraftText(ctx, text, statsCanvas.width / 2 - textWidth / 2, 80, true);

            if(!['killed', 'killed_by'].includes(category)) {
                // Draw icon
                const statsIcon = await Canvas.loadImage(`./resources/images/statistics/${category}.png`);
                ctx.drawImage(statsIcon, statsCanvas.width / 2 - 108 / 2, 840, 108, 108);
            }

            const statsAttach = new Discord.AttachmentBuilder(
                await statsCanvas.toBuffer('png'),
                { name: 'Statistics_Player.png', description: keys.commands.stats.stats_description },
            );
            const statsEmbed = getEmbed(keys.commands.stats.success.final, ph.emojisAndColors(), { username: user.username });

            const endIndex = currentItemAmounts[0] * maxItemAmountsY + currentItemAmounts[1];
            paginationPages[`stats_${pageNumber}`] = {
                button: getComponent(keys.commands.stats.success.stats_button, {
                    index: pageNumber,
                    min: startIndex,
                    max: endIndex,
                }),
                page: {
                    files: [statsAttach],
                    embeds: [statsEmbed],
                },
            };

            if(endIndex < Object.values(stats).length) await addStatisticPage(pageNumber + 1, endIndex);
        }

        await addStatisticPage();

        const pagination = new Pagination(client, interaction, paginationPages);
        await pagination.start();
    }
}
