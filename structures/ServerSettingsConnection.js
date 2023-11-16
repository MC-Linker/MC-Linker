import Connection from './Connection.js';

export default class ServerSettingsConnection extends Connection {

    /** @type {Omit<ServerSettingsConnectionData, 'id'>} */
    static defaultSettingsData = {
        disabled: {
            advancements: [],
            stats: [],
            chatCommands: [],
        },
        language: 'en_us',
    };

    /**
     * @typedef {object} ServerSettingsConnectionData - The data for the server settings.
     * @property {DisableData} disabled - The data for disabled commands, advancements or stats.
     * @property {string} language - The language code id this server uses.
     * @property {string} id - The id of the server the settings are connected to.
     */

    /**
     * @typedef {object} DisableData - The data for disabled commands, advancements or stats.
     * @property {string[]} advancements - The disabled advancements.
     * @property {string[]} stats - The disabled stats.
     * @property {string[]} chatCommands - The disabled chatchannel-commands.
     */

    /**
     * @typedef {ServerSettingsConnection|string} ServerSettingsConnectionResolvable - Data that resolves to a ServerSettingsConnection object.
     */

    /**
     * @param {MCLinker} client - The client to create the settings for.
     * @param {ServerSettingsConnectionData|string} dataOrId - The data for the settings or the id of the server, the settings are connected to.
     * @param {CollectionName} collectionName - The name of the database collection that this connection is stored in.
     * @returns {ServerSettingsConnection} - A new ServerSettingsConnection instance.
     */
    constructor(client, dataOrId, collectionName = 'ServerSettingsConnection') {
        super(client, dataOrId, collectionName);

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
        this.disabled = data.disabled ?? this.disabled;
    }

    /**
     * Disables a command, advancement or stat.
     * @param {keyof DisableData} type - The type of the value to disable.
     * @param {string} value - The value to disable.
     * @returns {Promise<?ServerSettingsConnection>} - The settings instance that has been edited.
     */
    async disable(type, value) {
        const currentValues = this.disabled[type];
        if(!currentValues.includes(value)) {
            currentValues.push(value);
            this.disabled[type] = currentValues;
            return await this.edit({ disabled: this.disabled });
        }
        return this;
    }

    /**
     * Enables a command, advancement or stat.
     * @param {keyof DisableData} type - The type of the value to enable.
     * @param {string} value - The value to enable.
     * @returns {Promise<ServerSettingsConnection>}
     */
    async enable(type, value) {
        const currentValues = this.disabled[type];
        if(currentValues.includes(value)) return this;
        const index = currentValues.indexOf(value);
        if(index !== -1) currentValues.splice(index, 1);

        this.disabled[type] = currentValues;
        return await this.edit({ disabled: this.disabled });
    }

    /**
     * Checks whether a command, advancement or stat is disabled.
     * @param {keyof DisableData} type - The type of the value to check.
     * @param {string} value - The value to check.
     * @returns {boolean}
     */
    isDisabled(type, value) {
        if(!this.disabled[type]) return false;
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
