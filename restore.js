//Restores the connection.json from all connection files.
const fs = require('fs');
const plugin = require('./api/plugin');

if(process.argv.slice(2)[0] === '--reverse' ) restoreFromConnections();
else restoreFromFiles();

function restoreFromFiles() {
    const serverConnectionFiles = fs.readdirSync('./connections/servers');

    const connections = [];
    for (const server of serverConnectionFiles) {
        if(server === 'GitInit') continue;
        console.log(`Restoring ${server}...`);

        const conn = JSON.parse(fs.readFileSync(`./connections/servers/${server}`, 'utf-8'));

        const connJson = {
            "guildId": conn.guild,
            "hash": conn.hash,
            "chat": conn.chat,
            "ip": conn.ip
        }
        if(conn.channel) connJson.channelId = conn.channel;

        connections.push(connJson);
    }

    fs.writeFileSync('./connections/connections.json', JSON.stringify(connections), 'utf-8');
}

//DEPRECATED
async function restoreFromConnections() {
    const serverConnections = JSON.parse(fs.readFileSync('./connections/connections.json', 'utf-8'));

    const message = {};
    message.reply = () => {};
    for (const conn of serverConnections) {
        console.log(`Restoring ${conn.ip}...`);

        //Reconnect using existing data
        const connResp = await plugin.connect(conn.ip, conn.guildId, undefined, undefined, message);
        if(!connResp) {
            console.log(`Couldn\'t connect to ${conn.ip}!`);
            continue;
        }

        const connJson = {
            "ip": connResp.ip,
            "version": connResp.version.split('.')[1],
            "path": decodeURIComponent(connResp.path),
            "hash": connResp.hash,
            "guild": connResp.guild,
            "chat": false,
            "protocol": "plugin"
        }

        fs.writeFileSync(`./connections/servers/${conn.guildId}.json`, JSON.stringify(connJson, null, 2), 'utf-8');
    }
}


module.exports = { restoreFromFiles, restoreFromConnections };