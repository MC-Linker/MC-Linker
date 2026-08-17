# MC-Linker Bot — AI Instructions

> **Maintenance rule:** This file must always reflect the current state of the project. Whenever code, architecture,
> conventions, or workflows are changed, update the relevant sections of this file as part of the same change. Never
> leave
> this file out of date.

## Changelog

A `CHANGELOG.md` exists at the repository root and must be updated **before every pull request** that introduces a
bigger feature update (new commands, new WS events, significant refactors, new dashboard pages, etc.). Minor
bug-fix-only PRs may skip a changelog entry.

Each entry follows the format:

```
## $version - $UpdateName
```

**CHANGELOG rules — strictly user-facing only:**

- Document what changed for end-users (new commands, changed behaviour, fixes they'd notice).
- No implementation details, no internal refactors, no technical terms.
- Use short bullet points. One sentence per bullet.
- The PR title must match the changelog heading exactly.

**PR description rules — developer-facing:**

- High-level technical overview: new WS events, schema changes, refactors, architectural decisions.
- Use technical terms freely. No need to explain every line — just the what and why at a structural level.
- Group under headings: New Features, Changes/Refactors, Bug Fixes.

## Project Overview

MC-Linker is a Discord bot that bridges Discord servers and Minecraft servers. It enables chat relay, player
stat/advancement/inventory viewing, role synchronization (Discord roles <-> LuckPerms groups/MC teams), server
moderation, account linking, and server status monitoring.

**This repository is only one half of the project** — the **bot side**, which runs on an Oracle Cloud VM. The other half
is the **MC-Linker Plugin**, a Minecraft server plugin in a separate repository
(https://github.com/MC-Linker/Discord-Linker). The plugin runs on users' Minecraft servers and connects to this bot over
**WebSocket (Socket.io)**.

> **Whenever you make changes that affect the WebSocket protocol, event schemas, response formats, or any bot<->plugin
communication, directly formulate a ready-to-use prompt describing the required plugin-side changes.** This includes
> adding/removing/renaming WS
> events, changing data schemas, modifying authentication flow, or altering error codes. See `websocket_api.md` for the
> full protocol specification. The prompt should be self-contained and specific enough that it can be pasted directly
> into
> the plugin repository's AI agent to implement the corresponding changes.

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
│   ├── model/               # Version-dependent minecraft domain model (pure, no I/O and no logging)
│   │   └── WorldFileLayout.js # World file layouts per minecraft version (LEGACY, V26) + forVersion()
│   ├── protocol/            # Communication strategies with Minecraft servers
│   │   ├── Protocol.js      # Base class + ProtocolError codes
│   │   ├── ServerFiles.js   # Server-bound access to every minecraft file the bot downloads
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
│   ├── data/                # Generated game data JSON (advancements, stats, game rules) — see scripts/gamedata/
│   ├── languages/           # Translation files
│   ├── emojis/              # Emoji image assets
│   ├── fonts/               # Minecraft font for canvas rendering
│   └── images/              # Image assets
│
├── scripts/                 # Build/deployment scripts
│   └── gamedata/            # Regenerates resources/data/ from the client jar + wiki (see Game Data)
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

The base `execute()` method handles deferring, permission checks, server connection validation, user resolution, and
creates a child logger. It then delegates to `run()` with the logger as the last argument. Subclasses implement
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
> emitter/handler. Update `websocket_api.md` with the new event schema. After implementing the bot-side changes,
> directly
> formulate a ready-to-use prompt for the plugin repository describing exactly what needs to be added or changed on the
> plugin side (event name, payload schema, expected response, etc.).

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

The base `execute()` creates a child logger bound to `features.api.events[this.event]` and `server.id`, then delegates
to `run()` with the logger as the 4th argument.

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
    async run(interaction, client, server, logger) {
        // Handle the interaction — logger is a per-execution child logger
    }
}
```

The base `execute()` handles deferring, permission checks, author validation, and SKU checks, creates a child logger
bound to `features.components[this.id]`, then delegates to `run()`.

### Key Patterns

**Translation System:** Use `interaction.replyTl(keys.path.to.key, placeholders)` for all user-facing messages.
Translation keys are in `utilities/keys.js`, language files in `resources/languages/`.

**Component Building:** Never instantiate discord.js builders (`ContainerBuilder`, `TextDisplayBuilder`,
`ActionRowBuilder`, `ButtonBuilder`, etc.) directly. Instead, define component structures in the language files
(`resources/languages/`) and use `getComponent()` / `getActionRows()` / `getReplyOptions()` from `utilities/messages.js`
to build them. When dynamic content needs to be injected, use `%placeholder%` in the language key or call
`getComponent()` on a sub-key to obtain a builder, then compose them programmatically.

**Language File Conventions:**

- Never specify `ActionRow` objects directly in language keys — `getActionRows()` wraps buttons/selects automatically.
- Never write inline (single-line) JSON objects in language files; always expand every object onto its own lines.

**Connection Editing:** Always use `connection.edit(data)` — it persists to MongoDB and broadcasts changes to all
shards.

**User Account Links:** A `UserConnection` is keyed by `${discordId}:${scope}` where `scope` is either `'global'`
(authoritative Mojang/Floodgate UUID) or a server (guild) id (per-server profile). Each link has a `premium` boolean
distinguishing globally-unique authoritative UUIDs from offline UUIDv3 (cracked) which are scope-local.

For lookups, **always use the manager helpers** rather than `cache.get(discordId)`:

- `userConnections.resolveForServer(discordId, server)` — primary helper for server-scoped features. Per-server link
  takes priority, falls back to global. Use this whenever you have a Discord user id and a server context.
- `userConnections.findByUUID(uuid, server)` / `findByUsername(username, server)` — server-scoped reverse lookups
  (UUID/username → connection). Same per-server-first-then-global cascade as `resolveForServer`. Used by `/userinfo`,
  role sync, the `/dm` command, etc.
- `userConnections.getGlobal(discordId)` — for cases that specifically need the global-scope link only (rare).
- `userConnections.getAll(discordId)` — every link a user holds. Used by `/account manage` and by the Linked-Roles
  metadata sync (any link counts as "connected" — see below).

`UserConnection.getUUID(server)` is the single source of truth for the effective UUID on a given server. Returns
`null` when the link isn't valid for the requested server scope (cross-scope per-server query, no server context, or
cracked link on an online-mode server). Adapts to the server's *current* online mode for both global and per-server
links — Floodgate UUIDs pass through unchanged, premium-Mojang on offline servers becomes `createUUIDv3(username)`. For
Discord-side IDs use `connection.discordId` (not `connection.id`, which is the composite cache key).

**Linked Roles — application-wide, not per-server:** Discord's Linked-Roles metadata is per-user-per-application; there
is no API to scope metadata to a Discord server. The `connectedaccount` metadata key therefore means "the user has *any*
MC-Linker link, global or per-server", and `platform_username` is picked from the global link if present, else the first
per-server link. Use [
`UserSettingsConnection.syncLinkedRoles()`](structures/connections/UserSettingsConnection.js)
after every connect/disconnect/promote — it recomputes both fields from the current connection cache. Server admins who
need *true* per-server "user is linked to my server" gating must use `requiredRoleToJoin` instead (which is
per-server-aware via `findByUUID(uuid, server)`).

**Protocol Responses:** All protocol communication uses `{ status: 'success'|'error', data?, error? }` envelope format.
Error codes are defined in `Protocol.ProtocolError`.

**Minecraft Server Files:** Never hardcode a path to a minecraft server file and never call `protocol.get`/
`getWithCache`/`list` with a path directly. Every file the bot downloads is accessed through
`server.files` ([structures/protocol/ServerFiles.js](structures/protocol/ServerFiles.js)), which knows the paths, the
world layout and the cache location of the server it is bound to:

```js
const statFile = await server.files.stats(user.uuid);   // world file, version-dependent path
const levelDat = await server.files.levelDat();
const plugins = await server.files.plugins();          // directory listing
```

Each method returns the usual protocol envelope, so `handleProtocolResponse()` and `response.cached` work as before.
Adding a file the bot reads means adding a method there, not a path at the call site.

- **World files** (`advancements`, `stats`, `playerData`, `levelDat`, `scoreboard`, `datapacks`) are version-dependent:
  minecraft 26.1 moved the per-player files into `players/` and namespaced the saved data
  (`data/minecraft/scoreboard.dat`). Their paths are built from `server.worldFileLayout`, and **every version-specific
  path literal belongs in [structures/model/WorldFileLayout.js](structures/model/WorldFileLayout.js) and nowhere
  else** — supporting a new minecraft layout means adding a `WorldFileLayout` there.
- **Server files** (`serverProperties`, `serverIcon`, `whitelist`, `operators`, `bannedPlayers`, `bannedIPs`,
  `floodgateConfig`, `plugins`, `mods`) are the same on every version.

`server.worldPath` is normalized to the **world root** when it is received in `ServerConnection._patch()`
(outdated plugin versions report `<world>/dimensions/minecraft/overworld` on minecraft 26.1+), so every world path may
assume the world root.

Downloaded files are cached **per server** under `download-cache/serverConnection/<serverId>/`, because
`getWithCache()` falls back to the cache when a server is offline — a shared cache would serve the files of a different
server for the same player, which offline mode servers hit every time (their uuids are derived from the username).
`ServerFiles` is the only place that builds cache paths; use `ServerFiles.cacheFolder(serverId)` and
`ServerFiles.playerCachePaths(serverId, uuid)` when removing them.

**Game Data (advancements, custom stats, game rules):** Never hand-edit `resources/data/advancements.json`,
`stats_custom.json` or `gamerules.json` — they are generated, and a hand edit is lost on the next run.

Everything is derived from the official client jar by
[structures/render/GameDataDeriver.js](structures/render/GameDataDeriver.js), which is pure (a language map and
advancement files in, plain data out) so the same code produces both the committed baselines and a connected
server's runtime data.

- **At runtime**, use `AssetsManager.getGameData(server.version)` — never import the JSON directly. It returns
  `{ advancements, customStats, gameRules }` for that *exact* version, derived while the version's jar is already open
  for asset extraction and cached as `derived/game-data.json` (~40 KB) next to its `assets/`. Version accuracy is the
  whole point: 26.2 ships 126 advancements and 59 game rules, 1.16.5 only 80 and 32.
- **`wait: false`** returns immediately with whatever is cached (falling back to the committed baseline) and warms the
  real data in the background. Use it anywhere a 30 MB download would be unacceptable — the chat relay does.
  Failures back off for `WARM_RETRY_COOLDOWN`.
- **Game rule defaults** are the one thing a jar cannot give: they are bytecode operands in `GameRules.class`. They are
  harvested from the wiki into `resources/data/gamerules/defaults.json` by `scripts/gamedata/`. Everything else about a
  rule — its existence, its display name, and the pre-26.1 rename map — comes from the jar.
- **26.1 renamed 26 game rules** (`doTileDrops` -> `block_drops`) and *inverted* three of them, so a rule must be looked
  up by both its modern id and its `legacyName`, and an inverted rule matched by legacy name compares against the
  negated default. `ServerInfo.indexGameRules()` does this; matching on the modern id alone silently reports every rule
  of a pre-26.1 world as changed.

Regenerating (only needed when a new Minecraft version ships):

```bash
node scripts/gamedata/harvest-gamerules.js && node scripts/gamedata/generate-game-data.js
```

The harvest captures pinned wiki revisions into `resources/data/gamerules/raw/` so the generator runs offline and two
harvests can be diffed. The generator cross-checks its output against the jar and writes
`resources/data/gamerules/needs-review.json`, exiting non-zero if anything is unaccounted for — do not commit a run
with a non-empty review file.

**Cross-Shard Sync:** Connections are cached per-shard. Edits broadcast via `client.broadcastEval()`. Socket objects are
not serializable and must be excluded from broadcasts.

## File Operations

**Creating files:** Whenever you create a new file, immediately `git add` it so it is tracked. Never leave newly created
source files as untracked — stage them as part of the same change that introduces them.

**Renaming files:** Always use `git mv <old> <new>` to rename or move files. Never use OS-level commands (`Rename-Item`,
`mv`, etc.) directly, as they cause git to see a delete + untracked add instead of a rename.

## Code Style & Linting

Use JSDoc to describe all classes, methods, and to declare types. This is crucial for maintainability and helps with
editor autocompletion.

**Every function and method must have JSDoc with typed `@param` annotations and a `@returns` (omit `@returns` only for
`void`-returning sync functions). No bare `@param interaction` / `@param client` lines — always include the
`{Type}` brace, even when the type is obvious from context (`{MCLinker}`, `{ServerConnection}`, etc.). Use
`import('path').Type` syntax for cross-file types when the type isn't already in scope. For object-shaped params, write
inline literal types (`{{ badge: string, scopeLabel: string }}`) or reference a typedef. Array params should use tuple
syntax when positional (`[string, number?]`) rather than `any[]`. This is enforced as a code-review standard; PRs
introducing untyped params should be rejected.

**Every function that can throw must have `@throws {Type}` in its JSDoc**, describing when/why — whether the
`throw` is explicit in the function body, or it propagates from a call the function makes without catching it. This is
not optional/best-effort: a reader must be able to tell from the JSDoc alone whether calling a function needs a
`try`/`catch`, without reading its implementation.

**Tie everything to a class where reasonable:** Helper functions should nearly always be written as `static` (or
instance) methods on the relevant class, not as module-level functions, and constants that belong to a class (config
values, limits, keys, sentinels, etc.) should be `static` fields on that class rather than module-level `const`s.
Module-level functions/constants are only appropriate for truly standalone values with no logical owner class (e.g.
exports in `utilities/`). This applies to JSDoc `@typedef`s too: when a typedef belongs to a class, place its comment
**inside the class body** (it still resolves module-wide, and cross-file `import('./File.js').TypeName` references still
work — it's purely organizational). The one standing exception that stays at module scope is the module-level child
`logger` (see [Logging](#logging)).

**Marking privates:** Private members must be marked `@private` in their JSDoc. The leading-underscore prefix (`_`)
is **optional, not required** — use it when it aids readability or is needed to avoid a name collision (e.g. a private
field `_foo` backing a public `get foo()`), but don't underscore every private member by reflex. `@private`
is the source of truth for visibility; `_` is just a readability aid.

Adhere to the code style of this project for all edits. However, do not run linting yourself, write the code adhering to
the code style rules already. The full ruleset is in `.eslintrc.json`. Key conventions:

### Formatting

- **4-space indentation** (no tabs)
- **Single quotes** for strings
- **Always semicolons**
- **Trailing commas** in multiline objects/arrays (`always-multiline`)
- **Stroustrup brace style** (`else`, `catch`, etc. on a new line after `}`), **no braces for single-statement blocks**:
  `if(condition) statement;` not `if(condition) { statement; }`
- **No space** between control keywords and parentheses: `if(`, `for(`, `while(`, `catch(`, `switch(`
- **Space before blocks:** `if(condition) {` (when braces are used)
- **Space inside object braces:** `{ key: value }`, but **not** inside array brackets: `[1, 2]`
- **Max 1 empty line** between code blocks, max 1 at end of file
- **No trailing whitespace**

### Comments

Comment sparingly. Only explain the non-obvious *why*, never restate *what* the code already says. Prefer clear names
over narration, and don't annotate obvious steps or standard language/library behaviour. In most cases a single line of
code does **not** warrant a multi-line comment block — if a brief one-line note doesn't cover it, reconsider whether the
comment is needed at all. Reserve longer comments for genuinely subtle logic (races, ordering constraints, workarounds)
where the reasoning can't be inferred from the code.

## Logging

The logger is a `Logger` class instance (wrapping pino) exported as the default from `utilities/logger/Logger.js`.

**For commands, events, WS events, and components:** the base handler (`Command`, `Event`, `WSEvent`, `Component`)
creates a per-execution child logger and passes it to `run()` — subclasses should use that `logger` parameter directly.
Do **not** create module-level loggers in these files.

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

**`logFeatures.json` maintenance:** Every feature path used via `features.x.y.z` **must** have a corresponding entry in
`resources/logFeatures.json`. The file should be comprehensive — all commands, Discord events, WS events, REST routes,
components, and structural modules must be listed, even if they don't currently create a module-level logger. When
adding a new command, event, route, component, or structural module, add its entry to `logFeatures.json` as well.

### Adding context to log calls

Pass `guildId`/`userId` as structured fields, not in the message string:

```javascript 
logger.debug({ guildId: server.id }, 'Enqueue payload for channel ...');
logger.error(err, 'Something failed'); // pino arg order: error object first, message second
```

For classes where all methods share the same guildId/userId (e.g. a per-server connection), create an instance child in
the constructor:

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

`debug` and `trace` are suppressed by default. Filters are checked **per log call**: the logger's static filters (set
via `child()`) are merged with any structured object passed as the first argument, then tested against the active filter
map. This means `{ guildId }` passed at the call site is filter-aware even on a module-level logger that has no`guildId`
in its static filters.

`info`/`warn`/`error`/`fatal` always pass through unconditionally — there is no log-level control.

All public debug filter methods operate across all shards via `broadcastEval`. Single-shard methods are prefixed with`_`
and should not be used directly.

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
    {
      "feature": "api.events"
    },
    {
      "guildId": "123456789"
    }
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
collections, and provides a live log viewer backed by the bot's pino log files. Runs as a separate Docker service.

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
| Logs               | `/logs`         | `logs/*.get.ts`       | Live tail + historical viewer for pino JSON log files with filtering and JSON drill-down          |

### Server Connections — Interactive Pie Chart

The Server Connections page has a single pie chart with drill-down behaviour:

- **Main view** ("Feature Adoption"): shows how many servers use each feature.
- **Drill-down**: clicking a drillable segment (Chat Channels, Synced Roles) replaces the chart with a breakdown view. A
  back button returns to the main view. Non-drillable segments (Required Role, Floodgate) do nothing on click.

When a **new server connection feature** is added to the bot, update these places:

1. **API route** (`server/api/servers.get.ts`): add a counter variable, increment it in the server loop, include it in
   the returned `stats` object. If the feature has sub-categories, add a breakdown object too.
2. **Pie chart data** (`pages/servers.vue`): add the new label to the main `pieChartData` computed (labels + data
   arrays). If it should be drillable, add an entry to the `DRILLABLE` map and a new `if` branch in `pieChartData` for
   the breakdown view.
3. **Schema** (`server/utils/db.ts`): add the new field to `serverConnectionSchema` if it needs to be queried/typed.

Current main pie chart features:

- Chat Channels — servers with ≥1 chat channel (drills into chat event types
- Synced Roles — servers with ≥1 synced role (drills into role sync directions)
- Required Role — servers with required-role-to-join active (not drillable)
- Floodgate — servers with a floodgate prefix set (not drillable)

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
