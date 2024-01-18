import { ButtonInteraction, PermissionsBitField, User } from 'discord.js';
import { ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';

export default class Button {

    /**
     * @typedef {Object} ButtonOptions
     * @property {string} id - The first part of the button's custom ID.
     * @property {PermissionsBitField} [permissions] - The permissions required to use this button.
     * @property {User} [author] - The author of this button that is allowed to use it.
     * @property {boolean} [ephemeral=false] - Whether this button should be ephemeral.
     * @property {boolean} [defer=true] - Whether this button should be deferred.
     */

    /**
     * Creates a new Button instance.
     * @param {ButtonOptions} options - The options for this command.
     */
    constructor(options) {

        /**
         * The (first part of the) button's custom ID.
         * @type {string}
         */
        this.id = options.id;

        /**
         * The permissions required to use this button.
         * @type {PermissionsBitField}
         */
        this.permissions = options.permissions;

        /**
         * The author of this button that is allowed to use it.
         * @type {User}
         */
        this.author = options.author;

        /**
         * Whether this button should be ephemeral.
         * @type {boolean|boolean}
         */
        this.ephemeral = options.ephemeral ?? true;

        /**
         * Whether this button should be deferred.
         * @type {boolean|boolean}
         */
        this.defer = options.defer ?? true;
    }

    /**
     * Handles the execution of this button.
     * @param {ButtonInteraction & TranslatedResponses} interaction - The button interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @param {?ServerConnection} server - The connection of the server the command was executed in.
     * @returns {Promise<?boolean>|?boolean}
     * @abstract
     */
    async execute(interaction, client, server) {
        await interaction.replyTl(keys.api.button.clicked, { 'button_id': interaction.customId }, ph.std(interaction));
        if(this.defer) await interaction.deferReply({ ephemeral: this.ephemeral });

        if(this.permissions) {
            const memberPerms = interaction.member.permissionsIn(interaction.channel);
            if(!memberPerms.has(this.permissions)) {
                const missingPermission = this.permissions.toArray().find(perm => !memberPerms.has(perm));
                await interaction.replyTl(keys.api.button.no_access.no_permission, { permission: missingPermission });
                return false;
            }
        }

        if(this.author) {
            if(this.author.id !== interaction.user.id) {
                await interaction.replyTl(keys.api.button.no_access.no_author);
                return false;
            }
        }

        return true;
    }
}
