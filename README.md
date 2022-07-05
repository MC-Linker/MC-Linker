View minecraft stats, advancements and inventories in Discord! Also includes moderation tools, minecraft commands and much more.

# DESCRIPTION
Moderate and connect your Minecraft server with Discord! This bot allows you to view minecraft stats, advancements, and even inventories of any member. Also supports a powerful two-way chat with Minecraft, command execution and many other helpful features.

# SETUP
To use most of the commands you’ll have to connect your Minecraft **java edition** server with the bot. There are two methods to connect:
+ Plugin
	+ Download the plugin using [this link](https://www.spigotmc.org/resources/categories/tools-and-utilities.15/)
	+ Put the plugin on your Minecraft server (must support plugins)
	+ Restart your Minecraft server or execute `/reload confirm` on your Minecraft server
	+ Execute `/connect plugin YOUR.SERVER.IP` in Discord
	+ Follow the instructions sent in DM
	+ After connecting you can also execute `/chatchannel CHANNEL` in Discord if you want to connect the minecraft chat with Discord
+ FTP (doesn't support minecraft chat)
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
+ `/command`: Execute any minecraft command.

# TROUBLESHOOTING
+ Unfortunately, **Aternos** and **Minehut** servers are currently don't work because they do not support ftp or additional ports for plugins.
+ If you receive the error: `Address already in use` in the server console follow the instructions of the next point.
+ If you receive the error: `Plugin does not respond` by the Discord bot although your server is online, follow these steps:
	+ Register or port forward an additional port (if supported from your server host)
	+ Enter that port in the plugin’s `config.yml`.
	+ Execute `reload confirm` in your server console
	+ Execute `/connect plugin YOUR.SERVER.IP config_port` in Discord and make sure to specify the correct port from the config.yml
+ More help => [Support Server](https://discord.gg/rX36kZUGNK)


### [Privacy Policy](https://github.com/Lianecx/Minecraft-SMP-Bot/blob/main/PRIVACY.md)
