import pino from 'pino';
import path from 'path';

export let shardId = '';

/**
 * Changes the log level across all shards.
 * @param {MCLinker} client - The MCLinker client instance.
 * @param {import('pino').LevelOrString} newLevel - The new log level to set.
 */
export function changeLogLevel(client, newLevel) {
    client.shard.broadcastEval((c, { newLevel }) => {
        c.logger.level = newLevel;
        c.logger.info(`Log level changed to: ${newLevel}`);
    }, {
        context: { newLevel },
    });
}

const logLevel = process.env.LOG_LEVEL || 'info';
export const pinoTransport = {
    targets: [
        {
            target: 'pino-pretty',
            level: logLevel,
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
                messageFormat: '{time} {if shardId}[{shardId}] {end}{levelLabel}: {msg}',
            },
        },
        {
            target: 'pino/file',
            level: logLevel,
            options: {
                destination: path.resolve(`logs/${new Date().toISOString().split('T')[0]}.log`),
                mkdir: true,
            },
        },
    ],
};

const logger = pino({
    level: logLevel,
    mixin: () => {
        return { shardId };
    },
    transport: pinoTransport,
});
logger.changeLogLevel = changeLogLevel;
logger.info(`[Pino] Logger initialized at level: ${logger.level}`);

await new Promise(r => setTimeout(r, 1000));
export default logger;