import * as utils from '../../utilities/utils.js';
import { getMinecraftData } from '../../utilities/utils.js';
import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import { FilePath, ProtocolError } from '../../structures/protocol/Protocol.js';
import Canvas from 'skia-canvas';
import { addPh, getComponent, getEmbed, setCachedFooter } from '../../utilities/messages.js';
import Discord, { ButtonStyle } from 'discord.js';
import Pagination from '../../structures/helpers/Pagination.js';
import ItemRenderer from '../../structures/render/ItemRenderer.js';

import customStats from '../../resources/data/stats_custom.json' with { type: 'json' };

export default class Stats extends Command {

    _renderingConstants = {
        startCoords: [41, 152],
        yPadding: 7,
        numberPadding: [32, 19],
        maxStatsAmountsY: 8,
        maxCustomStatsAmountY: 24,
        headerSize: 74,
        get itemSize() { return this.headerSize - 10; },
        numberSize: [30, 45],
        get itemPadding() { return (this.headerSize - this.itemSize) / 2; },
    };

    constructor() {
        super({
            name: 'stats',
            requiresUserIndex: 1,
            category: 'main',
        });
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[string, UserResponse, string]} args - [0] The stat category, [1] The resolved user, [2] The sorting order.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const {
            startCoords,
            yPadding,
            numberPadding,
            maxStatsAmountsY,
            maxCustomStatsAmountY,
            headerSize,
            itemSize,
            numberSize,
            itemPadding,
        } = this._renderingConstants;
        const mcData = getMinecraftData(server.version);
        const category = args[0];
        const user = args[1];
        const sorting = args[2] ?? 'descending';

        const argPlaceholder = { 'stat_category': category, 'username': user.username };

        const statFile = await server.protocol.getWithCache(...FilePath.Stats(server.worldPath, user.uuid));
        if(!await utils.handleProtocolResponse(statFile, server.protocol, interaction, {
            [ProtocolError.NOT_FOUND]: keys.api.command.warnings.could_not_download_user_files,
        }, { category: 'stats' })) return;

        let stats;
        try {
            const statData = JSON.parse(statFile.data.toString());
            stats = statData.stats[`minecraft:${category}`];
            if(!stats) return interaction.editReplyTl(keys.commands.stats.errors.could_not_parse, argPlaceholder);
        }
        catch(err) {
            return interaction.editReplyTl(keys.commands.stats.errors.could_not_parse, argPlaceholder);
        }

        if(sorting === 'descending')
            stats = Object.fromEntries(Object.entries(stats).sort((a, b) => b[1] - a[1]));
        else if(sorting === 'ascending')
            stats = Object.fromEntries(Object.entries(stats).sort((a, b) => a[1] - b[1]));
        else if(sorting === 'alphabetically')
            stats = Object.fromEntries(Object.entries(stats).sort((a, b) => a[0].localeCompare(b[0])));

        // Entity stats (killed/killed_by) keep their static PNGs; item categories render in 3D.
        const isEntityCategory = ['killed', 'killed_by'].includes(category);

        const paginationPages = {};
        // [currentColumnIndex, currentRowIndex]
        const currentStatAmounts = [0, 0];

        const addStatisticPage = async (pageNumber = 0, startIndex = 0) => {
            const background = await Canvas.loadImage('./resources/images/backgrounds/stats_background.png');
            const statsCanvas = new Canvas.Canvas(background.width, background.height);
            const ctx = statsCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(background, 0, 0, statsCanvas.width, statsCanvas.height);

            if(category === 'custom') {
                ctx.font = '30px Minecraft';
                ctx.fillStyle = '#fcfcfc';

                // Format custom statistics
                stats = Object.fromEntries(Object.entries(stats).map(([id, value]) => {
                    id = id.replace('minecraft:', '');
                    return [customStats.stats.find(stat => stat.value === id)?.name ?? id, this.formatCustomStatsValue(id, value)];
                }, this));

                const longestNameInColumn = utils.memoize(columnIndex => {
                    const namesInColumn = Object.keys(stats).slice(columnIndex * maxCustomStatsAmountY, (columnIndex + 1) * maxCustomStatsAmountY);
                    if(namesInColumn.length === 0) return 0;

                    return Math.max(...namesInColumn.map(name => ctx.measureText(name).width));
                });

                const longestTextInColumn = utils.memoize(columnIndex => {
                    if(longestNameInColumn(columnIndex) === 0) return 0;
                    const valuesInColumn = Object.values(stats).slice(columnIndex * maxCustomStatsAmountY, (columnIndex + 1) * maxCustomStatsAmountY);
                    if(valuesInColumn.length === 0) return 0;

                    const longestValue = Math.max(...valuesInColumn.map(value => ctx.measureText(value.toString()).width));

                    return longestNameInColumn(columnIndex) + numberPadding[0] + longestValue;
                });

                let tempColumnIndex = currentStatAmounts[0];
                let sizeOfAllItems = startCoords[0];
                while(sizeOfAllItems + longestTextInColumn(tempColumnIndex) <= statsCanvas.width) {
                    if(longestTextInColumn(tempColumnIndex) === 0) break;
                    sizeOfAllItems += longestTextInColumn(tempColumnIndex++) + numberPadding[0];
                }

                let x = (statsCanvas.width - sizeOfAllItems) / 2;
                let y = startCoords[1] + ctx.measureText('M').actualBoundingBoxAscent / 2; // Move it down half the height of the text

                for(const [name, value] of Object.entries(stats).slice(startIndex, tempColumnIndex * maxCustomStatsAmountY)) {
                    utils.drawMinecraftText(ctx, name, x, y, true);
                    utils.drawMinecraftText(ctx, value, x + longestNameInColumn(currentStatAmounts[0]) + numberPadding[0], y, true);

                    currentStatAmounts[1]++;
                    if(currentStatAmounts[1] >= maxCustomStatsAmountY) {
                        y = startCoords[1] + ctx.measureText('M').actualBoundingBoxAscent / 2;
                        x += longestTextInColumn(currentStatAmounts[0]) + numberPadding[0];

                        currentStatAmounts[1] = 0;
                        currentStatAmounts[0]++;
                    }
                    else y += ctx.measureText(name).actualBoundingBoxAscent + yPadding;

                    if(ctx.fillStyle === '#fcfcfc') ctx.fillStyle = '#8e8e8e';
                    else ctx.fillStyle = '#fcfcfc';
                }
            }
            else {
                const maxDigitsInColumn = columnIndex => {
                    const numbersInColumn = Object.values(stats).slice(columnIndex * maxStatsAmountsY, (columnIndex + 1) * maxStatsAmountsY);
                    if(numbersInColumn.length === 0) return 0;
                    return Math.max(...numbersInColumn.map(num => num.toString().length));
                };
                const sizeOfStat = (digits = maxDigitsInColumn(currentStatAmounts[0])) => headerSize + numberPadding[0] * 2 + (numberSize[0] + numberSize[0] / 5) * digits; //numberSize[0] / 5 is the space between the numbers

                let tempColumnIndex = currentStatAmounts[0];
                let sizeOfAllItems = 0;
                while(sizeOfAllItems + startCoords[0] + sizeOfStat(maxDigitsInColumn(tempColumnIndex)) <= statsCanvas.width) {
                    if(maxDigitsInColumn(tempColumnIndex) === 0) break;
                    sizeOfAllItems += sizeOfStat(maxDigitsInColumn(tempColumnIndex++));
                }

                let x = (statsCanvas.width - sizeOfAllItems) / 2;
                let y = startCoords[1];

                /** @type {Array<{ id: string, key: string, x: number, y: number }>} */
                const itemPlacements = [];

                for(let [id, value] of Object.entries(stats).slice(startIndex)) {
                    // make negative numbers positive (its how minecraft does it)
                    if(value < 0) value = Math.abs(value);

                    // Break if the next item will go out of bounds
                    if(x + sizeOfStat(value.toString().length) >= statsCanvas.width) break;

                    id = id.replace('minecraft:', '');

                    //Draw header
                    const headerImg = await Canvas.loadImage(`./resources/images/statistics/header.png`);
                    ctx.drawImage(headerImg, x, y, headerSize, headerSize);

                    if(isEntityCategory) {
                        //Draw entity image (static PNG), or its name fitted in the header
                        try {
                            const img = await Canvas.loadImage(`./resources/images/entities/${id}.png`);
                            ctx.drawImage(img, x + itemPadding, y + itemPadding, itemSize, itemSize);
                        }
                        catch(err) {
                            logger.debug(`Could not find entity image ${id}. Applying text...`);
                            utils.drawFittedText(ctx, mcData.entitiesByName[id]?.displayName ?? id, x + itemPadding, y + itemPadding, itemSize, itemSize, { maxFontSize: 14 });
                        }
                    }
                    else {
                        //Items are batched and composited after the loop
                        itemPlacements.push({
                            id,
                            key: ItemRenderer.imageKey(server.version, id),
                            x: x + itemPadding,
                            y: y + itemPadding,
                        });
                    }

                    // Draw number
                    utils.drawMinecraftNumber(
                        ctx, value,
                        x + headerSize + numberPadding[0],
                        y + numberPadding[1],
                        numberSize[0], numberSize[1],
                    );

                    currentStatAmounts[1]++;
                    if(currentStatAmounts[1] >= maxStatsAmountsY) {
                        y = startCoords[1];
                        x += sizeOfStat();

                        currentStatAmounts[1] = 0;
                        currentStatAmounts[0]++;
                    }
                    else y += headerSize + yPadding;
                }

                // Render only the uncached item icons (one GL pass) and composite each cached image
                if(itemPlacements.length) {
                    const itemImages = await ItemRenderer.getItemImages(itemPlacements, server.version, interaction);

                    for(const p of itemPlacements) {
                        if(await itemImages.draw(ctx, p.key, p.x, p.y, itemSize)) continue;
                        logger.debug(`Could not render item ${p.id}. Applying text...`);
                        utils.drawFittedText(ctx, mcData.itemsByName[p.id]?.displayName ?? p.id, p.x, p.y, itemSize, itemSize, { maxFontSize: 14 });
                    }
                }
            }

            // Draw statistics text
            ctx.font = '64px Minecraft';
            ctx.fillStyle = '#fcfcfc';
            const text = addPh(keys.commands.stats.success.title, { category: utils.toTitleCase(category, true) });
            const textWidth = ctx.measureText(text).width;
            utils.drawMinecraftText(ctx, text, statsCanvas.width / 2 - textWidth / 2, 80, true);

            if(!['killed', 'killed_by', 'custom'].includes(category)) {
                // Draw icon
                const statsIcon = await Canvas.loadImage(`./resources/images/statistics/${category}.png`);
                ctx.drawImage(statsIcon, statsCanvas.width / 2 - 108 / 2, 840, 108, 108);
            }

            const statsAttach = new Discord.AttachmentBuilder(
                await statsCanvas.toBuffer('png'),
                { name: 'Statistics_Player.png', description: keys.commands.stats.stats_description },
            );
            const statsEmbed = getEmbed(keys.commands.stats.success.final, { username: user.username });
            if(statFile.cached) setCachedFooter(statsEmbed);

            const endIndex = currentStatAmounts[0] * (category === 'custom' ? maxCustomStatsAmountY : maxStatsAmountsY) + currentStatAmounts[1];
            paginationPages[`stats_${pageNumber}`] = {
                button: getComponent(keys.commands.stats.success.stats_button, {
                    index: pageNumber,
                    min: startIndex,
                    max: endIndex,
                }),
                options: {
                    files: [statsAttach],
                    embeds: [statsEmbed],
                },
            };

            if(endIndex < Object.values(stats).length) await addStatisticPage(pageNumber + 1, endIndex);
        };

        await addStatisticPage();

        const pagination = new Pagination(client, interaction, paginationPages, {
            highlightSelectedButton: ButtonStyle.Primary,
            timeout: 60000 * 5, // 5 minutes
        });
        await pagination.start();
    }

    /**
     * Formats the value of a custom statistic if it is a distance or time.
     * @param {string} id The id of the custom statistic.
     * @param {number} value The value of the custom statistic.
     */
    formatCustomStatsValue(id, value) {
        if(id.endsWith('_one_cm')) return utils.formatDistance(value);
        else if(id.includes('time')) return utils.formatDuration(value / 20 * 1000);
        return value.toString();
    }
}
