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

### Time-based persistence (restart-safe)

- `/ban ... time:<duration>` (temporary ban) is persisted in MySQL table `temp_bans`.
- On bot startup, scheduled auto-unbans are restored from database.
- If MySQL is unavailable, temporary bans cannot be guaranteed to survive restart.
- `/pet` cooldown and roulette/game counters are persisted only when MongoDB is configured; in fallback in-memory mode they are not restart-safe.
- Dev command delays (`/gitpull delay`, `/restart delay`) currently use runtime timers (`setTimeout`) and are not restored after process restart.

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

- `/ban target:<user> [time] [delete_days] [reason]` — sends moderation log to `ban_notification_channel`; if not configured, uses the command channel.
- `/kick target:<user> [reason]` — sends moderation log to `kick_notification_channel`; if not configured, uses the command channel.
- `/clear [amount]`
- `/settings [queue_channel] [notification_channel] [welcome_channel] [update_notification_channel] [ban_notification_channel] [kick_notification_channel] [notification_role] [clear_queue_channel] [clear_notification_channel] [clear_welcome_channel] [clear_ban_notification_channel] [clear_kick_notification_channel]`

</details>

<details>
<summary><b>🧪 Dev commands (allowUsers only)</b></summary>

- `/global_update [message] [message_file] [title] [ping_role] [dry_run]`
- `/global_notiffication [message] [message_file] [title] [ping] [dry_run]`
- `/gitpull [notify] [ping] [delay]`
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

## 📝 Note from the author

Jestem początkującym twórcą i cały czas uczę się na tym projekcie, żeby bot był jak najlepszy.
Czasem wychodzi lepiej, czasem gorzej — najważniejsze, że projekt stale idzie do przodu.

Kod bywa miejscami trochę „spaghetti”, ale da się w nim odnaleźć i sukcesywnie go poprawiam.
Jestem otwarty na konstruktywną krytykę, sugestie i każde konkretne uwagi.

Z góry dziękuję wszystkim, którzy korzystają z bota.
Jeśli zostawisz watermark/informację, że bot został stworzony przeze mnie, będzie mi bardzo miło 💙

### English version

I am a beginner developer and I’m constantly learning while working on this project, trying to make the bot as good as possible.
Sometimes things turn out better, sometimes worse — the important part is that the project keeps moving forward.

Some parts of the code are a bit “spaghetti”, but it is still possible to navigate, and I keep improving it over time.
I’m open to constructive criticism, suggestions, and any specific feedback.

Thank you in advance to everyone who uses the bot.
If you leave a watermark/credit that the bot was created by me, I would really appreciate it 💙

---

## 💙 Support

- You can support the project here: https://ko-fi.com/DragonOrParagon1601
