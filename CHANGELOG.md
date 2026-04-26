# Changelog

## 4.1.0 - Linked Messages

### New Features

- **Minecraft → Discord DMs (`/dm`):** Players can now send direct messages to linked Discord users from Minecraft using `/dm <user> <message>`. Supports targeting by Minecraft username, UUID, Discord user ID, or Discord username. Discord users can reply directly to the DM and their reply is forwarded back to the Minecraft player.
- **DM Preferences (`/account dms`):** Users can block or unblock DMs globally, from a specific Minecraft server, or from individual players via `/account dms block/unblock`. Autocomplete is provided for unblocking previously blocked players.
- **Analytics Dashboard:** New Nuxt 3 web dashboard for server operators to monitor bot performance. Tracks guild/user counts, command usage, API call rates, shard health (CPU/memory), chat pipeline throughput, server connection feature adoption, and a live log viewer with filtering and JSON drill-down. Runs as a separate Docker service.
- **Plugin Version Awareness:** The bot now reads the `pluginVersion` field sent by the Minecraft plugin during connection (from plugin v4.3.0+), including `-SNAPSHOT` builds, for future capability negotiation.

### Changes

- **`/statchannel` Refactor:** Stat channels now use a unified `online`/`offline` template pair instead of separate status and member-count channels. A new `update_target` option (`Name` or `Topic`) allows updating the channel name or the channel topic/description. Supports `%count%`, `%ip%`, `%time%`, and `%version%` placeholders in both templates.
- **Hierarchical Debug Logging:** Logger rewritten as a class-based pino wrapper with per-feature, per-guild, and per-user debug filters. Filters can be toggled at runtime across all shards without restarts. All features are catalogued in `resources/logFeatures.json`.
- **Analytics Error Tracking:** All error paths now route through a unified `trackError` helper that both logs the error and buffers it for the analytics error collection. Per-shard `AnalyticsCollector` and a shard-0 `AnalyticsAggregator` persist hourly snapshots to MongoDB.
- **Utilities Refactor:** `utilities/utils.js` split into focused modules: `canvas-utils.js`, `discord-utils.js`, `format-utils.js`, `minecraft-utils.js`, `nbt-utils.js`, `uuid-utils.js`, `protocol-utils.js`, and `sharding-utils.js`.
- **Command/Component/Event Pattern:** All handlers now implement `run()` instead of `execute()`. The base `execute()` handles deferring, permission checks, server validation, child logger creation, and analytics tracking, then delegates to `run()`.
- **Components v2 Support:** Discord message components upgraded to support the Components v2 API (containers, text displays).
- **`/account disconnect`:** Now also kicks the user from all Minecraft servers that have a required role to join.
- **Hash-Indexed Server Lookups:** Server connection lookups by token hash are now backed by an in-memory index for O(1) lookups on reconnect.

### Bug Fixes

- Fixed stat channels that had the same channel ID as an existing entry not being replaced correctly.
- Fixed DM reply modal not working; replaced with a message collector listening for replies to the DM message.
- Fixed `topic` vs `name` support detection being inverted for stat channels.
- Fixed shard propagation: all in-place mutations to connection data (synced role players, chat channel webhooks, DM preferences, filtered commands) now broadcast the updated field to other shards instead of an empty `edit({})`.
