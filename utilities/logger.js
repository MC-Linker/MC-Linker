import pino from 'pino';
import path from 'path';

const transport = pino.transport({
    targets: [
        process.env.NODE_ENV === 'production' ? undefined : {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
        {
            target: 'pino/file',
            options: {
                destination: path.resolve(`logs/${new Date().toISOString().split('T')[0]}.log`),
                mkdir: true,
            },
        },
    ],
});

const logger = pino(
    { level: process.env.LOG_LEVEL || 'info' },
    transport,
);

export default logger; 