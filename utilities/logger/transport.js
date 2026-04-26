import pretty from 'pino-pretty';

export default function() {
    return pretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname,shardId,feature,guildId,userId',
        messageFormat(log, messageKey) {
            const feature = log.feature;
            let prefix = '';
            if(feature) {
                prefix = feature.split('.')
                    .map(s => `[${s.charAt(0).toUpperCase()}${s.slice(1)}]`)
                    .join('') + ' ';
            }
            if(log.shardId != null) prefix += `[${log.shardId}] `;
            return `${prefix}${log[messageKey]}`;
        },
    });
}
