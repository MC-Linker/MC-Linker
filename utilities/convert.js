// Converts old server- and user data to the new format.
import fs from 'fs-extra';
import path from 'path';

const serverFolders = fs.readdirSync('./serverdata/connections');
for(const folder of serverFolders) {
    const connection = fs.readJsonSync(`./serverdata/connections/${folder}/connection.json`);

    const newConnection = { ...connection };

    connection.path = decodeURIComponent(connection.path);
    newConnection.worldPath = connection.path;
    newConnection.path = path.dirname(connection.path);

    fs.writeJsonSync(`./serverdata/connections/${folder}/connection.json`, newConnection, { spaces: 2 });
}
