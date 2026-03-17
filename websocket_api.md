# MC-Linker WebSocket API

The MC-Linker project uses Socket.io for bi-directional communication between the Discord bot and Minecraft server
plugins.

## Connection

**URL:** `ws://api.mclinker.com:<port>`
**Transports:** `['websocket']`

### Authentication (Handshake)

Authentication is performed during the handshake using the `auth` object.

```javascript
const socket = io("ws://your-bot-ip:port", {
  auth: {
    token: "YOUR_SERVER_TOKEN",
    code: "GUILD_ID:VERIFICATION_CODE" // Required for new connections
  },
  query: {
    path: "/path/to/server",
    online: "true",
    version: "1.20.1",
    worldPath: "world",
    floodgatePrefix: "."
  }
});
```

---

## Response Format

All WebSocket responses (both directions) use a standardized envelope format:

### Success Response

```json
{
  "status": "success",
  "data": { ... }
}
```

### Error Response

```json
{
  "status": "error",
  "error": "error_code",
  "data": { ... }
}
```

| Field    | Type                     | Description                                                                           |
|----------|--------------------------|---------------------------------------------------------------------------------------|
| `status` | `"success"` \| `"error"` | Whether the operation succeeded or failed.                                            |
| `data`   | `any` (optional)         | Arbitrary payload. Present on success; optionally present on error for extra context. |
| `error`  | `string` (optional)      | A snake_case error code. Only present when `status` is `"error"`.                     |

### Error Codes

| Error Code             | Description                                                        |
|------------------------|--------------------------------------------------------------------|
| `unknown`              | Generic or unhandled error.                                        |
| `unauthorized`         | Wrong authorization credentials.                                   |
| `not_found`            | Requested resource, player, or file was not found.                 |
| `player_not_online`    | The targeted player is not online.                                 |
| `luckperms_not_loaded` | The LuckPerms plugin is not loaded on the server.                  |
| `no_response`          | The plugin did not respond (timeout or no connection).             |
| `invalid_json`         | Malformed JSON in event data.                                      |
| `rate_limited`         | Request was rate-limited. `data.retryMs` contains the delay in ms. |
| `server_error`         | Unhandled server-side error.                                       |
| `not_connected`        | The user is not connected/linked.                                  |

> **Note:** `null` is returned internally (not sent over the wire) when the WebSocket connection itself is unavailable
> or times out. This is distinct from the `no_response` error code.

---

## Events (Inbound to Bot)

### `chat`

Sends a game event (chat message, death, advancement, etc.) to Discord.

**Data Schema:**

```json
{
    "type": "chat | console | join | quit | death | advancement | player_command | console_command | block_command | start | close",
    "message": "The message content",
    "player": "Player Name (Optional, required for certain types)"
}
```

### `verify-user`

Registers a verification code for a user attempting to link their account.

**Data Schema:**

```json
{
  "code": "123456",
  "uuid": "player-uuid",
  "username": "PlayerName"
}
```

### `add-synced-role-member`

Adds a player to a synced Discord role.

**Data Schema:**

```json
{
  "id": "ROLE_ID",
  "uuid": "PLAYER_UUID"
}
```

### `remove-synced-role-member`

Removes a player from a synced Discord role.

**Data Schema:**

```json
{
  "id": "ROLE_ID",
  "uuid": "PLAYER_UUID"
}
```

### `remove-synced-role`

Removes a synced role configuration from the server.

**Data Schema:**

```json
{
  "id": "ROLE_ID"
}
```

### `has-required-role`

Checks if a player has the required Discord role to join the Minecraft server.

**Data Schema:**

```json
{
  "uuid": "PLAYER_UUID"
}
```

**Response (Callback):**

```json
{
  "status": "success",
  "data": { "hasRole": true }
}
```

```json
{
  "status": "error",
  "error": "not_connected"
}
```

### `invite-url`

Requests a Discord invite URL for the server.

**Response (Callback):**

```json
{
  "status": "success",
  "data": { "url": "https://discord.gg/..." }
}
```

### `update-stats-channels`

Updates Discord voice/text channels used for displaying server statistics.

**Data Schema:**

```json
{
  "event": "online | offline | members",
  "members": 10 // Required if event is 'members'
}
```

### `sync-synced-role-members`

Sent by the plugin after (re)connecting to synchronize synced role membership.
The bot diffs the received MC-side player list against Discord role membership, applies corrections based on the synced
role's direction, and responds with what the plugin still needs to change.

**Data Schema:**

```json
{
  "id": "ROLE_ID",
  "players": ["uuid1", "uuid2"]
}
```

| Field     | Type       | Description                                            |
|-----------|------------|--------------------------------------------------------|
| `id`      | `string`   | The Discord role ID of the synced role.                |
| `players` | `string[]` | Current player UUIDs in the team/group on the MC side. |

**Response (Callback):**

```json
{
  "status": "success",
  "data": {
    "added": ["uuid3"],
    "removed": ["uuid4"]
  }
}
```

| Field     | Type       | Description                                                                                            |
|-----------|------------|--------------------------------------------------------------------------------------------------------|
| `added`   | `string[]` | Players who have the Discord role but were NOT in the plugin's list — plugin should add to team/group. |
| `removed` | `string[]` | Players the plugin listed but who do NOT have the Discord role — plugin should remove from team/group. |

**Direction behavior:**

- `both`: Bot grants Discord role to MC-only players. `added` contains Discord-only players for plugin to add. `removed`
  is empty.
- `to_minecraft` (Discord→MC): Bot does not touch Discord roles. `added` = Discord-only players, `removed` = MC-only
  players (Discord is authoritative).
- `to_discord` (MC→Discord): Bot grants/revokes Discord roles to match MC. `added` and `removed` are empty (bot handles
  everything).

### `disconnect-force`

Asks the bot to forcefully close the connection for this server.

---

## Events (Outbound from Bot)

### `auth-success`

Emitted by the bot after a successful initial connection.

**Data Schema:**

```json
{
  "requiredRoleToJoin": { ... } | null
}
```

### `chat` (Outbound)

Sent to the plugin when a message is received in a linked Discord channel.
*(Note: Handled via the generic broadcast mechanism in `MCLinkerAPI.js`)*

### `add-synced-role`

Sends a new synced role configuration to the plugin.

**Data Schema:**

```json
{
  "id": "ROLE_ID",
  "name": "group-or-team-name",
  "isGroup": true,
  "direction": "both",
  "players": ["uuid1", "uuid2"]
}
```

**Response:** Returns all synced roles with their current player lists.

| Field       | Type       | Description                                                       |
|-------------|------------|-------------------------------------------------------------------|
| `id`        | `string`   | The Discord role ID.                                              |
| `name`      | `string`   | The LuckPerms group or Minecraft team name.                       |
| `isGroup`   | `boolean`  | `true` for LuckPerms group, `false` for Minecraft team.           |
| `direction` | `string`   | Sync direction: `"both"`, `"to_minecraft"`, or `"to_discord"`.    |
| `players`   | `string[]` | UUIDs of players currently in the group/team on the Discord side. |

### `remove-synced-role` (Outbound)

Tells the plugin to remove a synced role.

**Data Schema:**

```json
{
  "id": "ROLE_ID",
  "name": "group-or-team-name",
  "isGroup": true
}
```

**Response:** Returns remaining synced roles.

### `add-synced-role-member` (Outbound)

Tells the plugin to add a player to a synced group/team.

**Data Schema:**

```json
{
  "id": "ROLE_ID",
  "name": "group-or-team-name",
  "isGroup": true,
  "uuid": "PLAYER_UUID"
}
```

**Response:** Returns updated player list for the role.

### `remove-synced-role-member` (Outbound)

Tells the plugin to remove a player from a synced group/team.

**Data Schema:**

```json
{
  "id": "ROLE_ID",
  "name": "group-or-team-name",
  "isGroup": true,
  "uuid": "PLAYER_UUID"
}
```

**Response:** Returns updated player list for the role.

### `list-teams-and-groups`

Requests a list of all Minecraft teams and LuckPerms groups from the plugin.

**Response:**

```json
{
  "status": "success",
  "data": {
    "teams": ["team1", "team2"],
    "groups": ["group1", "group2"]
  }
}
```

### `command-completions`

Requests command completions for a partial command input.

**Data Schema:**

```json
{
  "cmd": "%2Fgive%20Player%20",
  "uuid": "PLAYER_UUID"
}
```

| Field  | Type      | Description                           |
|--------|-----------|---------------------------------------|
| `cmd`  | `string`  | URL-encoded partial command string.   |
| `uuid` | `string?` | Optional UUID of the requesting user. |

**Response:**

```json
{
  "status": "success",
  "data": ["/give Player minecraft:stone", "/give Player minecraft:stick"]
}
```
