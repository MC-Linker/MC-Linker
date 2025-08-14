import pino from 'pino';
import path from 'path';

export const logLevel = process.env.LOG_LEVEL || 'info';

export const pinoTransport = {
    targets: [
        {
            target: 'pino-pretty',
            level: logLevel,
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
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

const logger = pino({ level: logLevel || 'info', transport: pinoTransport });
logger.info(`[Pino] Logger initialized at level: ${logger.level}`);

await new Promise(r => setTimeout(r, 1000));
export default logger;