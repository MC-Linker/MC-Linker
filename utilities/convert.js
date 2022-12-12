// Converts old server- and user data to the new format.
import fs from 'fs-extra';
import path from 'path';

const serverFolders = fs.readdirSync('./serverdata/connections');
for(const folder of serverFolders) {
    console.group(`Converting server ${folder}...`);
    const connection = fs.readJsonSync(`./serverdata/connections/${folder}/connection.json`);
    const newConnection = { ...connection };

    console.log('Old Path:', connection.path);
    connection.path = decodeURIComponent(connection.path);
    newConnection.worldPath = connection.path;
    newConnection.path = path.dirname(connection.path);
    console.log('New Paths:', { path: newConnection.path, worldPath: newConnection.worldPath });

    fs.writeJsonSync(`./serverdata-new/connections/${folder}/connection.json`, newConnection, { spaces: 2 });
    console.log(`Converted server ${folder}!`);
    console.groupEnd();
}
