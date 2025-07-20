import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: [
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
                destination: `./logs/${new Date().toISOString().split('T')[0]}.log`,
                mkdir: true,
            },
        },
    ],
});

export default logger; 