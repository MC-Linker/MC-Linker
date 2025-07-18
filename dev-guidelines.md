# MC-Linker Development Guidelines

This document provides essential information for developers working on the MC-Linker project. It includes build
instructions, testing guidelines, and other relevant development information.

## Build and Configuration

### Prerequisites

- Node.js (LTS version recommended)
- MongoDB
- Docker and Docker Compose (for containerized deployment)

### Environment Variables

The application requires several environment variables to function properly. Create a `.env` file in the project root
with the following variables:

```
# Core Discord Bot Variables
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_client_id
CLIENT_SECRET=your_discord_application_client_secret
PREFIX=^  # Command prefix for text commands
GUILD_ID=space_separated_guild_ids  # For development/testing
OWNER_ID=your_discord_user_id
DISCORD_LINK=your_bot_invite_link

# Database Variables
DATABASE_URL=mongodb://localhost:27017/mc-linker  # MongoDB connection string

# API and Web Server Variables
BOT_PORT=3000  # Port for the bot's API server
COOKIE_SECRET=your_cookie_secret  # For secure cookies
LINKED_ROLES_REDIRECT_URI=http://your_ip/linked-role/callback  # For Discord linked roles

# Microsoft/Minecraft Integration
MICROSOFT_EMAIL=your_microsoft_email
MICROSOFT_PASSWORD=your_microsoft_password
AZURE_CLIENT_ID=your_azure_client_id
PLUGIN_VERSION=3.6  # Version of the Minecraft plugin
PLUGIN_PORT=11111  # Port for the Minecraft plugin

# Optional Variables
TOPGG_TOKEN=your_topgg_token  # For Top.gg integration
DEBUG=true  # Enable debug mode
CONVERT=false  # Conversion flag
```

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/MC-Linker/MC-Linker.git
   cd MC-Linker
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Configure environment variables as described above.

### Running the Application

#### Development Mode

Run the application directly with Node.js:

```bash
node main.js
```

For automatic restarts on crashes:

- Windows: Use `run.bat`
- Unix/Linux: Use `run.sh`

#### Production Deployment

Use Docker Compose for production deployment:

```bash
docker-compose up -d
```

This will start:

- The MC-Linker bot
- MongoDB database
- Mongo Express (web-based MongoDB admin interface)

## Testing

The project doesn't have a formal testing framework set up, but you can use Node.js's built-in `assert` module for basic
testing.

### Creating Tests

1. Create test files in the `tests` directory
2. Use the Node.js `assert` module for assertions
3. Follow the naming convention: `*.test.js` for test files

### Example Test

Here's an example of a simple test file:

```javascript
import assert from 'assert';
import { formatUsername } from './testUtils.js';

console.log('Testing formatUsername function:');

// Test case
console.log('Test: Format username with spaces');
assert.strictEqual(formatUsername('Player One'), 'PlayerOne', 'Should remove spaces');
console.log('✅ Test passed');
```

### Running Tests

Run tests using Node.js:

```bash
node tests/your-test-file.test.js
```

For more complex testing needs, consider adding Jest or Mocha to the project.

## Project Structure

The MC-Linker project is organized as follows:

- `bot.js`: Main bot implementation
- `main.js`: Entry point that sets up sharding
- `commands/`: Discord bot commands
- `buttons/`: Discord button interactions
- `events/`: Discord events
- `structures/`: Core classes and data structures
- `utilities/`: Utility functions and helpers
- `resources/`: Static resources (languages, images, etc.)
- `scripts/`: Utility scripts for deployment and other tasks

### Key Components

- **MCLinker**: Custom Discord.js client extension
- **ServerConnection**: Manages connections to Minecraft servers
- **Protocol implementations**: HTTP, FTP, WebSocket for server communication
- **Command structure**: Handles both slash commands and prefix commands
- **Translation system**: Multi-language support

### Deployment

The application uses Docker for containerized deployment:

1. The Dockerfile builds a Node.js container with the application
2. Docker Compose orchestrates the application, MongoDB, and Mongo Express
3. Volumes are used for persistent data storage

### Sharding

The bot uses Discord.js's ShardingManager for scalability:

1. `main.js` sets up the sharding manager
2. Each shard runs an instance of `bot.js`
3. The API server is only started on shard 0

## Development Patterns

### Command Structure

Commands should extend the `Command` class and implement the `execute` method:

```javascript
import Command from './Command.js';

export default class YourCommand extends Command {
    constructor() {
        super({
            name: 'command-name',
            defer: false,
            allowUser: true,
            ephemeral: true,
        });
    }

    async execute(interaction, client, args) {
        // Command implementation
    }
}
```

### Translation System

The project uses a translation system for multi-language support:

1. Translation keys are defined in `utilities/keys.js`
2. Language files are stored in `resources/languages/`
3. Use the `replyTl` method to send translated messages
