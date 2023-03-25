import Connection from './Connection.js';

export default class ServerSettingsConnection extends Connection {

    /** @type {Omit<ServerSettingsConnectionData, 'id'>} */
    static defaultSettingsData = {
        disabled: {
            'bot-commands': [],
            advancements: [],
            stats: [],
            'chat-commands': [],
        },
        language: 'en_us',
        statsChannels: [],
    };

    /**
     * @typedef {object} ServerSettingsConnectionData - The data for the server settings.
     * @property {DisableData} disabled - The data for disabled commands, advancements or stats.
     * @property {string} language - The language code id this server uses.
     * @property {string} id - The id of the server the settings are connected to.
     */

    /**
     * @typedef {object} DisableData - The data for disabled commands, advancements or stats.
     * @property {string[]} bot-commands - The disabled bot-commands.
     * @property {string[]} advancements - The disabled advancements.
     * @property {string[]} stats - The disabled stats.
     * @property {string[]} chat-commands - The disabled chatchannel-commands.
     */

    /**
     * @typedef {ServerSettingsConnection|string} ServerSettingsConnectionResolvable - Data that resolves to a ServerSettingsConnection object.
     */

    /**
     * @param {MCLinker} client - The client to create the settings for.
     * @param {ServerSettingsConnectionData|string} dataOrId - The data for the settings or the id of the server the settings are connected to.
     * @param {string} outputPath - The path to write the settings to.
     * @param {string} [outputFile='settings.json'] - The name of the file to write the settings to.
     * @returns {ServerSettingsConnection} - A new ServerSettingsConnection instance.
     */
    constructor(client, dataOrId, outputPath, outputFile = 'settings.json') {
        if(typeof dataOrId === 'string') {
            //Default settings data
            dataOrId = {
                ...ServerSettingsConnection.defaultSettingsData,
                id: dataOrId,
            };
        }
        super(client, dataOrId, outputPath, outputFile);

        this._patch(dataOrId);
    }

    _patch(data) {
        if(typeof data === 'string') {
            //Default settings data
            data = {
                ...ServerSettingsConnection.defaultSettingsData,
                id: data,
            };
        }

        /**
         * The id of the server the settings are connected to.
         * @type {string}
         */
        this.id = data.id ?? this.id;

        /**
         * The language code id this server uses.
         * @type {string}
         */
        this.language = data.language ?? this.language;

        /**
         * The data for disabled commands, advancements or stats.
         * @type {DisableData}
         */
        this.disabled ??= ServerSettingsConnection.defaultSettingsData.disabled;

        //Loop over data.disabled and assign commands, advancements and stats to this.disabled
        if('disabled' in data) {
            if('bot-commands' in data.disabled) {
                this.disabled['bot-commands'] = data.disabled['bot-commands'];
            }
            if('advancements' in data.disabled) {
                this.disabled.advancements = data.disabled.advancements;
            }
            if('stats' in data.disabled) {
                this.disabled.stats = data.disabled.stats;
            }
            if('chat-commands' in data.disabled) {
                this.disabled['chat-commands'] = data.disabled['chat-commands'];
            }
        }
    }

    /**
     * Disables a command, advancement or stat.
     * @param {'bot-commands'|'advancements'|'stats'|'chat-commands'} type - The type of the value to disable.
     * @param {string} value - The value to disable.
     * @returns {Promise<?ServerSettingsConnection>} - The settings instance that has been edited.
     */
    async disable(type, value) {
        const currentValues = this.disabled[type];
        if(!currentValues.includes(value)) {
            currentValues.push(value);
            return await this.edit({ [type]: [currentValues] });
        }
        return this;
    }

    /**
     * Enables a command, advancement or stat.
     * @param {'bot-commands'|'advancements'|'stats'|'chat-commands'} type - The type of the value to enable.
     * @param {string} value - The value to enable.
     * @returns {Promise<ServerSettingsConnection>}
     */
    async enable(type, value) {
        const currentValues = this.disabled[type];
        const index = currentValues.indexOf(value);
        if(index !== -1) currentValues.splice(index, 1);
        return await this.edit({ [type]: [currentValues] });
    }

    /**
     * Checks whether a command, advancement or stat is disabled.
     * @param {'bot-commands'|'advancements'|'stats'|'chat-commands'} type - The type of the value to check.
     * @param {string} value - The value to check.
     * @returns {boolean}
     */
    isDisabled(type, value) {
        return this.disabled[type].includes(value);
    }

    /**
     * @inheritDoc
     */
    getData() {
        return {
            disabled: this.disabled,
            language: this.language,
            id: this.id,
        };
    }
}
