# MC-Linker Bot — AI Instructions

## Project Overview

MC-Linker is a Discord bot that bridges Discord servers and Minecraft servers. It enables chat relay, player
stat/advancement/inventory viewing, role synchronization (Discord roles <-> LuckPerms groups/MC teams), server
moderation, account linking, and server status monitoring.

**This repository is only one half of the project** — the **bot side**, which runs on an Oracle Cloud VM. The other half
is the **MC-Linker Plugin**, a Minecraft server plugin in a separate
repository (https://github.com/MC-Linker/Discord-Linker). The plugin runs on users' Minecraft servers and connects to
this bot over **WebSocket (Socket.io)**.

> **Whenever you make changes that affect the WebSocket protocol, event schemas, response formats, or any bot<->plugin
communication, flag that the plugin side likely needs corresponding changes.** This includes adding/removing/renaming WS
> events, changing data schemas, modifying authentication flow, or altering error codes. See `websocket_api.md` for the
> full protocol specification.

## Technology Stack

- **Runtime:** Node.js (ES modules — `"type": "module"` in package.json)
- **Discord:** discord.js v14
- **HTTP Server:** Fastify v4
- **WebSocket:** Socket.io v4
- **Database:** MongoDB via Mongoose
- **Canvas:** skia-canvas (for rendering stats/inventory images)
- **Logging:** Pino
- **Minecraft data:** minecraft-data, prismarine-nbt, prismarine-auth

## Project Structure

```
MC-Linker/
├── main.js                  # Entry point — ShardingManager, spawns bot.js per shard
├── bot.js                   # Single shard entry — creates MCLinker client, loads everything
├── config.json              # Bot configuration (paths, colors, emojis, presence)
├── .eslintrc.json           # ESLint rules — run before committing
│
├── api/
│   ├── MCLinkerAPI.js       # API server (Fastify + Socket.io), WS middleware & auth
│   ├── Route.js             # Base class for REST routes
│   ├── WSEvent.js           # Base class for WebSocket events
│   ├── routes/              # REST API endpoint handlers (extend Route)
│   └── events/              # WebSocket event handlers (extend WSEvent)
│       └── chat-handlers/   # Chat relay sub-handlers (dispatch, queue, webhook pool)
│
├── commands/                # Discord slash/prefix commands (extend Command)
│   ├── main/                # Core commands (Stats, Advancements, Inventory)
│   ├── moderation/          # Server moderation commands
│   ├── other/               # Miscellaneous commands
│   └── settings/            # Server configuration commands
│
├── components/              # Discord component handlers — buttons, selects, modals (extend Component)
│
├── events/                  # Discord.js event handlers (extend Event)
│
├── structures/              # Core classes and architecture
│   ├── MCLinker.js          # Main client (extends Discord.Client)
│   ├── Command.js           # Base command class
│   ├── AutocompleteCommand.js # Command with autocomplete support
│   ├── Component.js         # Base component class
│   ├── Event.js             # Base event class
│   ├── connections/         # Connection models (extend Connection -> Discord.Base)
│   │   ├── Connection.js    # Base — MongoDB persistence, cross-shard sync
│   │   ├── ServerConnection.js
│   │   ├── UserConnection.js
│   │   ├── ServerSettingsConnection.js
│   │   ├── UserSettingsConnection.js
│   │   ├── CustomBotConnection.js
│   │   └── managers/        # CachedManagers for each connection type
│   ├── protocol/            # Communication strategies with Minecraft servers
│   │   ├── Protocol.js      # Base class + FilePath helper for MC server files
│   │   └── WebSocketProtocol.js  # Socket.io communication (primary)
│   ├── ftp/                 # FTP/SFTP client implementations
│   └── helpers/             # UI helpers (Pagination, Wizard, DefaultButton)
│
├── utilities/
│   ├── utils.js             # General utilities (hashing, avatar cache, NBT parsing, canvas)
│   ├── keys.js              # Translation key definitions (hierarchical)
│   ├── messages.js          # Embed/message formatting, placeholder system
│   ├── logger/              # Pino logger setup
│   │   ├── logger.js        # Root logger instance, child/tracking/debug-filter logic
│   │   ├── features.js      # Feature name proxy backed by logFeatures.json
│   │   └── transport.js     # Custom pino-pretty transport (messageFormat)
│   └── shardingUtils.js     # Cross-shard helper functions
│
├── resources/
│   ├── data/                # Static game data JSON (advancements, stats definitions)
│   ├── languages/           # Translation files
│   ├── emojis/              # Emoji image assets
│   ├── fonts/               # Minecraft font for canvas rendering
│   └── images/              # Image assets
│
├── scripts/                 # Build/deployment scripts
├── private/                 # SSL certs (gitignored)
├── oci/                     # Oracle Cloud Infrastructure configs
├── docker-compose.yml       # Production deployment
├── docker-compose-dev.yml   # Development deployment
└── Dockerfile
```

## Architecture & OOP

### Class Hierarchy

All extensible functionality follows a base-class pattern. New features are added by creating a new file with a class
that extends the appropriate base class. They are **dynamically loaded** from the filesystem based on paths in
`config.json`.

```
Discord.Client
  └── MCLinker                  # Main client with all managers and collections

Discord.Base
  └── Connection                # Base for all DB-backed connections
        ├── ServerConnection    # Minecraft server connection (has Protocol, chat/stat channels, synced roles)
        ├── UserConnection      # Discord<->Minecraft account link
        ├── ServerSettingsConnection
        ├── UserSettingsConnection
        └── CustomBotConnection

Discord.CachedManager
  └── ConnectionManager         # Base manager with connect/disconnect/load
        ├── ServerConnectionManager
        ├── UserConnectionManager
        └── ...

Discord.Base
  └── Protocol                  # Base for server communication strategies
        └── WebSocketProtocol   # Socket.io bidirectional

Command                         # Base for slash/prefix commands (execute→run pattern)
  └── AutocompleteCommand       # Adds autocomplete via plugin completions

Component                       # Base for button/select/modal handlers (execute→run pattern)
Event                           # Base for Discord.js events (execute→run pattern)
Route                           # Base for REST API endpoints
WSEvent                         # Base for WebSocket event handlers (execute→run pattern)
```

### Initialization Flow

1. `main.js` creates a `ShardingManager` and spawns shards
2. Each shard runs `bot.js`: creates `MCLinker`, connects to MongoDB, loads managers
3. Commands, components, and events are loaded dynamically from filesystem
4. **Shard 0 only:** starts the API server (`MCLinkerAPI`) with Fastify + Socket.io, loads REST routes and WS events

### Data Flow

```
Discord user interaction
  → Command/Component handler
    → ServerConnection (finds the linked MC server)
      → Protocol (WebSocket/HTTP/FTP)
        → Minecraft Plugin
          → Response back through protocol
            → Reply to Discord

Minecraft Plugin event
  → Socket.io → MCLinkerAPI.wsEventHandler()
    → WSEvent handler (api/events/*.js)
      → ServerConnection (update state)
        → Discord API (update channels/roles/messages)
```

### Adding New Features

#### New Command

Create a PascalCase `.js` file in the appropriate `commands/` subfolder:

```javascript
import Command from '../../structures/Command.js';

export default class MyCommand extends Command {
    constructor() {
        super({
            name: 'my-command',
            requiresConnectedServer: true,
        });
    }

    /** @inheritdoc */
    async run(interaction, client, args, server, logger) {
        // Implementation here — logger is a per-execution child logger
    }
}
```

The base `execute()` method handles deferring, permission checks, server connection validation, user resolution,
and creates a child logger. It then delegates to `run()` with the logger as the last argument. Subclasses implement
`run()` — never override `execute()` and never call `super.run()`.

#### New Discord Event

Create a PascalCase `.js` file in `events/`:

```javascript
import Event from '../structures/Event.js';

export default class MyEvent extends Event {
    constructor() {
        super({ name: 'guildMemberAdd', once: false });
    }

    /** @inheritdoc */
    async run(client, [member], logger) {
        // Handle the event — args is passed as an array, destructure in the signature
    }
}
```

The base `execute()` creates a child logger bound to `features.events[this.name]` and calls
`this.run(client, args, logger)` where `args` is the array of Discord.js event arguments.

#### New REST Route

Create a PascalCase `.js` file in `api/routes/`:

```javascript
import Route from '../Route.js';

export default class MyRoute extends Route {
    constructor() {
        super({
            endpoint: '/my-endpoint',
            methods: ['get'],
        });
    }

    async get(client, req, res) {
        return { status: 200, body: { ok: true } };
    }
}
```

#### New WebSocket Event

> **PLUGIN-SIDE CHANGE REQUIRED:** Adding a new WS event means the plugin must also implement the corresponding event
> emitter/handler. Update `websocket_api.md` with the new event schema.

Create a PascalCase `.js` file in `api/events/`:

```javascript
import { RateLimiterMemory } from 'rate-limiter-flexible';
import WSEvent from '../WSEvent.js';

export default class MyEvent extends WSEvent {
    constructor() {
        super({
            event: 'my-event',
            rateLimiter: new RateLimiterMemory({ points: 5, duration: 2 }),
        });
    }

    /** @inheritdoc */
    async run(data, server, client, logger) {
        // Handle the event, return response object or void
        return { status: 'success', data: { result: 'ok' } };
    }
}
```

The base `execute()` creates a child logger bound to `features.api.events[this.event]` and `server.id`,
then delegates to `run()` with the logger as the 4th argument.

#### New Component

Create a PascalCase `.js` file in `components/`:

```javascript
import { ComponentType } from 'discord.js';
import Component from '../structures/Component.js';

export default class MyButton extends Component {
    constructor() {
        super({
            id: 'my_button',
            type: ComponentType.Button,
        });
    }

    /** @inheritdoc */
    async run(interaction, client, logger) {
        // Handle the interaction — logger is a per-execution child logger
    }
}
```

The base `execute()` handles deferring, permission checks, author validation, and SKU checks, creates a child
logger bound to `features.components[this.id]`, then delegates to `run()`.

### Key Patterns

**Translation System:** Use `interaction.replyTl(keys.path.to.key, placeholders)` for all user-facing messages.
Translation keys are in `utilities/keys.js`, language files in `resources/languages/`.

**Connection Editing:** Always use `connection.edit(data)` — it persists to MongoDB and broadcasts changes to all
shards.

**Protocol Responses:** All protocol communication uses `{ status: 'success'|'error', data?, error? }` envelope format.
Error codes are defined in `Protocol.ProtocolError`.

**Cross-Shard Sync:** Connections are cached per-shard. Edits broadcast via `client.shard.broadcastEval()`. Socket
objects are not serializable and must be excluded from broadcasts.

## Code Style & Linting

Use JSDoc to describe all classes, methods, and to declare types. This is crucial for maintainability and helps with
editor autocompletion.

Adhere to the code style of this project for all edits. The full ruleset is in `.eslintrc.json`. Key conventions:

### Formatting

- **4-space indentation** (no tabs)
- **Single quotes** for strings
- **Always semicolons**
- **Trailing commas** in multiline objects/arrays (`always-multiline`)
- **Stroustrup brace style** (`else`, `catch`, etc. on a new line after `}`), single-line blocks allowed
- **No space** between control keywords and parentheses: `if(`, `for(`, `while(`, `catch(`, `switch(`
- **Space before blocks:** `if(condition) {`
- **Space inside object braces:** `{ key: value }`, but **not** inside array brackets: `[1, 2]`
- **Max 1 empty line** between code blocks, max 1 at end of file
- **No trailing whitespace**

## Logging

The logger is a Pino instance exported as `rootLogger` from `utilities/logger/logger.js`.

**For commands, events, WS events, and components:** the base handler (`Command`, `Event`, `WSEvent`, `Component`)
creates a per-execution child logger and passes it to `run()` — subclasses should use that `logger` parameter
directly. Do **not** create module-level loggers in these files.

**For other files** (utilities, structures, chat-handlers, etc.): create a module-level child logger:

```javascript
import rootLogger from '../utilities/logger/logger.js';
import features from '../utilities/logger/features.js';

const logger = rootLogger.child({ feature: features.api.socketio.chatHandlers.dispatch });
```

The `features` proxy auto-derives the dotted path from the access chain:
`features.api.socketio.chatHandlers.dispatch` → `'api.socketio.chatHandlers.dispatch'`. Any path is valid — IDE
autocomplete is backed by `resources/logFeatures.json`. Feature paths for WS events live under `features.api.events`,
while `features.api.socketio` is reserved for socket.io infrastructure (connection, middleware, chatHandlers).

### Adding context to log calls

Pass `guildId`/`userId` as structured fields, not in the message string:

```javascript
logger.debug({ guildId: server.id }, 'Enqueue payload for channel ...');
logger.error(err, 'Something failed'); // pino arg order: error object first, message second
```

For classes where all methods share the same guildId/userId (e.g. a per-server connection), create an
instance child in the constructor:

```javascript
// module level
const logger = rootLogger.child({ feature: features.structures.connections.server });
// instance level
constructor(...)
{
    this.logger = logger.child({ guildId: this.id });
}
```

### Runtime debug filtering

Debug output is suppressed by default (root level `'info'`). All public debug filter methods operate across
all shards via `broadcastEval`. Single-shard methods are prefixed with `_` and should not be used directly.

```javascript
// Enable debug filters (always cross-shard)
client.logger.enableDebug(client, { feature: 'api.events' });         // all WS event features
client.logger.enableDebug(client, { feature: 'api.events.chat' });    // only chat event
client.logger.enableDebug(client, { feature: 'commands' });            // all commands
client.logger.enableDebug(client, { guildId: 'GUILD_ID' });            // all debug for one guild
client.logger.enableDebug(client, { feature: 'api.events.chat', guildId: 'GUILD_ID' }); // combined

// Disable
client.logger.disableDebug(client, { feature: 'api.events' });
client.logger.clearDebugFilters(client);

// Read-only (local shard)
client.logger.getDebugFilters();
```

Feature matching uses prefix logic: enabling `'api.events'` also enables `'api.events.chat'`,
`'api.events.verify-user'`, etc. info/warn/error/fatal always pass through regardless of filters.

Initial debug filters can be set in `config.json`:

```json
{
    "initialDebugFilters": [
        { "feature": "api.events" },
        { "guildId": "123456789" }
    ]
}
```

### broadcastEval and features

The `features` proxy is attached to the client as `c.features`, so it is available inside `broadcastEval`
callbacks. Use `c.features` instead of string literals:

```javascript
this.client.shard.broadcastEval(async (c, { id, name, data }) => {
    const clog = c.logger.child({ feature: c.features.structures.protocol.websocket, guildId: id });
    clog.debug(`Sending event ${name}`);
    // ...
}, { context: { id: this.id, name, data }, shard: 0 });
```

## Environment & Deployment

- **Environment variables:** See `dev-guidelines.md` for the full list. Key ones: `TOKEN`, `DATABASE_URL`, `BOT_PORT`,
  `PLUGIN_VERSION`
- **Entry point:** `node main.js` (starts sharding manager)
- **Production:** `docker-compose up -d` (bot + MongoDB + Mongo Express)
- **No formal test framework**
- **API server** runs only on shard 0, listening on `BOT_PORT` (default 3000)
