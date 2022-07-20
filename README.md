[![Crowdin](https://badges.crowdin.net/minecraft-smp-bot/localized.svg)](https://crowdin.com/project/minecraft-smp-bot) [![Commit Activity](https://img.shields.io/github/commit-activity/m/Lianecx/Minecraft-SMP-Bot)](https://github.com/Lianecx/Minecraft-SMP-Bot) [![Total Commits](https://badgen.net/github/commits/Lianecx/Minecraft-SMP-Bot/main)](https://github.com/Lianecx/Minecraft-SMP-Bot) [![Code Size](https://img.shields.io/github/languages/code-size/Lianecx/Minecraft-SMP-Bot)](https://github.com/Lianecx/Minecraft-SMP-Bot) [![Repo Size](https://img.shields.io/github/repo-size/Lianecx/Minecraft-SMP-Bot)](https://github.com/Lianecx/Minecraft-SMP-Bot) [![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-red)](https://github.com/Lianecx/Minecraft-SMP-Bot/blob/main/LICENSE.md)
<br>
View minecraft stats, advancements and inventories in Discord! Also includes moderation tools, minecraft commands and much more.

# DESCRIPTION
Moderate and connect your Minecraft server with Discord! This bot allows you to view minecraft stats, advancements, and even inventories of any member in Discord. Also supports a powerful two-way chat with Minecraft, command execution and many other helpful features.

# SETUP
To use most of the commands you’ll have to connect your Minecraft **java edition** server with the bot. There are two methods to connect:
+ Plugin
	+ Download the "Discord Linker" plugin using [this link](https://www.spigotmc.org/resources/discord-linker.98749/)
	+ Put the plugin on your Minecraft server (must support plugins)
	+ Restart your Minecraft server or execute `/reload confirm` on your Minecraft server
	+ Execute `/connect plugin <your server ip>` in Discord
	+ Follow the instructions sent in DM
	+ After connecting you can also execute `/chatchannel <channel>` in Discord if you want to connect the minecraft chat with Discord
+ FTP (no minecraft chat or commands)
	+ Get the ftp credentials on your Minecraft server’s dashboard. Not all server hosts support ftp, join the [Support Server](https://discord.gg/rX36kZUGNK) or ask your host's support team if you need help getting the credentials
	+ Execute `/connect ftp` in Discord and enter your credentials

# IMPORTANT COMMANDS
+ `/help`: Detailed description and usage of every command!
+ `/stats`: Look up minecraft stats of any member.
+ `/advancements`: Look up minecraft advancements of any member.
+ `/connect account`: Connect your Discord Account with your Minecraft Account.
+ `/connect plugin` OR `/connect ftp`: Connect your Minecraft Server with the bot.
+ `/chatchannel`: Set a channel in which the bot will send the minecraft chat (only for plugin).
+ `/disable`: Disable specific commands, advancements, or stats.
+ `/inventory`: Look in the inventory of any member.
+ `/ban`: Ban a player directly from the minecraft-server.
+ `/op`: OP a player on the minecraft-server.
+ `/command`: Execute any minecraft command.

# TROUBLESHOOTING
+ Unfortunately, **Aternos** and **Minehut** servers currently don't work because they do not support ftp or additional ports for plugins
+ If you receive the error: `Address already in use` in the server console follow the instructions of the next point
+ If you receive the error: `Plugin does not respond` by the Discord bot although your server is online, follow these steps:
	+ Register or forward an additional port (if supported from your server host)
	+ Execute `/linker port <port>` in Minecraft.
	+ Execute `/connect plugin <your server ip> <port>` in Discord and make sure to specify the correct port from the config.yml
+ More help => [Support Server](https://discord.gg/rX36kZUGNK)


### [Privacy Policy](https://github.com/Lianecx/Minecraft-SMP-Bot/blob/main/PRIVACY.md)
