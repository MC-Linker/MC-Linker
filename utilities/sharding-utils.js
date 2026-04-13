import { ShardClientUtil } from 'discord.js';

/**
 * Executes a function on the shard that owns the given guild.
 * @param {MCLinker} client - The client instance.
 * @param {string} guildId - The guild ID to determine the target shard.
 * @param {Function} fn - Callback receiving (client, context).
 * @param {Object} [context={}] - Serializable context passed to the callback.
 * @returns {Promise<*>} The return value from the target shard.
 */
export function evalOnGuildShard(client, guildId, fn, context = {}) {
    const shardId = ShardClientUtil.shardIdForGuildId(guildId, client.shard.count);
    return client.broadcastEval(fn, { context, shard: shardId });
}

//The following checks use `Object.constructor.name` to determine the type of the object.
//A better way to do this would be to use `instanceof`. However, this is not possible because importing the classes would create circular dependencies.
//TODO improve
export function getManagerString(manager) {
    if(manager.constructor.name === 'ServerConnectionManager') return 'serverConnections';
    else if(manager.constructor.name === 'UserConnectionManager') return 'userConnections';
    else if(manager.constructor.name === 'ServerSettingsConnectionManager') return 'serverSettingsConnections';
    else if(manager.constructor.name === 'UserSettingsConnectionManager') return 'userSettingsConnections';
    else if(manager.constructor.name === 'CustomBotConnectionManager') return 'customBots';
    else return null;
}

export function getManagerStringFromConnection(connection) {
    if(connection.constructor.name === 'ServerConnection') return 'serverConnections';
    else if(connection.constructor.name === 'UserConnection') return 'userConnections';
    else if(connection.constructor.name === 'ServerSettingsConnection') return 'serverSettingsConnections';
    else if(connection.constructor.name === 'UserSettingsConnection') return 'userSettingsConnections';
    else if(connection.constructor.name === 'CustomBotConnection') return 'customBots';
    else return null;
}