import minecraft_data from 'minecraft-data';
import Discord from 'discord.js';
import { addPh, getEmbed, ph } from '../../utilities/messages.js';
import * as utils from '../../utilities/utils.js';
import keys from '../../utilities/keys.js';
import { FilePath } from '../../structures/Protocol.js';
import * as d3 from 'd3-hierarchy';
import Canvas from 'skia-canvas';
import data from '../../resources/data/advancements.json' assert { type: 'json' };
import Command from '../../structures/Command.js';

const mcData = minecraft_data('1.20.4');

const iconSize = 40;
const frameSize = iconSize + 18;
const framePadding = 10;
const imagePadding = 20;

export default class Advancements extends Command {

    constructor() {
        super({
            name: 'advancements',
            requiresUserIndex: 1,
            category: 'main',
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        let category = args[0];
        if(category === 'minecraft') category = 'story';
        const user = args[1];
        const showDetails = args[2];

        const amFile = await server.protocol.get(FilePath.Advancements(server.worldPath, user.uuid), `./download-cache/advancements/${user.uuid}.json`);
        if(!await utils.handleProtocolResponse(amFile, server.protocol, interaction, {
            404: keys.api.command.errors.could_not_download_user_files,
        }, { category: 'advancements' }, ph.colors())) return;
        const completedAdvancements = JSON.parse(amFile.data.toString());

        const treeData = this.getTreeData(category, completedAdvancements);

        const root = d3.hierarchy(treeData);
        const tree = d3.tree().nodeSize([frameSize + framePadding, frameSize + framePadding]).separation(() => 1);
        const treeResult = tree(root);

        // Find the minimum x value to shift everything to the positive (d3 trees are centered around 0)
        const min = treeResult.descendants().sort((a, b) => a.x - b.x)[0].x;

        //Flip x and y to make it horizontal and find dimensions
        let width = 0;
        let height = 0;

        for(const node of treeResult.descendants()) {
            [node.x, node.y] = [node.y, node.x - min];
            width = Math.max(width, node.x);
            height = Math.max(height, node.y);
        }

        const advancementCanvas = new Canvas.Canvas(width + frameSize / 2 + imagePadding * 2, height + frameSize / 2 + imagePadding * 2);
        const ctx = advancementCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Tile background
        const background = await Canvas.loadImage('./resources/images/advancements/stone.png');
        ctx.scale(2, 2);
        ctx.fillStyle = ctx.createPattern(background, 'repeat');
        ctx.fillRect(0, 0, advancementCanvas.width, advancementCanvas.height);
        ctx.scale(0.5, 0.5); // Reset scale

        //Center tree
        ctx.translate((frameSize + framePadding) / 2 + 0.5, (advancementCanvas.height - height) / 2);

        // Draw tree
        for(const node of treeResult.descendants()) {
            // Draw connection
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(node.x + 29 + 3, node.y); // Move halfway to the next node

            for(const child of node.children ?? []) {
                ctx.moveTo(node.x + 29 + 3, node.y);
                if(node.children.length === 1) ctx.lineTo(child.x, child.y);
                else {
                    ctx.lineTo(node.x + 29 + 3, child.y);
                    ctx.lineTo(child.x, child.y);
                }

                //Draw outline of line
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 7;
                ctx.stroke();

                //Draw line
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            //Draw frame
            const frame = await Canvas.loadImage(`./resources/images/advancements/${node.data.type ?? 'task'}_frame_${node.data.obtained ?? true ? 'obtained' : 'unobtained'}.png`);
            ctx.drawImage(frame, node.x - frameSize / 2, node.y - frameSize / 2, frameSize, frameSize);

            try {
                //Draw icon
                const icon = await Canvas.loadImage(`./resources/images/items/${node.data.icon}.png`);
                ctx.drawImage(icon, node.x - iconSize / 2, node.y - iconSize / 2, iconSize, iconSize);
            }
            catch(err) {
                //Draw name
                console.log(addPh(keys.commands.inventory.errors.no_image.console, { 'item_name': node.data.icon }));
                ctx.font = '8px Minecraft';
                ctx.fillStyle = '#000';
                const lines = utils.wrapText(ctx, mcData.itemsByName[node.data.icon]?.displayName ?? node.data.icon, frameSize);
                lines.forEach((line, i) => ctx.fillText(line, node.x - iconSize / 2, node.y - iconSize / 2 + 8 + i * 8));
            }
        }

        const advancementsAttach = new Discord.AttachmentBuilder(
            await advancementCanvas.toBuffer('png'),
            { name: 'Advancements_Player.png', description: keys.commands.advancements.advancements_description },
        );
        const advancementsEmbed = getEmbed(keys.commands.advancements.success.final, ph.emojisAndColors(), { username: user.username });

        await interaction.replyOptions({ embeds: [advancementsEmbed], files: [advancementsAttach] });
    }

    getTreeData(category, completedAdvancements) {
        function toNestedObject(advancement) {
            if(!advancement) return null;
            return {
                ...advancement,
                obtained: completedAdvancements[`minecraft:${category}/${advancement.value}`]?.done ?? false,
                children: advancement.children.map(c => toNestedObject(data[category].find(a => a.value === c))),
            };
        }

        return toNestedObject(data[category].find(a => a.value === 'root'));
    }
}
