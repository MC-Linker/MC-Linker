[![Crowdin](https://badges.crowdin.net/minecraft-smp-bot/localized.svg)](https://crowdin.com/project/minecraft-smp-bot) [![Commit Activity](https://img.shields.io/github/commit-activity/m/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![Total Commits](https://badgen.net/github/commits/MC-Linker/MC-Linker/main)](https://github.com/MC-Linker/MC-Linker) [![Code Size](https://img.shields.io/github/languages/code-size/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![Repo Size](https://img.shields.io/github/repo-size/MC-Linker/MC-Linker)](https://github.com/MC-Linker/MC-Linker) [![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-red)](https://github.com/MC-Linker/MC-Linker/blob/main/LICENSE.md)
<br>
Δείτε στατιστικά του minecraft, επιτεύγματα και αποθέματα στο Discord! Also includes moderation tools, minecraft commands, two-way chat and much more.

# ΠΕΡΙΓΡΑΦΗ
Moderate and connect your Minecraft server with Discord! This bot allows you to view minecraft stats, advancements, and even inventories of any member in Discord. Also supports a powerful two-way chat with Minecraft, command execution and many other helpful features.

# ΡΥΘΜΙΣΗ
Για να χρησιμοποιήσεις τις περισσότερες εντολές θα πρέπει να συνδέσεις τον διακομιστή του Minecraft **java έκδοση** με το bot. Υπάρχουν δύο μέθοδοι σύνδεσης:
+ Πρόσθετα
    + Download the "Discord Linker" plugin using [this link](https://www.spigotmc.org/resources/discord-linker.98749/)
    + Add the plugin to your Minecraft server
    + Επανεκκινήστε τον διακομιστή Minecraft ή εκτελέστε `/reload επιβεβαιώστε` στον διακομιστή σας Minecraft
    + Execute `/connect plugin <your server ip>` in Discord
    + Ακολουθήστε τις οδηγίες που σας στάλθηκαν
    + After connecting you can also execute `/chatchannel <channel>` in Discord if you want to connect the minecraft chat with Discord
+ FTP (no minecraft chat or commands)
    + Αποκτήστε τα διαπιστευτήρια ftp στον πίνακα ελέγχου του Minecraft. Not all server hosts support ftp, join the [Support Server](https://discord.gg/rX36kZUGNK) or ask your host's support team if you need help getting the credentials
    + Εκτέλεση του `/connect ftp` στο Discord και εισαγωγή των διαπιστευτηρίων σας

# ΣΗΜΑΝΤΗΚΕΣ ΕΝΤΟΛΕΣ
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

# ΔΙΩΡΘΩΣΗ ΠΡΟΒΛΗΜΑΤΩΝ
+ Unfortunately, **Aternos** and **Minehut** servers currently don't work because they do not support ftp or additional ports for plugins
+ If you receive the error: `Address already in use` in the server console follow the instructions of the next point
+ If you receive the error: `Plugin does not respond` by the Discord bot although your server is online, follow these steps:
    + Register or forward an additional port (if supported from your server host)
    + Execute `/linker port <port>` in Minecraft and make sure to specify the newly registered/forwarded port
    + Execute `/connect plugin <your server ip> <port>` in Discord with the same port number
+ Περισσότερη βοήθεια => [Υποστήριξη διακομιστή](https://discord.gg/rX36kZUGNK)


### [Πολιτική Απορρήτου](https://github.com/Lianecx/Minecraft-SMP-Bot/blob/main/PRIVACY.md)
