import fs from 'fs-extra';
import _ from 'lodash';

convertKeys();

function convertKeys() {
    const languages = fs.readdirSync('../resources/languages/flat');

    languages.forEach(lang => {
        const keys = fs.readJsonSync(`../resources/languages/flat/${lang}`, 'utf-8');

        const converted = {};
        for(const [key, value] of Object.entries(keys)) {
            _.set(converted, key, value);
        }


        fs.outputJsonSync(`../resources/languages/expanded/${lang}`, converted, { spaces: 2 });
    });
}
