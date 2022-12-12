// Converts old server- and user data to the new format.
import fs from 'fs-extra';
import path from 'path';

const serverFolders = fs.readdirSync('./serverdata/connections');
for(const folder of serverFolders) {
    console.group(`Converting server ${folder}...`);
    if(!fs.existsSync(`./serverdata/connections/${folder}/connection.json`)) {
        console.log('No connection.json found, skipping.');
        console.groupEnd();
        continue;
    }
    const connection = fs.readJsonSync(`./serverdata/connections/${folder}/connection.json`);
    const newConnection = { ...connection };
    if(connection.worldPath) {
        console.log('World path found, skipping.');
        console.groupEnd();
        continue;
    }

    console.log('Old Path:', connection.path);
    connection.path = decodeURIComponent(connection.path);
    newConnection.worldPath = connection.path;
    newConnection.path = path.dirname(connection.path);
    console.log('New Paths:', { path: newConnection.path, worldPath: newConnection.worldPath });

    fs.writeJsonSync(`./serverdata/connections/${folder}/connection.json`, newConnection, { spaces: 2 });
    console.log(`Converted server ${folder}!`);
    console.groupEnd();
}
