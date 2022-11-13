[![Crowdin](https://badges.crowdin.net/minecraft-smp-bot/localized.svg)](https://crowdin.com/project/minecraft-smp-bot) [![Commit-Aktivität](https://img.shields.io/github/commit-activity/m/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![Gesamte Commits](https://badgen.net/github/commits/MC-Linker/MC-Linker/main)](https://github.com/MC-Linker/MC-Linker) [![Code-Größe](https://img.shields.io/github/languages/code-size/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![Repo-Größe](https://img.shields.io/github/repo-size/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![Lizenz](https://img.shields.io/badge/license-CC%20BY--NC%204.0-red)](https://github.com/MC-Linker/MC-Linker/blob/main/LICENSE.md)

Schau dir Minecraft-Statistiken, Fortschritte und Inventare in Discord an! Also includes moderation tools, minecraft commands, two-way chat and much more.

# BESCHREIBUNG

Moderiere und verbinde deinen Minecraft-Server mit Discord! This bot allows you to view minecraft stats, advancements, and even inventories of any member in Discord. Also supports a powerful two-way chat with Minecraft, command execution and many other helpful features.

# SETUP

To use most of the commands you’ll have to connect your Minecraft **java-edition** server with the bot. There are two methods to connect:

+ Plugin
    + Lade das "Discord Linker" Plugin mit [diesen Link herunter](https://www.spigotmc.org/resources/discord-linker.98749/)
    + Füge das Plugin deinem Minecraft-Server hinzu
    + Starte deinen Minecraft-Server neu oder führe `/reload confirm` auf deinem Minecraft-Server aus
    + Führe `/connect plugin <deine server ip>` in Discord aus
    + Folge den Anweisungen, die du per persönlicher Nachricht in Discord erhalten wirst
    + After connecting you can also execute `/chatchannel <channel>` in Discord if you want to connect the minecraft chat with Discord
+ FTP (kein Minecraft-Chat oder Befehle)
    + Get the ftp credentials from your Minecraft server’s dashboard. Join the [Support Server](https://discord.gg/rX36kZUGNK) or ask your host's support team if you need help getting the credentials
    + Führe `/connect ftp` in Discord aus und gib deine Zugangsdaten ein

# WICHTIGE BEFEHLE

+ `/help`: Detaillierte Beschreibung und Verwendung jedes Befehls
+ `/inventory`: Zeige das Inventar eines Mitglieds an
+ `/chatchannel`: Lege einen Kanal fest, in dem der Bot den Minecraft-Chat sendet (nur für Plugin)
+ `/command`: Execute any minecraft command on your server (only for plugin)
+ `/stats`: Zeige Minecraft-Statistiken von einem User an
+ `/advancements`: Zeige Minecraft-Fortschritte von einem User an
+ `/account connect`: Connect your Discord Account with your Minecraft Account
+ `/connect plugin` ODER `/connect ftp`: Verbinden Sie Ihren Minecraft-Server mit dem Bot
+ `/Deaktiviere`: Deaktiviere bestimmte Befehle, Fortschritte oder Statistiken
+ `/ban`: Banne einen Spieler direkt vom Minecraft-Server
+ `/op`: OP ein Spieler auf dem Minecraft-Server

# FEHLERBEHEBUNG

+ Unfortunately, **Aternos** and **Minehut** servers currently don't work because they do not support ftp or additional ports for plugins
+ Wenn du den Fehler: `Address already in use` in der Server-Konsole erhältst, folge den Anweisungen des nächsten Punktes
+ If you receive the error: `Plugin does not respond` by the Discord bot although your server is online, follow these steps:
    + Registriere oder forwarde einen zusätzlichen Port (falls von Ihrem Serveranbieter unterstützt)
    + Führe `/linker port <port>` in Minecraft aus und stelle sicher, dass du den neu registrierten/weitergeleiteten Port angibst
    + Führe `/connect plugin <deine server ip> <port>` in Discord mit der generierten Portnummer aus
+ Weitere Hilfe => [Support Server](https://discord.gg/rX36kZUGNK)

### [Datenschutzerklärung](https://github.com/Lianecx/Minecraft-SMP-Bot/blob/main/PRIVACY.md)

### [Terms of Service](https://github.com/Lianecx/Minecraft-SMP-Bot/blob/main/TERMS.md)

