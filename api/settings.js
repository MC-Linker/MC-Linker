const fs = require('fs-extra');
const utils = require('./utils');
const { keys, addPh, ph } = require('./messages');

function disable(guildId, type, value) {
    return new Promise(async resolve => {
        const disableBaseData = {
            advancements: [],
            stats: [],
            commands: [],
        };

        let disableData;
        try {
            disableData = await fs.readJson(`./serverdata/connections/${guildId}/disable.json`, 'utf-8');
        }
        catch(err) {
            if(err.code === 'ENOENT') disableData = disableBaseData;
            else {
                console.log(addPh(keys.api.settings.errors.could_not_read_file.console, ph.error(err)));
                resolve(false);
                return;
            }
        }

        //Add disable
        if(!disableData) disableData = disableBaseData;
        if(!disableData[type]) return resolve(false);
        //If already disabled, return success
        if(disableData[type].find(disable => disable === value)) return resolve(true);
        disableData[type].push(value);

        try {
            await fs.outputJson(`./serverdata/connections/${guildId}/disable.json`, disableData, { spaces: 2 });
            resolve(true);
        }
        catch(err) {
            console.log(addPh(keys.api.settings.errors.could_not_write_file.console, ph.error(err)));
            resolve(false);
        }
    });
}

function enable(guildId, type, value) {
    return new Promise(async resolve => {
        let disableData;
        try {
            disableData = await fs.readJson(`./serverdata/connections/${guildId}/disable.json`, 'utf-8');
        }
        catch(err) {
            console.log(addPh(keys.api.settings.errors.could_not_read_file.console, ph.error(err)));
            resolve(false);
            return;
        }

        //Remove disable
        const enableIndex = disableData[type].findIndex(disable => disable === value);
        if(enableIndex === -1) return resolve(false);
        disableData[type].splice(enableIndex, 1);

        try {
            await fs.outputJson(`./serverdata/connections/${guildId}/disable.json`, disableData, { spaces: 2 });
            resolve(true);
        }
        catch(err) {
            console.log(addPh(keys.api.settings.errors.could_not_write_file.console, ph.error(err)));
            resolve(false);
        }
    });
}

function isDisabled(guildId, type, value) {
    return new Promise(async resolve => {
        if(!await utils.isGuildConnected(guildId)) return resolve(false);

        let disableData = await getDisabled(guildId, type);

        if(disableData.find(disable => disable === value)) return resolve(true);
        else return resolve(false);
    });
}

function getDisabled(guildId, type) {
    return new Promise(resolve => {
        fs.readJson(`./serverdata/connections/${guildId}/disable.json`, 'utf-8')
            .then(data => resolve(data[type]))
            .catch(() => resolve([]));
    });
}


module.exports = { disable, enable, getDisabled, isDisabled };