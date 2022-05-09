const fs = require('fs-extra');
const lodash = require('lodash');

convertKeys();

function convertKeys() {
    const languages = fs.readdirSync('../resources/languages/flat');

    languages.forEach(lang => {
        const keys = fs.readJsonSync(`../resources/languages/flat/${lang}`, 'utf-8');

        const converted = {};
        for([key, value] of Object.entries(keys)) {
            lodash.set(converted, key, value);
        }


        fs.writeJsonSync(`../resources/languages/expanded/${lang}`, converted, { spaces: 2 });
    });
}