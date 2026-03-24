[![Crowdin](https://badges.crowdin.net/minecraft-smp-bot/localized.svg)](https://crowdin.com/project/minecraft-smp-bot) [![Commit Activity](https://img.shields.io/github/commit-activity/m/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![Total Commits](https://badgen.net/github/commits/MC-Linker/MC-Linker/main)](https://github.com/MC-Linker/MC-Linker) [![Code Size](https://img.shields.io/github/languages/code-size/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![Repo Size](https://img.shields.io/github/repo-size/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-red)](https://github.com/MC-Linker/MC-Linker/blob/main/LICENSE.md)

# MC Linker

MC Linker is the easiest way to connect your Minecraft server with Discord. NO custom bot creation or configuration files needed! Add chat bridges, view player stats, advancements, and inventories, run commands and moderate your server all within Discord.

## Features

- **Chat Bridge** — Sync your Minecraft server chat with Discord channels via webhooks. Supports chat messages, join/quit notifications, death messages, advancements, commands, and server start/stop events. Filter which events and commands appear in Discord.
- **Inventory Viewer** — Render and display any player's inventory directly in Discord, including armor, hotbar, and offhand slots.
- **Stats & Advancements** — Look up detailed Minecraft statistics and advancement trees for any player on your server.
- **Server Moderation** — Ban, unban, kick, op, deop, and change gamemodes for players directly from Discord.
- **Remote Commands** — Execute any Minecraft command on your server from Discord with tab-completion support.
- **Stat Channels** — Automatically updating Discord channels that display your server's online status or player count.
- **Role Sync** — Sync Discord roles with Minecraft teams and permission groups.
- **Account Linking** — Let players connect their Discord and Minecraft accounts for a seamless experience.
- **Linked Roles** — Discord linked-role connections powered by OAuth2. Grants a role on linking account and displays a badge on a member profile.
- **Server & User Info** — View detailed information about your connected server (properties, gamerules, operators, server icon) or any connected user.
- **Private Messaging** — Send private messages to online players from Discord.
- **Custom Bot** — Subscribers can run MC Linker as their own custom Discord bot with a custom presence.
- **Localization** — Translated via [Crowdin](https://crowdin.com/project/minecraft-smp-bot); contributions welcome.

## Setup

### 1. Add the Discord bot

Invite the **MC Linker** bot from the [Discord App Directory](https://discord.com/application-directory/712759741528408064) or from [Top.gg](https://top.gg/bot/712759741528408064).

### 2. Install the Minecraft plugin

Add the **Discord-Linker** plugin/mod to your Minecraft Java Edition server from any of these sources:

| Platform     | Link                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| SpigotMC     | [spigotmc.org](https://www.spigotmc.org/resources/discord-linker.98749/)         |
| Modrinth     | [modrinth.com](https://modrinth.com/plugin/discord-linker)                       |
| Paper Hangar | [hangar.papermc.io](https://hangar.papermc.io/Lianecx/Discord-Linker)            |
| CurseForge   | [curseforge.com](https://legacy.curseforge.com/minecraft/mc-mods/discord-linker) |
| Aternos      | [aternos.org](https://aternos.org/addons/a/spigot/98749)                         |

The plugin supports **Spigot**, **Paper**, and other Bukkit-compatible servers, as well as **Fabric** and **Forge** via [Stonecutter](https://stonecutter.kikugie.dev/).

### 3. Connect

1. Restart your Minecraft server (or run `/reload confirm`)
2. Run `/connect` in Discord
3. Follow the instructions in the embed

Optionally, run `/chatchannel add` in Discord to set up the chat bridge.

## Commands

### Core

| Command            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `/help`            | Detailed description and usage of every command       |
| `/connect`         | Connect your Minecraft server with the bot            |
| `/disconnect`      | Disconnect your server                                |
| `/account connect` | Link your Discord account with your Minecraft account |
| `/customize`       | Customize the bot's appearance for your server        |

### Player Info

| Command         | Description                                 |
| --------------- | ------------------------------------------- |
| `/inventory`    | View the inventory of any player            |
| `/stats`        | Look up Minecraft stats of any player       |
| `/advancements` | Browse Minecraft advancements of any player |
| `/userinfo`     | Display information about a connected user  |
| `/message`      | Send a private message to an online player  |

### Server Management

| Command        | Description                                       |
| -------------- | ------------------------------------------------- |
| `/command`     | Execute any Minecraft command on your server      |
| `/serverinfo`  | Display information about your server             |
| `/chatchannel` | Configure the Discord chat bridge channel         |
| `/statchannel` | Set up auto-updating status/player-count channels |
| `/rolesync`    | Sync Discord roles with Minecraft teams/groups    |

### Moderation

| Command     | Description                            |
| ----------- | -------------------------------------- |
| `/ban`      | Ban a player from the Minecraft server |
| `/unban`    | Unban a player                         |
| `/kick`     | Kick a player                          |
| `/op`       | Grant operator status                  |
| `/deop`     | Revoke operator status                 |
| `/gamemode` | Change a player's gamemode             |

## Plugin Repository

The Minecraft server plugin source code is available at [MC-Linker/Discord-Linker](https://github.com/MC-Linker/Discord-Linker).

## Links

- [Website](https://mclinker.com)
- [Support Server](https://discord.gg/rX36kZUGNK)
- [Top.gg](https://top.gg/bot/712759741528408064)
- [Privātuma politika](https://mclinker.com/privacy)
- [Terms of Service](https://mclinker.com/tos)

## License

This project is licensed under [CC BY-NC 4.0](LICENSE.md).
