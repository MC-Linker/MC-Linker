import Button from '../structures/Button.js';
import keys from '../utilities/keys.js';
import { getModal, getReplyOptions } from '../utilities/messages.js';

export default class EntitlementsDetailsButton extends Button {

    constructor() {
        super({ id: 'entitlements_details', defer: false });
    }

    async execute(interaction, client) {
        //Send modal
        await interaction.showModal(getModal(keys.entitlements.success.details_modal));
        const modal = await interaction.awaitModalSubmit({ time: 300_000 });
        const secret = modal.fields.getTextInputValue('secret');
        const token = modal.fields.getTextInputValue('token');
        const id = modal.fields.getTextInputValue('id');
        console.log(secret, token, id);

        //Check if bot already exists and then ask if they want to change details

        // Stop
        // Ask for token and secret (optional) and discord server link

        // TODO Clone MC-Linker to ../../Custom-MC-Linker/<author_id>
        // TODO Edit .env (BOT_PORT, CLIENT_ID, CLIENT_SECRET, TOKEN, generate COOKIE_SECRET, LINKED_ROLES_REDIRECT_URI, SERVICE_NAME, DATABASE_URL)
        // Edit docker-compose.yml
        // Docker it up
        // Run slash command script

        //Check for errors (wrong token, secret etc)

        //Send success
        //For linked roles they'll have to add endpoints in the portal and provide the secret

        // Automated subdomain for them?
        // Tell them to change bot link in the plugin config

        return await interaction.update(getReplyOptions(keys.entitlements.success.finish)); //Add control buttons (start/stop, edit details)
    }
}