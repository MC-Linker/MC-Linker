const MCLinker = require('./structures/MCLinker');
const Protocol = require('./structures/Protocol');

const client = new MCLinker();

(async () => {

    /** @type {UserConnectionData} */
    const userData1 = {
        id: '123456789',
        username: 'user1',
        uuid: 'f134e0bb-eb3e-4714-8c88-c13a35f694cc',
    };

    /** @type {UserConnectionData} */
    const userData2 = {
        id: '987654321',
        username: 'Test User 2',
        uuid: '987654321-1234-1234-1234-123456789012',
    };

    /** @type {PluginServerConnectionData} */
    const serverData1 = {
        id: '123456789',
        ip: '192.168.124.134',
        port: 25565,
        version: 14,
        path: './world',
        hash: '123456789',
        online: true,
        chat: false,
        protocol: 'plugin',
    };

    /** @type {FtpServerConnectionData} */
    const serverData2 = {
        id: '987654321',
        ip: 'HOST',
        port: 21,
        username: 'USER',
        password: 'PASS',
        path: '/minecraftbukkit/survival',
        online: false,
        version: 19,
        protocol: 'ftp',
    };

    const userConnection1 = await client.userConnections.connect(userData1);
    const serverConnection2 = await client.serverConnections.connect(serverData2);

    const advancements = await serverConnection2.protocol.get(Protocol.FilePath.Advancements(serverConnection2.path, userConnection1.uuid), './files/advancements.json');
    console.log('Advancements', advancements);
    const stats = await serverConnection2.protocol.get(Protocol.FilePath.Stats(serverConnection2.path, userConnection1.uuid), './files/stats.json');
    console.log('Stats', stats);
    const playerdata = await serverConnection2.protocol.get(Protocol.FilePath.PlayerData(serverConnection2.path, userConnection1.uuid), './files/playerdata.dat');
    console.log('PlayerData', playerdata);

    await new Promise(r => setTimeout(r, 100000));
})();
