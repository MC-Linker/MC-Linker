const fs = require('fs');
const lodash = require('lodash')

convertKeys();

function convertKeys() {
    const languages = fs.readdirSync('../languages/flat');

    languages.forEach(lang => {
        const keys = JSON.parse(fs.readFileSync(`../languages/flat/${lang}`, 'utf-8'));

        const converted = {};
        for([key, value] of Object.entries(keys)) {
            lodash.set(converted, key, value);
        }


        fs.writeFileSync(`../languages/expanded/${lang}`, JSON.stringify(converted, null, 2), 'utf-8');
    });
}

module.exports = { convertKeys };