import pino from 'pino';
import path from 'path';


export const pinoTransport = {
    targets: [
        {
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
};


const logger = pino({ level: process.env.LOG_LEVEL || 'info', transport: pinoTransport });
logger.info('[Pino] Logger initialized at level:', process.env.LOG_LEVEL || 'info');

export default logger; 