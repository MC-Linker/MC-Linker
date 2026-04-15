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
│   ├── logger/              # Logger setup
│   │   ├── Logger.js        # Logger class — pino wrapper with per-call debug filter system
│   │   ├── features.js      # Feature name proxy backed by logFeatures.json
│   │   └── transport.js     # Custom pino-pretty transport (messageFormat)
│   └── sharding-utils.js     # Cross-shard helper functions
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

**Cross-Shard Sync:** Connections are cached per-shard. Edits broadcast via `client.broadcastEval()`. Socket
objects are not serializable and must be excluded from broadcasts.

## Code Style & Linting

Use JSDoc to describe all classes, methods, and to declare types. This is crucial for maintainability and helps with
editor autocompletion.

Adhere to the code style of this project for all edits.
However, do not run linting yourself, write the code adhering to the code style rules already.
The full ruleset is in `.eslintrc.json`. Key conventions:

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

The logger is a `Logger` class instance (wrapping pino) exported as the default from `utilities/logger/Logger.js`.

**For commands, events, WS events, and components:** the base handler (`Command`, `Event`, `WSEvent`, `Component`)
creates a per-execution child logger and passes it to `run()` — subclasses should use that `logger` parameter
directly. Do **not** create module-level loggers in these files.

**For other files** (utilities, structures, chat-handlers, etc.): create a module-level child logger:

```javascript
import rootLogger from '../utilities/logger/Logger.js';
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
constructor()
{
    this.logger = logger.child({ guildId: this.id });
}
```

### Runtime debug filtering

`debug` and `trace` are suppressed by default. Filters are checked **per log call**: the logger's static
filters (set via `child()`) are merged with any structured object passed as the first argument, then tested
against the active filter map. This means `{ guildId }` passed at the call site is filter-aware even on a
module-level logger that has no `guildId` in its static filters.

`info`/`warn`/`error`/`fatal` always pass through unconditionally — there is no log-level control.

All public debug filter methods operate across all shards via `broadcastEval`. Single-shard methods are
prefixed with `_` and should not be used directly.

```javascript
// Enable debug filter (always cross-shard)
client.logger.enableDebug(client, { feature: 'api.events' });         // all WS event features
client.logger.enableDebug(client, { feature: 'api.events.chat' });    // only chat event
client.logger.enableDebug(client, { feature: 'commands' });            // all commands
client.logger.enableDebug(client, { guildId: 'GUILD_ID' });            // ALL debug calls that pass { guildId: 'GUILD_ID' }
client.logger.enableDebug(client, { feature: 'api.events.chat', guildId: 'GUILD_ID' }); // combined

// Disable
client.logger.disableDebug(client, { feature: 'api.events' });
client.logger.clearDebugFilters(client);

// Read-only (local shard)
client.logger.getDebugFilters();
```

Feature matching uses prefix logic: enabling `'api.events'` also enables `'api.events.chat'`,
`'api.events.verify-user'`, etc.

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
this.client.broadcastEval(async (c, { id, name, data }) => {
    const clog = c.logger.child({ feature: c.features.structures.protocol.websocket, guildId: id });
    clog.debug(`Sending event ${name}`);
    // ...
}, { context: { id: this.id, name, data }, shard: 0 });
```

## Analytics Dashboard (`analytics-dashboard/`)

Nuxt 3 sub-project that visualises data from the `analyticsnapshots`, `analyticserrors`, and `serverconnections` MongoDB
collections. Runs as a separate Docker service.

### Pages

| Page               | Route           | API                   | Description                                                                                       |
|--------------------|-----------------|-----------------------|---------------------------------------------------------------------------------------------------|
| Overview           | `/`             | `overview.get.ts`     | Guild count, users, commands, error rate, connections, shards; time-series charts                 |
| Commands           | `/commands`     | `commands.get.ts`     | Top commands bar chart, avg duration chart, full table with error rates                           |
| API Calls          | `/api-calls`    | `api-calls.get.ts`    | REST and WebSocket API call charts and tables                                                     |
| Shards             | `/shards`       | `shards.get.ts`       | Machine-level CPU/memory stats, per-shard metrics and time-series charts                          |
| Guilds             | `/guilds`       | `guilds.get.ts`       | Guild join/leave trends                                                                           |
| Server Connections | `/servers`      | `servers.get.ts`      | Interactive pie chart with drill-down (feature adoption → breakdowns), guild search with raw JSON |
| Chat Monitor       | `/chat-monitor` | `chat-monitor.get.ts` | Chat pipeline throughput, queue depth, rate limits by category, operations table                  |
| Errors             | `/errors`       | `errors.get.ts`       | Error log table with type, name, guild, timestamp                                                 |

### Server Connections — Interactive Pie Chart

The Server Connections page has a single pie chart with drill-down behaviour:

- **Main view** ("Feature Adoption"): shows how many servers use each feature.
- **Drill-down**: clicking a drillable segment (Chat Channels, Stat Channels, Synced Roles) replaces the chart with a
  breakdown view. A back button returns to the main view. Non-drillable segments (Required Role, Floodgate) do nothing
  on click.

When a **new server connection feature** is added to the bot, update these places:

1. **API route** (`server/api/servers.get.ts`): add a counter variable, increment it in the server loop, include it in
   the returned `stats` object. If the feature has sub-categories, add a breakdown object too.
2. **Pie chart data** (`pages/servers.vue`): add the new label to the main `pieChartData` computed (labels + data
   arrays). If it should be drillable, add an entry to the `DRILLABLE` map and a new `if` branch in `pieChartData` for
   the breakdown view.
3. **Schema** (`server/utils/db.ts`): add the new field to `serverConnectionSchema` if it needs to be queried/typed.

Current main pie chart features:

- Chat Channels — servers with ≥1 chat channel (drills into chat event types)
- Stat Channels — servers with ≥1 stat channel (drills into stat channel types)
- Synced Roles — servers with ≥1 synced role (drills into role sync directions)
- Required Role — servers with required-role-to-join active (drills into: Require Roles vs Linked Account Only)
- Floodgate — servers with a floodgate prefix set

## Error Tracking (`trackError`)

All `logger.error` calls in the bot are routed through `trackError`, which both logs the error (via the caller's
contextual logger) and buffers it for the analytics error collection.

- **Instance method**: `client.analytics.trackError(type, name, guildId, userId, error, context, logger)` — use in files
  with `client` access.
- **Named export**: `import { trackError } from '../structures/analytics/AnalyticsCollector.js'` — use in files without
  `client` access. Safe no-op before analytics is initialised.
- **Logger param**: always pass the contextual `logger` (module-level or method parameter) as the last argument to
  preserve the correct `feature` tag and any bound fields.
- **Exceptions**: `AnalyticsCollector.js` flush errors and `AnalyticsAggregator.js` snapshot errors use `logger.error`
  directly to avoid infinite loops.

When adding a new `catch` block or error path anywhere in the bot, use `trackError` instead of `logger.error` or
`logger.warn`. Never use `logger.warn` or `logger.error` directly for error handling — always route through `trackError`
so errors are both logged and buffered for the analytics error collection. The only exceptions are the self-referential
cases listed above.

## Environment & Deployment

### Prerequisites

- Node.js (LTS version recommended)
- MongoDB
- Docker and Docker Compose (for containerised deployment)

### Environment Variables

Create a `.env` file in the project root:

```
# Core Discord Bot
TOKEN=                          # Discord bot token
CLIENT_ID=                      # Discord application client ID
CLIENT_SECRET=                  # Discord application client secret
PREFIX=^                        # Command prefix for text commands
GUILD_ID=                       # Space-separated guild IDs (dev/testing)
OWNER_ID=                       # Your Discord user ID
DISCORD_LINK=                   # Bot invite link

# Database
DATABASE_URL=mongodb://localhost:27017/mc-linker

# API / Web Server
BOT_PORT=3000                   # Port for the bot's API server
COOKIE_SECRET=                  # For secure cookies
LINKED_ROLES_REDIRECT_URI=      # http://your_ip/linked-role/callback

# Microsoft / Minecraft Integration
MICROSOFT_EMAIL=
MICROSOFT_PASSWORD=
AZURE_CLIENT_ID=
PLUGIN_VERSION=3.6              # Version of the Minecraft plugin
PLUGIN_PORT=11111               # Port for the Minecraft plugin

# Optional
TOPGG_TOKEN=                    # Top.gg integration
LOG_LEVEL=info                  # Logging level (debug, info, warn, error)
NODE_ENV=development            # development or production
```

### Installation

```bash
git clone https://github.com/MC-Linker/MC-Linker.git
cd MC-Linker
npm ci
```

### Running

**Development** (direct Node.js):

```bash
node main.js
```

For automatic restarts on crash: `run.bat` (Windows) or `run.sh` (Unix/Linux).

**Production** (Docker):

```bash
docker-compose up -d        # bot + MongoDB + Mongo Express
```

**Analytics dashboard only** (dev, requires analytics profile):

```bash
docker compose --profile analytics up -d analytics-dashboard
```

### Key Deployment Notes

- **Entry point:** `node main.js` (ShardingManager — spawns `bot.js` per shard)
- **API server** runs only on shard 0, listening on `BOT_PORT`
- **No formal test framework**
- The analytics dashboard connects to `mc-linker_mongo-network` (the external Docker network created by the main compose
  stack). It must be started after the main stack.
