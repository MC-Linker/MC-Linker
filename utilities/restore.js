//Restores the connection.json from all connection files.
const fs = require('fs-extra');
restoreConnections();

//TODO Update restore
function restoreConnections() {
    //Read guild connection folders
    const serverFolders = fs.readdirSync('./serverdata/connections');
    console.log('Read server connection folders...');

    //If connections.json already exists, return
    if(serverFolders.includes('connections.json')) return console.log('connections.json already exists. Please delete it if you still want to restore.');

    const connections = [];
    //Loop over guild connections
    for(const serverFolder of serverFolders) {
        console.group(`Restoring ${serverFolder}...`);

        let serverConnection;
        try {
            serverConnection = fs.readJsonSync(`./serverdata/connections/${serverFolder}/connection.json`, 'utf-8');
        }
        catch(err) {
            console.log('Couldn\'t read connection file...', err);
            continue;
        }

        const connJson = {
            'guildId': serverConnection.guild,
            'hash': serverConnection.hash,
            'chat': serverConnection.chat,
            'ip': serverConnection.ip,
        };
        if(serverConnection.channel) connJson.channelId = serverConnection.channel;

        connections.push(connJson);
        console.log('Pushed connection...');
        console.groupEnd();
    }

    //Write new connections.json
    fs.writeJsonSync('./serverdata/connections/connections.json', connections, { spaces: 2 });
}