import fs from 'fs-extra';


/**
 * Migrates old server- and user data to the mongodb database
 * @param {MCLinker} client - The client instance
 */
export async function migrate(client) {
    const serverFolders = fs.readdirSync('./serverdata/connections');
    for (const folder of serverFolders) {
        if (!fs.existsSync(`./serverdata/connections/${folder}/connection.json`)) {
            console.log(`No connection.json found in ${folder}`);
            continue;
        }
        const server = JSON.parse(fs.readFileSync(`./serverdata/connections/${folder}/connection.json`, 'utf8'));
        if (typeof server.version === 'string') server.version = parseInt(server.version.split('.')[1] ?? 19);
        await client.serverConnections.connect(server);
        console.log(`Connected server ${server.id}`);

        if (!fs.existsSync(`./serverdata/connections/${folder}/settings.json`)) {
            console.log(`No settings.json found in ${folder}`);
            continue;
        }
        const serverSettings = JSON.parse(fs.readFileSync(`./serverdata/connections/${folder}/settings.json`, 'utf8'));
        await client.serverSettingsConnections.connect(serverSettings);
        console.log(`Connected server settings ${server.id}`);
    }

    const userFolders = fs.readdirSync('./userdata/connections');
    for (const folder of userFolders) {
        if (!fs.existsSync(`./userdata/connections/${folder}/connection.json`)) {
            console.log(`No connection.json found in ${folder}`);
            continue;
        }
        const user = JSON.parse(fs.readFileSync(`./userdata/connections/${folder}/connection.json`, 'utf8'));
        await client.userConnections.connect(user);
        console.log(`Connected user ${user.id}`);

        if (!fs.existsSync(`./userdata/connections/${folder}/settings.json`)) {
            console.log(`No settings.json found in ${folder}`);
            continue;
        }
        const userSettings = JSON.parse(fs.readFileSync(`./userdata/connections/${folder}/settings.json`, 'utf8'));
        await client.userSettingsConnections.connect(userSettings);
        console.log(`Connected user settings ${user.id}`);
    }
}
