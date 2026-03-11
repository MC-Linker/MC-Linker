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
│   ├── logger.js            # Pino logger instance
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

Command                         # Base for slash/prefix commands
  └── AutocompleteCommand       # Adds autocomplete via plugin completions

Component                       # Base for button/select/modal handlers
Event                           # Base for Discord.js events
Route                           # Base for REST API endpoints
WSEvent                         # Base for WebSocket event handlers
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

    async execute(interaction, client, args, server) {
        if(!await super.execute(interaction, client, args, server)) return;
        // Implementation here
    }
}
```

The `super.execute()` call handles deferring, permission checks, server connection validation, and user resolution.
Always call it first and return early if it returns falsy.

#### New Discord Event

Create a PascalCase `.js` file in `events/`:

```javascript
import Event from '../structures/Event.js';

export default class MyEvent extends Event {
    constructor() {
        super({ name: 'guildMemberAdd', once: false });
    }

    async execute(client, member) {
        // Handle the event
    }
}
```

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

    async execute(data, server, client) {
        // Handle the event, return response object or void
        return { status: 'success', data: { result: 'ok' } };
    }
}
```

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

    async execute(interaction, client) {
        if(!await super.execute(interaction, client)) return;
        // Handle the interaction
    }
}
```

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

Run ESLint before committing. The full ruleset is in `.eslintrc.json`. Key conventions:

### Formatting

- **4-space indentation** (no tabs)
- **Single quotes** for strings
- **Always semicolons**
- **Trailing commas** in multiline objects/arrays (`always-multiline`)
- **1TBS brace style** (`} else {`), single-line blocks allowed
- **No space** between control keywords and parentheses: `if(`, `for(`, `while(`, `catch(`, `switch(`
- **Space before blocks:** `if(condition) {`
- **Space inside object braces:** `{ key: value }`, but **not** inside array brackets: `[1, 2]`
- **Max 1 empty line** between code blocks, max 1 at end of file
- **No trailing whitespace**

### Naming

- **Files:** PascalCase (`ServerConnection.js`, `Chat.js`, `Advancements.js`)
- **Classes:** PascalCase (`MCLinker`, `ServerConnection`, `AutocompleteCommand`)
- **Variables/functions:** camelCase (`chatChannels`, `getCachedAvatarURL`, `parseMentions`)
- **Constants:** camelCase or UPPER_SNAKE_CASE for true constants (`ProtocolError`,
  `DISPATCH_HIGH_LOAD_ENTER_THRESHOLD`)

### Code

- **`const`/`let`** only — no `var`
- **`prefer-const`** — use `const` unless reassigned
- **Strict equality** (`===`/`!==`) — never `==`/`!=`
- **No magic numbers** — extract to named constants (0, 1, -1 exempt)
- **ES module imports** — `import`/`export`, no `require()`
- **Sort imports** alphabetically (case-insensitive, declaration order not enforced)
- **JSDoc** on class constructors, methods, and typedefs

### Example of Correct Style

```javascript
import { RateLimiterMemory } from 'rate-limiter-flexible';
import WSEvent from '../WSEvent.js';

const MAX_RETRIES = 3;

export default class MyEvent extends WSEvent {

    constructor() {
        super({
            event: 'my-event',
            rateLimiter: new RateLimiterMemory({ points: 5, duration: 2 }),
        });
    }

    async execute(data, server, client) {
        if(!server) return { status: 'error', error: 'not_connected' };

        const { uuid, message } = data;
        for(const channel of server.chatChannels) {
            if(channel.types.includes('chat')) {
                await client.channels.fetch(channel.id);
            }
        }

        return { status: 'success', data: { sent: true } };
    }
}
```

## Plugin-Side Change Indicators

Flag that the **MC-Linker Plugin** (separate repository) needs changes when:

- **WebSocket events** are added, removed, renamed, or have their data schema changed
- **Authentication/handshake** flow is modified (token format, query params, auth object)
- **Response format** changes (status codes, error codes, envelope structure)
- **Protocol methods** change (new commands sent to plugin, changed parameters)
- **Synced role** logic changes (direction behavior, sync algorithm)
- **Account linking/verification** flow changes
- **Plugin version** requirement is bumped (`config.json` → `pluginVersion`)
- **Any outbound event** is changed (events the bot emits TO the plugin — see `websocket_api.md` "Events (Outbound from
  Bot)")

When in doubt, check `websocket_api.md` — if your change touches anything documented there, the plugin likely needs an
update too.

## Environment & Deployment

- **Environment variables:** See `dev-guidelines.md` for the full list. Key ones: `TOKEN`, `DATABASE_URL`, `BOT_PORT`,
  `PLUGIN_VERSION`
- **Entry point:** `node main.js` (starts sharding manager)
- **Production:** `docker-compose up -d` (bot + MongoDB + Mongo Express)
- **No formal test framework** — use Node.js `assert` module for basic tests in `tests/`
- **API server** runs only on shard 0, listening on `BOT_PORT` (default 3000)
