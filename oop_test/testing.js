const MCLinker = require('./structures/MCLinker');

const client = new MCLinker();

(async () => {

    /** @type {UserConnectionData} */
    const userData1 = {
        id: '1',
        username: 'user1',
        uuid: '1',
    };

    /** @type {UserConnectionData} */
    const userData2 = {
        id: '987654321',
        username: 'Test User 2',
        uuid: '987654321',
    };

    /** @type {PluginServerConnectionData} */
    const serverData1 = {
        id: '123456789',
        ip: '123.456.789.0',
        port: 25565,
        version: 14,
        path: './world',
        hash: '123456789',
        online: true,
        chat: false,
        protocol: 'plugin',
    };

    const userConnection = await client.userConnections.connect(userData1);

    await new Promise(r => setTimeout(r, 100000));
})();
