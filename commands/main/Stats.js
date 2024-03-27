import * as utils from '../../utilities/utils.js';
import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import { FilePath } from '../../structures/Protocol.js';
import Canvas from 'skia-canvas';
import { addPh, getEmbed, ph } from '../../utilities/messages.js';
import minecraft_data from 'minecraft-data';
import Discord from 'discord.js';

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

        const background = await Canvas.loadImage('./resources/images/backgrounds/stats_background.png');
        const statsCanvas = new Canvas.Canvas(background.width, background.height);
        const ctx = statsCanvas.getContext('2d');
        ctx.drawImage(background, 0, 0, statsCanvas.width, statsCanvas.height);

        if(category === 'custom') {
            //TODO
            return;
        }

        let x = startCoords[0];
        let y = startCoords[1];
        const currentItemAmounts = [0, 0];
        const maxDigitsInColumn = columnIndex => {
            const numbersInColumn = Object.values(stats).slice(columnIndex * maxItemAmountsY, (columnIndex + 1) * maxItemAmountsY);
            return Math.max(...numbersInColumn.map(num => num.toString().length));
        };
        for(let [itemId, value] of Object.entries(stats)) {
            // Break if the next item will go out of bounds
            if(x + headerSize + numberPadding[0] * 2 + numberSize[0] * value.toString().length >= statsCanvas.width) break;

            itemId = itemId.replace('minecraft:', '');

            //Draw header
            const headerImg = await Canvas.loadImage(`./resources/images/statistics/header.png`);
            ctx.drawImage(headerImg, x, y, headerSize, headerSize);

            //TODO make this a function with rendering
            try {
                //Draw image
                const itemImg = await Canvas.loadImage(`./resources/images/items/${itemId}.png`);
                ctx.drawImage(
                    itemImg,
                    x + itemPadding,
                    y + itemPadding,
                    itemSize, itemSize,
                );
            }
            catch(err) {
                //Draw name
                console.log(addPh(keys.commands.inventory.errors.no_image.console, { 'item_name': itemId }));
                const fontSize = 12;
                ctx.font = `${fontSize}px Minecraft`;
                ctx.fillStyle = '#000';
                const lines = utils.wrapText(ctx, mcData.itemsByName[itemId].displayName, itemSize);
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
                x += headerSize + numberPadding[0] * 2 + numberSize[0] * maxDigitsInColumn(currentItemAmounts[0]);

                currentItemAmounts[1] = 0;
                currentItemAmounts[0]++;
            }
            else y += headerSize + yPadding;
        }

        // Draw statistics text
        ctx.font = '30px Minecraft';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText(addPh(keys.commands.stats.success.title, { category: category.toTitleCase(true) }), statsCanvas.width / 2, 50);

        // Draw icon
        const statsIcon = await Canvas.loadImage(`./resources/images/statistics/${category}.png`);
        ctx.drawImage(statsIcon, 20, 20, 50, 50);

        const statsAttach = new Discord.AttachmentBuilder(
            await statsCanvas.toBuffer('png'),
            { name: 'Statistics_Player.png', description: keys.commands.stats.stats_description },
        );
        const statsEmbed = getEmbed(keys.commands.stats.success.final, ph.emojisAndColors(), { username: user.username });
        return await interaction.replyOptions({ files: [statsAttach], embeds: [statsEmbed] });
    }
}
