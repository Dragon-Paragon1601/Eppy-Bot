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

Detailed list of all available slash commands:

Music commands:

- /play [track] [playlist]
  - Purpose: play a single track or set active playlist for track lookup.
  - Options:
    - track (string, optional, autocomplete) — track name without .mp3.
    - playlist (string, optional, autocomplete) — playlist folder name, or none to clear active playlist.
  - Behavior:
    - If playlist is provided without track, command sets/clears active playlist for /play search.
    - If track is provided and music is already playing, track is added to priority queue.
    - If track is provided and nothing is playing, queue is replaced with this track and playback starts.

- /play_outdated find:<text_or_url>
  - Purpose: legacy/alternative play command kept in project.
  - Options:
    - find (string, required) — song name or supported URL.
  - Note: this command is separate from /play and may use older lookup/playback flow.

- /queue action:<auto|queue|clear|next|previous|shuffle|pause|resume|stop> [value] [random]
  - Purpose: manage queue and playback state.
  - Options:
    - action (string, required) — selected queue action.
    - value (boolean, optional) — used by action:auto (true/false).
    - random (boolean, optional) — used by action:auto; shuffles selected source before start.
  - Actions:
    - queue — show paginated queue (priority + main queue).
    - auto — enable/disable automatic queue mode.
      - If no playlists were selected via /playlist, auto uses all tracks.
      - If playlists are selected via /playlist, auto uses only selected playlists.
    - clear — clear queue and stop/cleanup playback state.
    - next — skip current track and move to next available track.
    - previous — enqueue previous track from history.
    - shuffle — shuffle current main queue.
    - pause — pause current playback.
    - resume — resume paused playback (or start queue if possible).
    - stop — stop playback and disconnect from voice channel.

- /playlist action:<add/remove|show|clear> [playlist]
  - Purpose: manage playlist selection source for /queue auto.
  - Options:
    - action (string, required) — playlist management action.
    - playlist (string, optional, autocomplete) — playlist name or every.
  - Actions:
    - show — display currently selected playlists for auto queue.
    - clear — clear selected playlists (auto queue falls back to all tracks).
    - add/remove — toggle one playlist:
      - first select adds playlist,
      - selecting the same playlist again removes it.
      - playlist:every adds all playlists at once.

- /push
  - Purpose: force-play local push.mp3 on loop.
  - Behavior: clears queue to single push track, enables loop for that track, starts playback. Stop with /queue action:stop.

Moderation commands:

- /ban target:<user> [time] [reason]
  - Purpose: ban member.
  - Required permission: Ban Members.
  - Options:
    - target (user, required)
    - time (integer, optional) — intended as delete-message days (1-7)
    - reason (string, optional)

- /kick target:<user> [reason]
  - Purpose: kick member.
  - Required permission: Kick Members.
  - Options:
    - target (user, required)
    - reason (string, optional)

- /clear [amount]
  - Purpose: delete messages from current channel.
  - Required permission: Manage Messages.
  - Options:
    - amount (integer, optional, 1-100) — how many messages to delete.
  - Behavior:
    - If amount is provided, deletes up to that amount.
    - If amount is omitted, deletes messages in batches until channel history is cleaned as far as API allows.

- /settings [queue_channel] [notification_channel] [welcome_channel] [clear_queue_channel] [clear_notification_channel] [clear_welcome_channel]
  - Purpose: configure guild channel mappings used by bot notifications/features.
  - Access: Administrator or user ID present in allowUsers config.
  - Behavior:
    - With no options: shows current mappings.
    - With channel options: sets mappings.
    - With clear booleans: removes selected mappings.

- /restart
  - Purpose: restart bot process through PM2.
  - Access: user ID must be in allowUsers.
  - Behavior: executes pm2 restart Eppy.

Tools commands:

- /help
  - Purpose: open interactive help embed with command categories.

- /ping
  - Purpose: show API latency and client ping.

- /refresh
  - Purpose: refresh slash command registration on the running bot.

- /join
  - Purpose: join your current voice channel.
  - Behavior: requires caller to be in a voice channel.

- /database
  - Purpose: quick database debug/info command for current guild profile document.

Misc commands:

- /pet action:<pet|ranking>
  - pet: pets the bot, updates presence, increments user pet counter (with cooldown for non-allowlisted users).
  - ranking: displays top petters on current guild.

- /roulette action:<shoot|roll|quit|lives|rank>
  - lives: show your current lives and coins.
  - rank: show roulette leaderboard.
  - shoot: play one roulette round.
  - roll: roll cylinder without shooting.
  - quit: quit current run and claim coins from current rounds.

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
