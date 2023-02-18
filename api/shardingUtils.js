import ServerConnectionManager from '../structures/ServerConnectionManager.js';
import UserSettingsConnectionManager from '../structures/UserSettingsConnectionManager.js';
import ServerSettingsConnectionManager from '../structures/ServerSettingsConnectionManager.js';
import UserConnectionManager from '../structures/UserConnectionManager.js';
import UserSettingsConnection from '../structures/UserSettingsConnection.js';
import ServerSettingsConnection from '../structures/ServerSettingsConnection.js';
import UserConnection from '../structures/UserConnection.js';
import ServerConnection from '../structures/ServerConnection.js';

export function getManagerString(manager) {
    if(manager instanceof ServerConnectionManager) return 'serverConnections';
    else if(manager instanceof UserConnectionManager) return 'userConnections';
    else if(manager instanceof ServerSettingsConnectionManager) return 'serverSettingsConnections';
    else if(manager instanceof UserSettingsConnectionManager) return 'userSettingsConnections';
    else return null;
}

export function getManagerStringFromConnection(connection) {
    if(connection instanceof ServerConnection) return 'serverConnections';
    else if(connection instanceof UserConnection) return 'userConnections';
    else if(connection instanceof ServerSettingsConnection) return 'serverSettingsConnections';
    else if(connection instanceof UserSettingsConnection) return 'userSettingsConnections';
    else return null;
}