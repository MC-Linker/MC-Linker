import pino from 'pino';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
let shardId = undefined;

/**
 * Sets the log level across all shards.
 * @param {MCLinker} client - The MCLinker client instance.
 * @param {import('pino').LevelOrString} newLevel - The new log level to set.
 */
function setLogLevel(client, newLevel) {
    client.shard.broadcastEval((c, { newLevel }) => {
        c.logger.level = newLevel;
        c.logger.info(`Log level changed to: ${newLevel}`);
    }, {
        context: { newLevel },
    });
}

/**
 * Sets the shard ID for the logger.
 * @param {number} newShardId - The new shard ID to set.
 */
function setShardId(newShardId) {
    shardId = newShardId;
}

export const pinoTransport = {
    targets: [
        {
            target: 'pino-pretty',
            level: logLevel,
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname,shardId',
                messageFormat: '{if shardId}[{shardId}] {end}{msg}',
            },
        },
        {
            target: 'pino/file',
            level: logLevel,
            options: {
                destination: path.resolve(`./logs/.${new Date().toISOString().split('T')[0]}.log`),
                mkdir: true,
            },
        },
    ],
};

const logger = pino({
    level: logLevel,
    mixin: () => {
        return { shardId: shardId !== undefined ? `${shardId}` : undefined };
    },
    transport: pinoTransport,
});
logger.setLogLevel = setLogLevel;
logger.setShardId = setShardId;
logger.shardId = shardId;
logger.info(`[Pino] Logger initialized at level: ${logger.level}`);

await new Promise(r => setTimeout(r, 1000));
export default logger;