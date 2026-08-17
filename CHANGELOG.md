# Changelog

## 4.3.0 - Dynamically Rendered Items + Minecraft 26 Support

### New Features

- **Dynamic 3D item and block images:** inventories, stats and advancements now show items dynamically rendered from the
  server's own Minecraft version instead of a fixed set of bundled images. Items added in newer versions automatically
  show up correctly.
- **Automatic asset downloads:** the assets for a version are downloaded the first time a server on that version uses
  them, shown as a short "Preparing Minecraft Assets" step. Every later command uses them instantly.
- **Minecraft 26 support:** `/stats`, `/advancements`, `/inventory` and `/userinfo` now work on Minecraft 26 servers,
  which store player files in a new location.

### Bug Fixes

- Fixed commands occasionally showing a player's data from a different server while a server was offline.
- Fixed Bedrock accounts being linked with the wrong UUID, which made them unrecognised on the server.
- Linking a Minecraft account that already belongs to another Discord user now shows a clear message naming that user
  instead of failing silently.
- Fixed `/inventory` item buttons showing wrong details and shulker box pages not opening.
- Fixed per-server accounts sometimes not being found, so commands fell back to the global account.
- Fixed the console channel dropping or cutting off long lines of server output.

## 4.2.0 - Cracked + Per-Server Accounts

### New Features

- **Cracked accounts** can now connect on offline-mode servers via `/verify` and `/account connect`. Previously these
  were rejected because Mojang has no record of cracked usernames.
- **`/account manage`:** new command to view and manage every link you have (global + per-server)
  with buttons for Disconnect, Promote To Global, and Use On This Server.
- **Per-server profiles:** you can now hold a global account plus one extra account per server, all at once. Per-server
  profiles override the global one only on that server.
- **`set-as-global` option on `/account connect`:** opt out of making a premium account your global default.

### Changes

- **`/account disconnect`** now disconnects the link active for the current server (per-server first, falling back to
  global). When global is disconnected, you only get kicked from required-role servers where you have no remaining link.

## 4.1.0 - DM Command + Stat Channel Topic

### New Features

- **`/dm` command:** Minecraft players can now DM linked Discord users directly from the game. Discord users can reply
  and the reply is delivered back in Minecraft.
- **DM preferences (`/account dms`):** Block or unblock DMs globally, per server, or per player.
- **Analytics dashboard:** Owner-facing web dashboard with guild/shard stats, command usage, error logs, chat pipeline
  metrics, and a live log viewer.

### Changes

- **`/statchannel` rework:** Online and offline templates are now separate. New `update_target` option to update the
  channel name or its topic. Old member-count channels are migrated automatically.
- **`/account disconnect`:** Now also removes the user from all Minecraft servers that require a Discord role to join.

### Bug Fixes

- Fixed adding a stat channel with an already-used channel ID not replacing the existing entry.
