//Restores the connection.json from all connection files.
const fs = require('fs');
restoreConnections();

function restoreConnections() {
    const serverConnectionFolders = fs.readdirSync('./serverdata');

    const connections = [];
    for (const serverFolder of serverConnectionFolders) {
        if(serverFolder === 'GitInit') continue;
        console.log(`Restoring ${serverFolder}...`);

        const conn = JSON.parse(fs.readFileSync(`./serverdata/${serverFolder}/connection.json`, 'utf-8'));

        const connJson = {
            "guildId": conn.guild,
            "hash": conn.hash,
            "chat": conn.chat,
            "ip": conn.ip
        }
        if(conn.channel) connJson.channelId = conn.channel;

        connections.push(connJson);
    }

    fs.writeFileSync('./serverdata/connections.json', JSON.stringify(connections), 'utf-8');
}

module.exports = { restoreConnections };