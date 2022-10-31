// Converts old server- and user data to the new format.
const fs = require('fs-extra');

const oldTypes = {
    '0': 'chat',
    '1': 'join',
    '2': 'quit',
    '3': 'advancement',
    '4': 'death',
    '5': 'player_command',
    '6': 'start',
    '7': 'close',
};

const serverFolders = fs.readdirSync('./serverdata/connections');
const userFolders = fs.readdirSync('./userdata/connections');

for(const folder of serverFolders) {
    const connectionPath = `./serverdata/connections/${folder}/connection.json`;
    const newConnectionPath = `./serverdata_new/connections/${folder}/connection.json`;
    const disablePath = `./serverdata/connections/${folder}/disable.json`;
    const newSettingsPath = `./serverdata_new/connections/${folder}/settings.json`;

    const serverConnection = fs.existsSync(connectionPath) ? fs.readJsonSync(connectionPath) : null;
    const serverDisable = fs.existsSync(disablePath) ? fs.readJsonSync(disablePath) : null;

    if(serverConnection) {
        console.log(`Converting server data for ${folder}...`);
        let newServerConnection = {};

        if(serverConnection.protocol === 'plugin') {
            /** @type {PluginServerConnectionData} */
            newServerConnection = {
                id: folder,
                ip: serverConnection.ip.split(':')[0],
                port: serverConnection.ip.split(':')[1],
                hash: serverConnection.hash,
                path: serverConnection.path,
                version: parseInt(serverConnection.version ?? '19'),
                online: serverConnection.online ?? false,
                channels: serverConnection.channels ?? [],
                protocol: serverConnection.protocol,
            };
            if(serverConnection.types) {
                newServerConnection.channels.push({
                    id: serverConnection.channel,
                    types: serverConnection.types.map(t => oldTypes[t.type]),
                    webhook: serverConnection.webhook,
                });
            }
        }
        else if(serverConnection.protocol === 'ftp' || serverConnection.protocol === 'sftp') {
            /** @type {FtpServerConnectionData} */
            newServerConnection = {
                id: folder,
                ip: serverConnection.host,
                port: serverConnection.port,
                username: serverConnection.user,
                password: serverConnection.password,
                path: serverConnection.path,
                version: serverConnection.version ?? 19,
                online: serverConnection.online ?? false,
                protocol: serverConnection.protocol,
            };
        }

        fs.outputJsonSync(newConnectionPath, newServerConnection, { spaces: 2 });
        console.log(`Done!`);
    }

    console.log(`Converting settings for ${folder}...`);

    /** @type {SettingsConnectionData} */
    const newSettings = {
        id: folder,
        language: 'en_us',
        disabled: serverDisable ?? {
            commands: [],
            advancements: [],
            stats: [],
        },
    };

    fs.outputJsonSync(newSettingsPath, newSettings, { spaces: 2 });
    console.log(`Done!`);
}

for(const folder of userFolders) {
    console.log(`Converting user data for ${folder}...`);

    const connectionPath = `./userdata/connections/${folder}/connection.json`;
    const newConnectionPath = `./userdata_new/connections/${folder}/connection.json`;
    if(!fs.existsSync(connectionPath)) continue;

    const userData = fs.readJsonSync(connectionPath);

    /** @type {UserConnectionData} */
    const newUser = {
        id: folder,
        username: userData.name,
        uuid: userData.id,
    };

    fs.outputJsonSync(newConnectionPath, newUser, { spaces: 2 });
    console.log(`Done!`);
}
