Eppy-Bot Configuration Manual

This file explains required configuration values and what each part of the repository is for.

.env / configuration keys (store in .env in project root):

- token: Discord bot token. Required for bot login.
- client_ID: Discord application client ID (used for RPC and command registration).
- client_Secret: Discord application secret (if needed for OAuth flows).
- databaseToken: (optional) token used for external services or DB auth.
- spotify_client_ID: (optional) Spotify client ID if you integrate Spotify features.
- spotify_secret: (optional) Spotify client secret.
- allowlist: comma-separated list of user IDs allowed for admin actions (optional).
- SESSION_SECRET: secret string used for session management (if applicable).
- DB_HOST: MySQL host for certain features (if used).
- DB_USER: MySQL username.
- DB_PASSWORD: MySQL password.
- DB_NAME: MySQL database name.

Files and folders overview:

- src/
  - bot.js - Main bot entry point.
  - config.js - Loads environment variables and exports config values.
  - logger.js - Logging wrapper used across the project.
  - commands/ - All slash command handlers grouped by areas (music, moderation, tools, etc.).
    - music/ - Play, queue and music-related commands.
    - moderation/ - Admin/moderation commands (ban, kick, settings, restart).
    - tools/ - Utility commands (ping, refresh, help).
  - events/ - Event handlers for the Discord client (ready, interactionCreate, guild events).
  - functions/ - Internal helper logic and handlers.
    - handlers/handleMusic.js - Music queue and playback logic (main queue is persisted to MongoDB; priority queue is in-memory).
    - handlers/handleUsers.js - User persistence helpers.
    - tools/ - Misc helpers (presence, RPC helpers).
  - schemas/ - Mongoose schemas for queues, users, roulette, etc.

Database and persistence:

- MongoDB: used to persist the main music queue (src/schemas/queue.js) and some other state. Ensure a running MongoDB instance and configure MONGO_URI or connection in your environment if required by the project (check events/mongo/\* files for connection details).
- MySQL: used for queue channel lookup in some parts; configure DB\_ env variables in .env.

How priority queue works:

- Priority queue holds tracks added while music is playing.
- Priority queue is FIFO: items play in the order they were added.
- When the current track (from main queue) finishes, any items in the priority queue play first; after the priority queue empties, playback continues from the main queue.
- Priority queue is in-memory and will be lost if the bot restarts.

Common tasks:

- Register slash commands: run your command registration script or use your deployment flow to sync commands with Discord.
- Start the bot: `node src/bot.js` (ensure .env is present and dependencies installed).

PM2 setup (required for /restart):

- Install PM2 globally: `npm install -g pm2`.
- Start the bot with the provided PM2 config: `pm2 start ecosystem.config.js`.
- The process name must be `Eppy` because `/restart` runs `pm2 restart Eppy`.
- Auto-restart on code changes is enabled by `watch: ["src"]` in ecosystem.config.js.

Support and troubleshooting:

- Check logs/ for runtime logs; enable debug mode in logger if you need more details.
- If audio playback fails, verify @discordjs/voice is installed and your environment supports audio playback.

If you want, I can also create a ready-to-use `.env.example` file and a short checklist for deploying the bot to a server. Let me know which you'd prefer.
