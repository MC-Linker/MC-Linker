export default {
    ServerConnection: {
        _id: { type: String },
        ip: String,
        version: Number,
        path: String,
        worldPath: String,
        online: Boolean,
        forceOnlineMode: Boolean,
        floodgatePrefix: String,
        requiredRoleToJoin: { method: { type: String, enum: ['all', 'any'] }, roles: [String] },
        displayIp: String,
        port: Number,
        hash: String,
        chatChannels: [{
            _id: { type: String },
            types: [{
                type: String,
                enum: ['chat', 'join', 'quit', 'advancement', 'death', 'player_command', 'console_command', 'block_command', 'start', 'close'],
            }],
            allowDiscordToMinecraft: Boolean,
            webhook: String,
        }],
        statChannels: [{
            _id: { type: String },
            type: { type: String, enum: ['online', 'max', 'members'] },
            names: {
                online: String,
                offline: String,
                members: String,
            },
        }],
        syncedRoles: [{
            _id: { type: String },
            name: String,
            isGroup: Boolean,
            players: [String],
        }],
        serverSettings: { type: String, ref: 'ServerSettingsConnections' },
    },
    ServerSettingsConnection: {
        _id: { type: String },
        disabled: {
            advancements: [String],
            stats: [String],
            chatCommands: [String],
        },
        language: String,
        server: { type: String, ref: 'ServerConnection' },
    },
    UserConnection: {
        _id: { type: String },
        uuid: { type: String, unique: true },
        username: String,
        userSettings: { type: String, ref: 'UserSettingsConnection' },
        customBot: { type: String, ref: 'CustomBotConnection' },
    },
    UserSettingsConnection: {
        _id: { type: String },
        tokens: {
            accessToken: String,
            refreshToken: String,
            expires: Number,
        },
        user: { type: String, ref: 'UserConnection' },
    },
    CustomBotConnection: {
        _id: { type: String },
        port: Number,
        ownerId: String,
    },
};