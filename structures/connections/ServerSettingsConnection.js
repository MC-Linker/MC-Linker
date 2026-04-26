import Connection from './Connection.js';

export default class ServerSettingsConnection extends Connection {

    /** @type {Omit<ServerSettingsConnectionData, 'id'>} */
    static defaultSettingsData = {
        filteredCommands: [],
        language: 'en_us',
    };

    /**
     * @typedef {object} ServerSettingsConnectionData - The data for the server settings.
     * @property {string[]} filteredCommands - Command filters for Minecraft -> Discord command messages.
     * @property {string} language - The language code id this server uses.
     * @property {string} id - The id of the server the settings are connected to.
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
         * Command filters for Minecraft -> Discord command messages.
         * @type {string[]}
         */
        this.filteredCommands = data.filteredCommands ?? data.disabled?.chatCommands ?? this.filteredCommands ?? [];
    }

    /**
     * Normalizes a command value by removing leading slashes, trimming whitespace, and converting to lowercase.
     * @private
     */
    _normalizeCommandValue(value) {
        return value.replace(/^\//, '').trim().toLowerCase();
    }

    /**
     * Adds a command filter for Minecraft -> Discord command messages.
     * @param {string} value - The command/prefix to filter.
     * @returns {Promise<?ServerSettingsConnection>} - The settings instance that has been edited.
     */
    async addFilteredCommand(value) {
        // Replace leading slash and trim
        const normalizedValue = this._normalizeCommandValue(value);
        const hasNormalizedMatch = this.filteredCommands.some(command => command === normalizedValue);
        if(!hasNormalizedMatch) {
            this.filteredCommands.push(normalizedValue);
            return await this.edit({ filteredCommands: this.filteredCommands });
        }
        return this;
    }

    /**
     * Removes a command filter for Minecraft -> Discord command messages.
     * @param {string} value - The command/prefix to unfilter.
     * @returns {Promise<ServerSettingsConnection>}
     */
    async removeFilteredCommand(value) {
        const normalizedValue = this._normalizeCommandValue(value);

        const nextValues = this.filteredCommands.filter(command => command !== normalizedValue);
        if(nextValues.length === this.filteredCommands.length) return this;

        return await this.edit({ filteredCommands: nextValues });
    }

    /**
     * Checks whether a command message should be filtered.
     * A filter matches when the message equals the filter or starts with the filter followed by a space.
     * @param {string} value - The command message (without leading slash).
     * @returns {boolean}
     */
    isFilteredCommand(value) {
        const normalizedValue = this._normalizeCommandValue(value);
        if(!normalizedValue) return false;

        return this.filteredCommands.some(command => normalizedValue === command || normalizedValue.startsWith(`${command} `));
    }

    getData() {
        return {
            filteredCommands: this.filteredCommands,
            language: this.language,
            id: this.id,
        };
    }
}
