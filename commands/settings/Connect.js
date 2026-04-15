import crypto from 'crypto';
import { getEmbed } from '../../utilities/messages.js';
import keys from '../../utilities/keys.js';
import Command from '../../structures/Command.js';
import Discord from 'discord.js';
import MCLinkerAPI from '../../api/MCLinkerAPI.js';

export default class Connect extends Command {

    constructor() {
        super({
            name: 'connect',
            requiresConnectedServer: false,
            category: 'settings',
            ephemeral: true,
        });
    }

    /**
     * Stores websocket verification data on shard 0, where the API runs and reads it.
     * @param {MCLinker} client
     * @param {string} id
     * @param {Object} verificationData
     * @returns {Promise<void>}
     */
    async setWSVerification(client, id, verificationData) {
        await client.broadcastEval((c, { id, verificationData }) => {
            c.api.wsVerification.set(id, verificationData);
        }, { context: { id, verificationData }, shard: 0 });
    }

    /**
     * Removes websocket verification data from shard 0.
     * @param {MCLinker} client
     * @param {string} id
     * @returns {Promise<void>}
     */
    async deleteWSVerification(client, id) {
        await client.broadcastEval((c, { id }) => {
            c.api.wsVerification.delete(id);
        }, { context: { id }, shard: 0 });
    }

    /**
     * @inheritdoc
     * @param interaction
     * @param client
     * @param {[string, string, boolean]} args - [0] The join requirement (roles/link/none), [1] The display IP, [2] Whether the server is online-mode.
     * @param server
     * @param logger
     */
    async run(interaction, client, args, server, logger) {
        const joinRequirement = args[0];
        const displayIp = args[1];
        const online = args[2];

        const code = crypto.randomBytes(16).toString('hex').slice(0, 5);
        let selectResponse = joinRequirement === 'roles' ? await this.askForRequiredRolesToJoin(interaction) : null;
        if(!selectResponse && joinRequirement === 'roles') return; //User didn't respond in time
        else if(joinRequirement === 'link') selectResponse = { roles: [], method: 'all' }; //No roles still requires linked account

        const verificationEmbed = getEmbed(keys.commands.connect.step.command_verification, { code: `${interaction.guildId}:${code}` });
        if(server) {
            const alreadyConnectedEmbed = getEmbed(keys.commands.connect.warnings.already_connected, { ip: server.displayIp });
            await interaction.editReply({ embeds: [verificationEmbed, alreadyConnectedEmbed], components: [] });
        }
        else await interaction.editReply({ embeds: [verificationEmbed], components: [] });

        // Set data for socket.io connect listener
        await this.setWSVerification(client, interaction.guildId, {
            code,
            shard: client.shard.ids[0],
            requiredRoleToJoin: selectResponse,
            displayIp,
            online,
        });

        try {
            const response = await client.api.waitForAPIEvent('connect-response', 180_000, data => {
                if(data.id !== interaction.guildId) return;
                return data;
            });

            if(response.responseType === 'success') await interaction.editReplyTl(keys.commands.connect.success.websocket);
            else if(response.responseType === 'error') await interaction.editReplyTl(keys.commands.connect.errors.websocket_error, response.placeholders);
        }
        catch(err) {
            if(!(err instanceof MCLinkerAPI.EventTimeoutError)) return await interaction.editReplyTl(keys.commands.connect.warnings.no_reply_in_time);
            client.analytics.trackError('command', 'connect', interaction.guildId, interaction.user.id, err, null, logger);
            return interaction.editReplyTl(keys.api.plugin.errors.status_400);
        }
        finally {
            await this.deleteWSVerification(client, interaction.guildId);
        }
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
            const logChooserMsg = await interaction.editReplyTl(keys.commands.connect.step.choose_roles);

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
                    await interaction.editReplyTl(keys.commands.connect.warnings.not_collected);
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
