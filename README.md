# 🎵 Eppy-Bot

Discord bot with music playback, moderation tools, queue automation, and resilient database fallback.

<p align="left">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white" alt="discord.js" />
  <img src="https://img.shields.io/badge/MongoDB-optional-47A248?logo=mongodb&logoColor=white" alt="MongoDB optional" />
  <img src="https://img.shields.io/badge/MySQL-optional-4479A1?logo=mysql&logoColor=white" alt="MySQL optional" />
  <img src="https://img.shields.io/badge/PM2-supported-2B037A" alt="PM2" />
</p>

---

## 📚 Table of Contents

- [✅ MUST DO before first run](#-must-do-before-first-run)
- [🔐 .env configuration](#-env-configuration)
- [🧱 Project structure](#-project-structure)
- [💾 Database behavior (important)](#-database-behavior-important)
- [🎧 Queue behavior](#-queue-behavior)
- [🧩 Slash commands](#-slash-commands)
- [🚀 Run & deploy](#-run--deploy)
- [🛠 Troubleshooting](#-troubleshooting)
- [💙 Support](#-support)

---

## ✅ MUST DO before first run

1. Install **Node.js LTS** (with npm).
2. Install dependencies in repository root:
   - `npm install`
3. Create `.env` in project root and set at least:
   - `token`
   - `client_ID`
   - `allowlist` (optional but recommended)
4. (Optional) Configure MongoDB:
   - set `databaseToken` to your Mongo connection string.
   - if skipped, bot uses in-memory fallback for queue/pet/roulette/music stats.
5. (Optional) Configure MySQL:
   - set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
   - if skipped, MySQL-backed features run in safe no-db mode.
6. Prepare music files:
   - set `MUSIC_DIR` to folder with `.mp3` files (and optional subfolders as playlists),
   - or use default path: `src/commands/music/music`.
7. Start bot:
   - `node src/bot.js` or `node .`
8. (Recommended for production) PM2:
   - `npm install -g pm2`
   - `pm2 start ecosystem.config.js`

---

## 🔐 .env configuration

| Key             | Required | Description                                         |
| --------------- | -------- | --------------------------------------------------- |
| `token`         | ✅       | Discord bot token                                   |
| `client_ID`     | ✅       | Discord application client ID                       |
| `allowlist`     | ⚪       | Comma-separated user IDs with elevated access       |
| `databaseToken` | ⚪       | MongoDB connection string                           |
| `DB_HOST`       | ⚪       | MySQL host                                          |
| `DB_USER`       | ⚪       | MySQL user                                          |
| `DB_PASSWORD`   | ⚪       | MySQL password                                      |
| `DB_NAME`       | ⚪       | MySQL database name                                 |
| `MUSIC_DIR`     | ⚪       | Path to music folder (absolute or project-relative) |

> ⚪ Optional means bot still starts without it.

---

## 🧱 Project structure

- `src/bot.js` — main entry point
- `src/config.js` — environment config mapping
- `src/logger.js` — logger setup
- `src/commands/` — slash commands (music, moderation, tools, misc)
- `src/events/` — Discord and DB event handlers
- `src/functions/handlers/` — internal business logic
- `src/schemas/` — Mongoose schemas (`queue`, `pet`, `roulette`, `musicPlayStat`)
- `src/database/` — runtime storage and DB availability state
  - `state.js`
  - `runtimeStore.js`

---

## 💾 Database behavior (important)

### MongoDB

- When available: persists queue/game/music-stat data.
- When unavailable: bot auto-switches to **in-memory** mode for those features.

### MySQL

- Used for guild/user/channel sync and notification channel mappings.
- When unavailable: bot stays online and MySQL operations become safe no-op / empty results.

### SQL schema

- See: `needed things for your bot configuration/schema.sql`

---

## 🎧 Queue behavior

- Priority queue is **FIFO**.
- Priority tracks play before main queue continuation.
- Priority queue is runtime memory only (cleared on restart).

---

## 🧩 Slash commands

<details>
<summary><b>🎵 Music commands</b></summary>

- `/play [track] [playlist]` — play track or set active playlist context.
- `/play_outdated find:<text_or_url>` — legacy playback command.
- `/queue action:<auto|queue|statistic|clear|next|previous|shuffle|pause|resume|stop> [value] [random]`
  - `queue` — paginated queue view
  - `statistic` — top played tracks (guild)
  - `auto` — auto queue mode
  - `clear` — clear queue + cleanup
  - `next` / `previous` — navigation
  - `shuffle` / `pause` / `resume` / `stop` — playback control
- `/playlist action:<add/remove|show|clear> [playlist]` — manage auto source playlists.
- `/smartshuffle action:<clear>` — reset smart shuffle data/state.
- `/push` — force-play local `push.mp3` in loop.

</details>

<details>
<summary><b>🛡 Moderation commands</b></summary>

- `/ban target:<user> [time] [reason]`
- `/kick target:<user> [reason]`
- `/clear [amount]`
- `/settings [queue_channel] [notification_channel] [welcome_channel] [update_notification_channel] [notification_role] [clear_queue_channel] [clear_notification_channel] [clear_welcome_channel]`
- `/global_update message:<text> [title] [ping_role] [dry_run]`
- `/global_notiffication message:<text> [title] [ping] [dry_run]`
- `/restart [notify] [ping] [delay]`

</details>

<details>
<summary><b>🧰 Tools commands</b></summary>

- `/help`
- `/ping`
- `/refresh`
- `/join`
- `/database`

</details>

<details>
<summary><b>🎮 Misc commands</b></summary>

- `/pet action:<pet|ranking>`
- `/roulette action:<shoot|roll|quit|lives|rank>`

</details>

---

## 🚀 Run & deploy

### Local run

- `node src/bot.js` or `node .`

### PM2 (recommended)

- `npm install -g pm2`
- `pm2 start ecosystem.config.js`

> Process name should stay `Eppy` because `/restart` uses `pm2 restart Eppy`.

---

## 🛠 Troubleshooting

- Check `logs/` for runtime logs.
- If voice playback fails, verify `@discordjs/voice` dependencies/environment.
- If commands are missing, re-run command registration (`/refresh` or deployment flow).

---

## 💙 Support

- You can support the project here: https://ko-fi.com/DragonOrParagon1601
