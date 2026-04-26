By using the Discord bot `MC Linker`, you agree that you have read and agreed to this policy.
This is our Privacy Policy, which will describe the types of data collected, how it is used, how to opt out of data
collection, and how to remove your data.

**Last Updated: April 10, 2026**

The terms "we", "us", and "our" refer to the owner and moderators of `MC Linker`. The terms "bot" and "MC Linker" refer
to the Discord bot itself.
We may update this Privacy Policy at any time. Any changes that are made will be made effective immediately. If you are
a regular user of our bot, please make sure you are kept up to date with this Privacy Policy.

# PRIVACY STATEMENT

We respect the privacy of your information. This policy describes the types of information that we may collect from you
or that you may provide when you use our bot, as well as describing our practices for collecting, using, maintaining,
protecting and disclosing that information.
**This policy applies to any data collected through these sources:**

- Data provided directly by users
- Commands and interactions used with the bot

# THE INFORMATION WE COLLECT AND HOW WE COLLECT IT

MC Linker collects and processes information to provide its core bridging functionality, maintain stability, and operate
connected Discord and Minecraft features.

**User Connections (Account Linking):**
When you use `/account connect` to link your Minecraft account to your Discord account, we store:

- Your Discord User ID.
- Your Minecraft Username and UUID.

Basic account linking does not store Discord OAuth tokens.

**Linked Roles Authorization:**
If you use Discord's linked-role authorization flow, we additionally store:

- A Discord OAuth access token.
- A Discord OAuth refresh token.
- The token expiry time.

These tokens are used only to maintain your Discord linked-role connection and update your linked-role metadata.

**Server Connections (Guild Linking):**
When a Server Administrator connects a Discord server to a Minecraft server, we store:

- The Discord Server (Guild) ID.
- The Minecraft Server IP, optional Display IP, and connection Port.
- The Minecraft server path and world path reported by the plugin.
- The connection hash used to authenticate the plugin connection.
- Channel configurations for features like chat relay and server stat tracking.
- Discord webhook IDs created and used for chat relay.
- Role synchronization configurations (defining which Discord roles map to which Minecraft groups/teams).
- Required-role-to-join settings, online-mode related settings, and floodgate prefix settings.

We do not describe legacy or deprecated connection methods here unless they are part of the current stored bot data
model.

**Optional Custom Bot Configuration:**
If you use the custom bot feature, we store the owning Discord User ID, the assigned port, and the communication token
required for that custom bot instance.

**Analytics, Usage Data, and Error Logging:**
To maintain bot reliability and monitor performance, we automatically collect:

- **Usage Statistics:** Aggregate metrics such as command and component execution counts, average execution durations,
  API call counts, active server connection counts, and chat relay throughput, queue depth, rate-limit, and failure
  statistics.
- **Error Logs:** When an error occurs, we may store the error message, stack trace, error code, timestamp, shard ID,
  and associated Discord Server ID and/or User ID. This helps us identify, reproduce, and fix bugs.
- **Operational Logging:** Bot operations may also log command and interaction metadata needed to diagnose failures,
  investigate abuse, and operate the service.

User connections, user settings, server connections, server settings, and analytics records are stored in our MongoDB
database. Data is provided voluntarily when you connect accounts, connect servers, configure features, or authorize
optional integrations.

# HOW WE USE INFORMATION

**Connections & Settings:**
Connection data is used strictly to provide the bot's features—allowing bidirectional communication between the mapped
Discord Server and Minecraft Server, synchronizing chat, updating statistics, and syncing player roles.

**Analytics & Errors:**
Analytics and error logs are used solely for monitoring the bot's health, optimizing performance, tracking rate limits,
diagnosing bugs, and maintaining service reliability. We do not use this data for marketing or behavioral profiling.

**Data Sharing:**
We do not sell, rent, or share your personally identifiable information or server data with any third parties. All data
is completely internal to the operation and maintenance of MC Linker.

# OPTING OUT

How to opt out of having this data collected:
<br>**Server owners/admins:**<br>
To stop future server-related data collection, remove MC Linker from your Discord server and disconnect any linked
Minecraft server with `/disconnect` first when possible.
<br>**Server members:**<br>
To stop future account-related data collection, do not use the bot, disconnect your account with `/account disconnect`,
and do not authorize the linked-role flow.

# REMOVAL OF DATA

**User and Server Connections:**
Most user and server connection data can be self-managed and deleted using our implemented commands.

- To unlink your Minecraft account from your Discord profile, use the `/account disconnect` command. This removes the
  stored Discord-to-Minecraft account link.
- To disconnect a Minecraft server from your Discord server and remove the stored server connection and mapped feature
  configuration, server administrators can use the `/disconnect` command.

**Analytics, Errors, and Commands:**
Analytics snapshots and error records may be stored in our database until they are manually cleared by us. This policy
does not guarantee a fixed automatic deletion window for those records. If you want us to review or remove specific
records associated with your User ID or Server ID, contact us using the details below.

# THIRD-PARTY WEBSITES

MC Linker may link to third-party websites. These websites are separate from our bot and will have their own
privacy policies. Any data collected through these third-party websites is separate and unrelated to the bot.

# CONTACT INFORMATION

If you have any questions about this Privacy Policy, you can contact us:

- By email: [info@mclinker.com](mailto:info@mclinker.com)
- Support Discord Server: [MC Linker Hub](https://discord.gg/rX36kZUGNK)
- Discord DM: @lianecx
