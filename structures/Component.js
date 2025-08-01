import { PermissionsBitField, User } from 'discord.js';
import { ph } from '../utilities/messages.js';
import keys from '../utilities/keys.js';

export default class Component {

    /**
     * @typedef {Object} ComponentOptions
     * @property {string} id - The first part of the components' custom ID.
     * @property {InteractionType} interactionType - The type of interaction this component is for.
     * @property {PermissionsBitField} [permissions] - The permissions required to use this component.
     * @property {User} [author] - The author of this component that is allowed to use it.
     * @property {boolean} [ephemeral=false] - Whether this component should be ephemeral.
     * @property {boolean} [defer=true] - Whether this component should be deferUpdated.
     * @property {?string} [sku] - The SKU required to use this component.
     */

    /**
     * Creates a new Component instance.
     * @param {ComponentOptions} options - The options for this command.
     */
    constructor(options) {

        /**
         * The (first part of the) components' custom ID.
         * @type {string}
         */
        this.id = options.id;

        /**
         * The type of interaction this component is for.
         * @type {InteractionType}
         */
        this.interactionType = options.interactionType;

        /**
         * The permissions required to use this component.
         * @type {PermissionsBitField}
         */
        this.permissions = options.permissions;

        /**
         * The author of this component that is allowed to use it.
         * @type {User}
         */
        this.author = options.author;

        /**
         * Whether this component should be ephemeral.
         * @type {boolean|boolean}
         */
        this.ephemeral = options.ephemeral ?? true;

        /**
         * Whether this component should be deferUpdated.
         * @type {boolean|boolean}
         */
        this.defer = options.defer ?? true;

        /**
         * The SKU required to use this component.
         * @type {?string}
         */
        this.sku = options.sku ?? null;
    }

    /**
     * Handles the execution of this component.
     * @param {import('discord.js').MessageComponentInteraction & TranslatedResponses} interaction - The component interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @returns {Promise<?boolean>|?boolean}
     * @abstract
     */
    async execute(interaction, client) {
        await interaction.replyTl(keys.api.component.clicked, { 'button_id': interaction.customId }, ph.std(interaction));
        if(this.defer) await interaction.deferUpdate();

        if(this.permissions) {
            const memberPerms = interaction.member.permissionsIn(interaction.channel);
            if(!memberPerms.has(this.permissions)) {
                const missingPermission = this.permissions.toArray().find(perm => !memberPerms.has(perm));
                await interaction.replyTl(keys.api.component.no_access.no_permission, { permission: missingPermission });
                return false;
            }
        }

        if(this.author) {
            if(this.author.id !== interaction.user.id) {
                await interaction.replyTl(keys.api.component.no_access.no_author);
                return false;
            }
        }

        if(this.sku && !interaction.entitlements.find(e => e.skuId === this.sku)) {
            if(process.env.NODE_ENV === 'production' && (await client.application.fetchSKUs()).size) {
                await interaction.replyTl(keys.entitlements.warnings.no_entitlement);
                return false;
            }
        }

        return true;
    }
}
