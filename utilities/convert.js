// Converts old server- and user data to the new format.
import fs from 'fs-extra';

const serverFolders = fs.readdirSync('./serverdata/connections');
for(const folder of serverFolders) {
    console.group(`Converting server ${folder}...`);
    if(!fs.existsSync(`./serverdata/connections/${folder}/settings.json`)) {
        console.log('No settings.json found, skipping.');
        console.groupEnd();
        continue;
    }
    const connection = fs.readJsonSync(`./serverdata/connections/${folder}/settings.json`);
    const newConnection = { ...connection };

    console.log('Old Disable:', connection.disabled);
    newConnection.disabled = {
        'bot-commands': connection.commands,
        'stats': connection.stats,
        'advancements': connection.advancements,
        'chat-commands': [],
    };
    console.log('New Disabled:', newConnection.disabled);

    fs.writeJsonSync(`./serverdata/connections/${folder}/settings.json`, newConnection, { spaces: 2 });
    console.log(`Converted server ${folder}!`);
    console.groupEnd();
}
