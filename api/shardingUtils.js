//The following checks use `Object.constructor.name` to determine the type of the object.
//A better way to do this would be to use `instanceof`. However, this is not possible because importing the classes would create circular dependencies.
export function getManagerString(manager) {
    if(manager.constructor.name === 'ServerConnectionManager') return 'serverConnections';
    else if(manager.constructor.name === 'UserConnectionManager') return 'userConnections';
    else if(manager.constructor.name === 'ServerSettingsConnectionManager') return 'serverSettingsConnections';
    else if(manager.constructor.name === 'UserSettingsConnectionManager') return 'userSettingsConnections';
    else return null;
}

export function getManagerStringFromConnection(connection) {
    if(connection.constructor.name === 'ServerConnection') return 'serverConnections';
    else if(connection.constructor.name === 'UserConnection') return 'userConnections';
    else if(connection.constructor.name === 'ServerSettingsConnection') return 'serverSettingsConnections';
    else if(connection.constructor.name === 'UserSettingsConnection') return 'userSettingsConnections';
    else return null;
}