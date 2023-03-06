// Converts old server- and user data to the new format.
import fs from 'fs-extra';

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
    if(newConnection.protocol === 'plugin') {
        newConnection.protocol = 'http';
        newConnection.token = newConnection.hash;
        delete newConnection.hash;
        console.log('Converted plugin to http protocol.');
    }

    fs.outputJsonSync(`./serverdata/connections/${folder}/connection.json`, newConnection, { spaces: 2 });
    console.log(`Finished converting server ${folder}!`);
    console.groupEnd();
}
