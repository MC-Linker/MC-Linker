const fs = require('fs/promises');
const utils = require('./utils');

function disable(guildId, type, value) {
    return new Promise(async resolve => {
        const disableBaseData = {
            advancements: [],
            stats: [],
            commands: [],
        };

        if(!await utils.isGuildConnected(guildId)) {
            try {
                //Create connection folder with disable json
                await fs.mkdir(`./serverdata/connections/${guildId}`);
                await fs.writeFile(`./serverdata/connections/${guildId}/disable.json`, JSON.stringify(disableBaseData, null, 2), 'utf-8');
            } catch(err) {
                console.log('Error creating disable folder/file', err);
                resolve(false);
                return;
            }
        }

        let disableData;
        try {
            disableData = JSON.parse(await fs.readFile(`./serverdata/connections/${guildId}/disable.json`, 'utf-8'));
        } catch(err) {
            if(err.code === 'ENOENT') disableData = disableBaseData;
            else {
                console.log('Couldn\'t read disable json', err);
                resolve(false);
            }
        }

        //Add disable
        if(!disableData) disableData = disableBaseData;
        if(!disableData[type]) return resolve(false);
        //If already disabled, return success
        if(disableData[type].find(disable => disable === value)) return resolve(true);
        disableData[type].push(value);

        try {
            await fs.writeFile(`./serverdata/connections/${guildId}/disable.json`, JSON.stringify(disableData, null, 2), 'utf-8');
            resolve(true);
        } catch(err) {
            console.log('Couldn\'t write disable json', err);
            resolve(false);
        }
    });
}

function enable(guildId, type, value) {
    return new Promise(async resolve => {

        if(!await utils.isGuildConnected(guildId)) return resolve(false);

        let disableData;
        try {
            disableData = JSON.parse(await fs.readFile(`./serverdata/connections/${guildId}/disable.json`, 'utf-8'));
        } catch(err) {
            console.log('Couldn\'t read disable json', err);
            resolve(false);
        }

        //Remove disable
        const enableIndex = disableData[type].findIndex(disable => disable === value);
        if(enableIndex === -1) return resolve(false);
        disableData[type].splice(enableIndex, 1);

        try {
            await fs.writeFile(`./serverdata/connections/${guildId}/disable.json`, JSON.stringify(disableData, null, 2), 'utf-8');
            resolve(true);
        } catch(err) {
            console.log('Couldn\'t write disable json', err);
            resolve(false);
        }
    });
}

function isDisabled(guildId, type, value) {
    return new Promise(async resolve => {
        if(!await utils.isGuildConnected(guildId)) return resolve(false);

        let disableData = await getDisabled(guildId, type);
        if(!disableData) return resolve(false);

        if(disableData.find(disable => disable === value)) return resolve(true);
        else return resolve(false);
    });
}

function getDisabled(guildId, type) {
    return new Promise(resolve => {
        fs.readFile(`./serverdata/connections/${guildId}/disable.json`, 'utf-8')
            .then(data => {
                data = JSON.parse(data)[type];
                resolve(data);
            }).catch(ignored => {
                resolve(false);
            });
    });
}


module.exports = { disable, enable, getDisabled, isDisabled };