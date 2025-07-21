import pino from 'pino';
import path from 'path';
import fs from 'fs-extra';

// Number the log files per day
let index = 1;
let logFilePath = () => path.resolve(`logs/${new Date().toISOString().split('T')[0]}-${index}.log`);
while(await fs.pathExists(logFilePath())) index++;

const transport = pino.transport({
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
                destination: logFilePath(),
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