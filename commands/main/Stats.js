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
const numberPadding = [22, 9];
const maxItemAmounts = [8, 11];
const headerSize = 80;
const itemSize = 70;
const numberSize = [45, 60];
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
        for(let [itemId, value] of Object.entries(stats)) {
            if(currentItemAmounts[1] >= maxItemAmounts[1]) break;

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
                ctx.font = '8px Minecraft';
                ctx.fillStyle = '#000';
                const lines = utils.wrapText(ctx, mcData.itemsByName[itemId].displayName, itemSize);
                lines.forEach((line, i) => ctx.fillText(line, x + itemPadding, y + itemPadding + 8 + i * 8));
            }

            //Draw number
            utils.drawMinecraftNumber(
                ctx, value,
                x + headerSize + numberPadding[0],
                y + numberPadding[1],
                numberSize[0], numberSize[1],
            );

            currentItemAmounts[0]++;
            if(currentItemAmounts[0] >= maxItemAmounts[0]) {
                x += headerSize + numberPadding[0] * 2 + numberSize[0];
                y = startCoords[1];
                currentItemAmounts[0] = 0;
                currentItemAmounts[1]++;
            }
            else y += headerSize + yPadding;
        }

        const statsAttach = new Discord.AttachmentBuilder(
            await statsCanvas.toBuffer('png'),
            { name: 'Statistics_Player.png', description: keys.commands.stats.stats_description },
        );
        const statsEmbed = getEmbed(keys.commands.stats.success.final, ph.emojisAndColors(), { username: user.username });
        return await interaction.replyOptions({ files: [statsAttach], embeds: [statsEmbed] });
    }
}
