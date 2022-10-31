[![Crowdin](https://badges.crowdin.net/minecraft-smp-bot/localized.svg)](https://crowdin.com/project/minecraft-smp-bot) [![Commit-Aktivität](https://img.shields.io/github/commit-activity/m/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![Gesamte Commits](https://badgen.net/github/commits/MC-Linker/MC-Linker/main)](https://github.com/MC-Linker/MC-Linker) [![Code-Größe](https://img.shields.io/github/languages/code-size/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![Repo-Größe](https://img.shields.io/github/repo-size/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![Lizenz](https://img.shields.io/badge/license-CC%20BY--NC%204.0-red)](https://github.com/MC-Linker/MC-Linker/blob/main/LICENSE.md)
<br>
Schau dir Minecraft-Statistiken, Fortschritte und Inventare in Discord an! Also includes moderation tools, minecraft commands, two-way chat and much more.

# BESCHREIBUNG
Moderiere und verbinde deinen Minecraft-Server mit Discord! Dieser Bot erlaubt dir, Minecraft-Statistiken, Erweiterungen und sogar Inventare von jedem Mitglied in Discord anzuzeigen. Unterstützt auch einen leistungsstarken Zwei-Wege-Chat mit Minecraft, Befehlsausführung und viele andere hilfreiche Features.

# SETUP
Um die meisten Befehle nutzen zu können, musst du deinen Minecraft **Java-Edition** Server mit dem Bot verbinden. Es gibt zwei Methoden zum Verbinden:
+ Plugin
    + Lade das "Discord Linker" Plugin mit [diesen Link herunter](https://www.spigotmc.org/resources/discord-linker.98749/)
    + Add the plugin to your Minecraft server
    + Starte deinen Minecraft-Server neu oder führe `/reload confirm` auf deinem Minecraft-Server aus
    + Führe `/connect plugin <deine server ip>` in Discord aus
    + Folge den Anweisungen, die du per persönlicher Nachricht in Discord erhalten wirst
    + Nach dem Verbinden kannst du `/chatchannel <kanal>` in Discord ausführen, wenn du den Minecraft-Chat mit Discord verbinden möchtest
+ FTP (no minecraft chat or commands)
    + Hole dir die ftp-Anmeldeinformationen aus dem Dashboard deines Minecraft-Servers. Nicht alle Serveranbieter unterstützen ftp, betreten Sie den [Support Server](https://discord.gg/rX36kZUGNK) wenn Sie Hilfe benötigen, um die Zugangsdaten zu erhalten
    + Führe `/connect ftp` in Discord aus und gib deine Zugangsdaten ein

# WICHTIGE BEFEHLE
+ `/help`: Detailed description and usage of every command
+ `/stats`: Look up minecraft stats of any member
+ `/advancements`: Look up minecraft advancements of any member
+ `/connect account`: Connect your Discord Account with your Minecraft Account
+ `/connect plugin` OR `/connect ftp`: Connect your Minecraft Server with the bot
+ `/chatchannel`: Set a channel in which the bot will send the minecraft chat (only for plugin)
+ `/disable`: Disable specific commands, advancements, or stats
+ `/inventory`: Look in the inventory of any member
+ `/ban`: Ban a player directly from the minecraft-server
+ `/op`: OP a player on the minecraft-server
+ `/command`: Execute any minecraft command

# FEHLERBEHEBUNG
+ Leider funktionieren **Aternos** und **Minehut** Server derzeit nicht, da sie kein ftp oder zusätzliche Ports für Plugins unterstützen
+ Wenn du den Fehler: `Address already in use` in der Server-Konsole erhältst, folge den Anweisungen des nächsten Punktes
+ Wenn du den Fehler: `Plugin reagiert nicht` vom Discord Bot erhältst, obwohl dein Server online ist, folge den nächsten Schritten:
    + Registriere oder forwarde einen zusätzlichen Port (falls von Ihrem Serveranbieter unterstützt)
    + Execute `/linker port <port>` in Minecraft and make sure to specify the newly registered/forwarded port
    + Execute `/connect plugin <your server ip> <port>` in Discord with the same port number
+ Weitere Hilfe => [Support Server](https://discord.gg/rX36kZUGNK)


### [Datenschutzerklärung](https://github.com/Lianecx/Minecraft-SMP-Bot/blob/main/PRIVACY.md)
