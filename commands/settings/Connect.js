import crypto from 'crypto';
import { getEmbed, ph } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import Discord from 'discord.js';

export default class Connect extends Command {

    /**
     * Map to store the websocket verification data for each server.
     * @type {Map<any, any>}
     */
    wsVerification = new Map();

    /**
     * Map to store the pending interactions for the connect command.
     * @type {Map<any, any>}
     */
    pendingInteractions = new Map();

    constructor() {
        super({
            name: 'connect',
            requiresConnectedServer: false,
            category: 'settings',
            ephemeral: true,
        });
    }

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;

        const joinRequirement = args[0];
        const displayIp = args[1];
        const online = args[2];

        const code = crypto.randomBytes(16).toString('hex').slice(0, 5);
        let selectResponse = joinRequirement === 'roles' ? await this.askForRequiredRolesToJoin(interaction) : null;
        if(!selectResponse && joinRequirement === 'roles') return; //User didn't respond in time
        else if(joinRequirement === 'link') selectResponse = { roles: [], method: 'all' }; //No roles still requires linked account

        const verificationEmbed = getEmbed(keys.commands.connect.step.command_verification, ph.emojisAndColors(), { code: `${interaction.guildId}:${code}` });
        if(server) {
            const alreadyConnectedEmbed = getEmbed(keys.commands.connect.warnings.already_connected, ph.emojisAndColors(), { ip: server.displayIp });
            await interaction.replyOptions({ embeds: [verificationEmbed, alreadyConnectedEmbed], components: [] });
        }
        else await interaction.replyOptions({ embeds: [verificationEmbed], components: [] });

        const timeout = setTimeout(async () => {
            await client.shard.broadcastEval((c, { id }) => {
                c.commands.get('connect').wsVerification.delete(id);
            }, { context: { id: interaction.guildId }, shard: 0 });
            await interaction.replyTl(keys.commands.connect.warnings.no_reply_in_time);
        }, 180_000);

        this.pendingInteractions.set(interaction.guildId, { interaction, timeout });
        await client.shard.broadcastEval((c, { code, id, shard, requiredRoleToJoin, displayIp, online }) => {
            c.commands.get('connect').wsVerification.set(id, {
                code,
                shard,
                requiredRoleToJoin,
                displayIp,
                online,
            });
        }, {
            context: {
                code,
                id: interaction.guildId,
                shard: client.shard.ids[0],
                requiredRoleToJoin: selectResponse,
                displayIp,
                online,
            },
            shard: 0,
        });

        //Connection and interaction response will now be handled by editConnectResponse event or by the timeout
    }

    /**
     * Disconnects all active connections of this server.
     * @param {MCLinker} client - The Discord client.
     * @param {ServerConnectionResolvable} serverResolvable - The server to disconnect.
     * @returns {Promise<boolean>} - Whether the server was disconnected.
     */
    async disconnectOldServer(client, serverResolvable) {
        const server = client.serverConnections.resolve(serverResolvable);
        if(server) return await client.serverConnections.disconnect(server);
    }

    /**
     * This will send a select menu to the user asking for the required roles to join the server and the method to check them.
     * @param {Discord.CommandInteraction & TranslatedResponses} interaction - The interaction to reply to.
     * @returns {Promise<?RequiredRoleToJoinData>} - The roles and the method or null if the user didn't respond in time.
     */
    askForRequiredRolesToJoin(interaction) {
        return new Promise(async resolve => {
            const logChooserMsg = await interaction.replyTl(keys.commands.connect.step.choose_roles);

            const roleCollector = logChooserMsg.createMessageComponentCollector({
                componentType: Discord.ComponentType.RoleSelect,
                time: 180_000,
            });

            const methodCollector = logChooserMsg.createMessageComponentCollector({
                componentType: Discord.ComponentType.StringSelect,
                time: 180_000,
            });

            roleCollector.on('collect', async menu => {
                if(menu.customId !== 'required_roles') return;

                await menu.deferUpdate();
                if(methodCollector.total >= 1) {
                    roleCollector.stop();
                    methodCollector.stop();
                }
            });

            methodCollector.on('collect', async menu => {
                if(menu.customId !== 'required_roles_method') return;

                await menu.deferUpdate();
                if(roleCollector.total >= 1) {
                    roleCollector.stop();
                    methodCollector.stop();
                }
            });

            //Only one of the collectors should listen to the end event
            roleCollector.on('end', async collected => {
                if(collected.size === 0 || methodCollector.total === 0) {
                    await interaction.replyTl(keys.commands.connect.warnings.not_collected);
                    return resolve(null);
                }

                // Resolve with last collected
                const roles = collected.last().values;
                const method = methodCollector.collected.last().values[0];
                resolve({ roles, method });
            });

            methodCollector.on('end', () => {}); // Will throw an error if not defined (i think)
        });
    }
}
