import { ComponentType, PermissionsBitField, User } from 'discord.js';
import keys from '../utilities/keys.js';
import rootLogger from '../utilities/logger/logger.js';
import features from '../utilities/logger/features.js';

export default class Component {

    /**
     * @typedef {Object} ComponentOptions
     * @property {string} id - The first part of the components' custom ID.
     * @property {keyof typeof InteractionType & ComponentType} type - The type of interaction this component is for.
     * @property {PermissionsBitField|bigint|bigint[]} [permissions] - The permissions required to use this component.
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
         * The type of interaction or component this component is for.
         * @type {InteractionType & ComponentType}
         */
        this.type = options.type;

        /**
         * The permissions required to use this component.
         * @type {?PermissionsBitField}
         */
        this.permissions = options.permissions != null ? new PermissionsBitField(options.permissions) : null;

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
     * Validates the interaction, creates a child logger, <>and delegates to {@link run}.
     * @param {(import('discord.js').MessageComponentInteraction | import('discord.js').ModalSubmitInteraction) & TranslatedResponses} interaction - The component or modal interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @returns {Promise<?boolean>|?boolean}
     */
    async execute(interaction, client) {
        const logger = rootLogger.child({
            feature: features.components[this.id],
            guildId: interaction.guildId,
            userId: interaction.user.id,
        }, { track: false });

        logger.debug(`Component ${this.id} clicked`);
        if(this.defer) await interaction.deferUpdate();

        if(this.permissions) {
            const memberPerms = interaction.member.permissionsIn(interaction.channel);
            if(!memberPerms.has(this.permissions)) {
                const missingPermission = this.permissions.toArray().find(perm => !memberPerms.has(perm));
                await interaction.editReplyTl(keys.api.component.no_access.no_permission, { permission: missingPermission });
                return false;
            }
        }

        if(this.author) {
            if(this.author.id !== interaction.user.id) {
                await interaction.editReplyTl(keys.api.component.no_access.no_author);
                return false;
            }
        }

        if(this.sku && !interaction.entitlements.find(e => e.skuId === this.sku)) {
            if(process.env.NODE_ENV === 'production') {
                await interaction.editReplyTl(keys.commands.customize.warnings.no_entitlement);
                return false;
            }
        }

        return this.run(interaction, client, logger);
    }

    /**
     * Implements the component's specific logic.
     * @param {(import('discord.js').MessageComponentInteraction | import('discord.js').ModalSubmitInteraction) & TranslatedResponses} interaction - The component or modal interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @param {import('pino').Logger} logger - A child logger bound to this execution.
     * @returns {Promise<?boolean>|?boolean}
     * @abstract
     */
    async run(interaction, client, logger) {
        throw new Error(`The run method has not been implemented for the ${this.id} component.`);
    }
}
