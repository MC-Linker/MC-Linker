# Changelog

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
