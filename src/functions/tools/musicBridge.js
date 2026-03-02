const fs = require("fs");
const path = require("path");
const mm = require("music-metadata");
const { AudioPlayerStatus } = require("@discordjs/voice");
const logger = require("../../logger");
const pool = require("../../events/mysql/connect");
const music = require("../handlers/handleMusic");

const COMMAND_LIMIT = 20;
const LOOP_INTERVAL_MS = 2000;
const LIBRARY_SYNC_INTERVAL_MS = 60000;
const COMMAND_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const COMMAND_RETENTION_MINUTES = 10;
const metadataCache = new Map();
let bridgeIntervalId = null;

const ACTIONS = new Set([
  "toggle_pause",
  "next",
  "previous",
  "start_playback",
  "set_shuffle",
  "set_loop",
  "enqueue_priority",
  "enqueue_playlist",
  "enqueue_playlists",
  "remove_priority",
  "remove_queue",
  "clear_queue",
]);

function parseJsonSafe(raw, fallback = {}) {
  if (!raw || typeof raw !== "string") return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

function splitSongDisplay(songDisplay) {
  const safeDisplay = String(songDisplay || "").trim();
  if (!safeDisplay.length) {
    return { title: "Unknown", artist: "" };
  }

  const parts = safeDisplay.split(" - ");
  if (parts.length < 2) {
    return { title: safeDisplay, artist: "" };
  }

  const artist = parts.pop() || "";
  return {
    title: parts.join(" - "),
    artist,
  };
}

function toTrackEntry(songPath, songDisplay, isPriority = false) {
  const parsed = splitSongDisplay(songDisplay);
  return {
    path: songPath,
    title: parsed.title,
    artist: parsed.artist,
    isPriority,
  };
}

function listAllTracks() {
  const musicBaseDir = music.getMusicBaseDir();
  if (!fs.existsSync(musicBaseDir)) return [];

  const tracks = [];

  const rootFiles = fs
    .readdirSync(musicBaseDir)
    .filter((file) => file.toLowerCase().endsWith(".mp3"))
    .map((file) => path.join(musicBaseDir, file));
  tracks.push(...rootFiles);

  const items = fs.readdirSync(musicBaseDir);
  for (const item of items) {
    const full = path.join(musicBaseDir, item);
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) continue;

    const playlistFiles = fs
      .readdirSync(full)
      .filter((file) => file.toLowerCase().endsWith(".mp3"))
      .map((file) => path.join(full, file));

    tracks.push(...playlistFiles);
  }

  return tracks;
}

function normalizeTrackName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.mp3$/i, "")
    .replace(/[_\s-]+/g, " ")
    .trim();
}

function toTrackKey(songPath) {
  const musicBaseDir = music.getMusicBaseDir();
  const relative = path.relative(musicBaseDir, songPath);
  return (relative || songPath).split(path.sep).join("/").toLowerCase();
}

function formatDurationLabel(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function extractTrackMetadata(songPath) {
  try {
    const stat = fs.statSync(songPath);
    const cached = metadataCache.get(songPath);
    if (
      cached &&
      cached.mtimeMs === stat.mtimeMs &&
      cached.size === stat.size
    ) {
      return cached.meta;
    }

    const parsed = await mm.parseFile(songPath);
    const rawTitle = String(parsed.common?.title || "").trim();
    const rawArtist = String(parsed.common?.artist || "").trim();
    const durationSeconds = Number(parsed.format?.duration || 0);

    const meta = {
      title: rawTitle || path.basename(songPath, ".mp3").replace(/_/g, " "),
      artist: rawArtist || "Unknown artist",
      duration_seconds: Number.isFinite(durationSeconds)
        ? Math.floor(durationSeconds)
        : 0,
      duration_label: formatDurationLabel(durationSeconds),
    };

    metadataCache.set(songPath, {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      meta,
    });

    return meta;
  } catch (err) {
    logger.debug(`extractTrackMetadata fallback for ${songPath}: ${err}`);
    return {
      title: path.basename(songPath, ".mp3").replace(/_/g, " "),
      artist: "Unknown artist",
      duration_seconds: 0,
      duration_label: "--:--",
    };
  }
}

async function toLibraryRow(songPath) {
  const trackKey = toTrackKey(songPath);
  const relativeParts = trackKey.split("/");
  const fileName = relativeParts[relativeParts.length - 1] || "";
  const playlistName = relativeParts.length > 1 ? relativeParts[0] : null;
  const metadata = await extractTrackMetadata(songPath);

  return {
    track_key: trackKey,
    track_path: songPath,
    playlist_name: playlistName,
    title: metadata.title || path.basename(fileName, ".mp3").replace(/_/g, " "),
    artist: metadata.artist || "Unknown artist",
    duration_seconds: metadata.duration_seconds || 0,
    duration_label: metadata.duration_label || "--:--",
    source_type: playlistName ? "folder" : "root",
  };
}

async function resolveTrackPath(payload = {}) {
  const explicitPath = payload.track_path;
  if (
    explicitPath &&
    typeof explicitPath === "string" &&
    fs.existsSync(explicitPath)
  ) {
    return explicitPath;
  }

  const targetName = normalizeTrackName(payload.track_title || "");
  if (!targetName) return null;

  const allTracks = listAllTracks();
  for (const songPath of allTracks) {
    const fileBase = normalizeTrackName(path.basename(songPath, ".mp3"));
    if (fileBase === targetName) {
      return songPath;
    }
  }

  for (const songPath of allTracks) {
    const fileBase = normalizeTrackName(path.basename(songPath, ".mp3"));
    if (fileBase.includes(targetName) || targetName.includes(fileBase)) {
      return songPath;
    }
  }

  return null;
}

function buildPseudoInteraction(guild, channelId) {
  if (!channelId || !guild) return null;

  const voiceChannel = guild.channels.cache.get(channelId);
  if (!voiceChannel) return null;

  return {
    member: {
      voice: {
        channel: voiceChannel,
      },
    },
    guild,
    channel: {
      send: async () => null,
    },
  };
}

function shuffleTrackPaths(trackPaths) {
  const shuffled = trackPaths.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

async function applyGuildShuffleMode(guildId, trackPaths) {
  const safeTracks = Array.isArray(trackPaths) ? trackPaths.slice() : [];
  if (safeTracks.length <= 1) {
    return safeTracks;
  }

  const isShuffleEnabled = music.getRandomMode(guildId);
  if (!isShuffleEnabled) {
    return safeTracks;
  }

  const isSmartShuffleEnabled = music.getAutoMode(guildId);
  if (isSmartShuffleEnabled) {
    return await music.smartShuffleTracks(guildId, safeTracks);
  }

  return shuffleTrackPaths(safeTracks);
}

async function resolvePlaylistTrackPaths(guildId, payload = {}) {
  const playlistScope = String(payload.playlist_scope || "").toLowerCase();
  const numericPlaylistId = Number(payload.playlist_id);
  const playlistId =
    Number.isInteger(numericPlaylistId) && numericPlaylistId > 0
      ? numericPlaylistId
      : null;
  const playlistName = String(payload.playlist_name || "").trim();

  if (playlistScope === "user" || playlistId) {
    if (!playlistId) {
      return [];
    }

    const [rows] = await pool.query(
      "SELECT l.track_path FROM guild_music_playlist_tracks pt INNER JOIN guild_music_playlists p ON p.id = pt.playlist_id INNER JOIN music_library_tracks l ON l.track_key = pt.track_key WHERE p.guild_id = ? AND pt.playlist_id = ? ORDER BY pt.position ASC, pt.created_at ASC",
      [guildId, playlistId],
    );

    return (rows || [])
      .map((row) => row?.track_path)
      .filter((trackPath) => typeof trackPath === "string" && trackPath.length);
  }

  if (!playlistName.length) {
    return [];
  }

  const [rows] = await pool.query(
    "SELECT track_path FROM music_library_tracks WHERE playlist_name = ? ORDER BY title ASC",
    [playlistName],
  );

  return (rows || [])
    .map((row) => row?.track_path)
    .filter((trackPath) => typeof trackPath === "string" && trackPath.length);
}

async function applyCommand(client, commandRow) {
  const guildId = commandRow.guild_id;
  const action = String(commandRow.action || "");
  const payload = parseJsonSafe(commandRow.payload_json, {});

  if (!ACTIONS.has(action)) {
    throw new Error(`Unsupported action: ${action}`);
  }

  const guild = client.guilds.cache.get(guildId);

  if (!guild) {
    return "Guild unavailable";
  }

  if (action === "toggle_pause") {
    const player = music.players[guildId];
    if (!player) return "No active player";

    if (player.state?.status === AudioPlayerStatus.Paused) {
      const resumed = music.resume(guildId);
      return resumed ? "Resumed" : "Resume failed";
    }

    const paused = music.pause(guildId);
    return paused ? "Paused" : "Pause failed";
  }

  if (action === "next") {
    if (!music.isPlay(guildId)) return "No active playback";
    music.playersStop(guildId);
    return "Skipped to next";
  }

  if (action === "previous") {
    const previousQueue = music.getPreviousQueue(guildId);
    if (!previousQueue.length) return "No previous track";

    await music.playPrevious(guildId);
    return "Playing previous track";
  }

  if (action === "start_playback") {
    if (music.isPlay(guildId)) {
      return "Already playing";
    }

    const requesterId = commandRow.requested_by;
    if (!requesterId) {
      return "Missing requester";
    }

    const [voiceRows] = await pool.query(
      "SELECT channel_id FROM guild_user_voice_states WHERE guild_id = ? AND user_id = ? LIMIT 1",
      [guildId, requesterId],
    );

    const channelId = voiceRows?.[0]?.channel_id || null;
    if (!channelId) {
      return "Requester is not in a voice channel";
    }

    const interaction = buildPseudoInteraction(guild, channelId);
    if (!interaction) {
      return "Voice channel unavailable";
    }

    const queue = await music.getQueue(guildId);
    const priorityQueue = music.getPriorityQueue(guildId);
    if (
      (!queue || queue.length === 0) &&
      (!priorityQueue || priorityQueue.length === 0)
    ) {
      return "Queue is empty";
    }

    await music.playNext(guildId, interaction);
    return "Playback started";
  }

  if (action === "set_shuffle") {
    const mode = String(payload.mode || "").toLowerCase();
    if (mode === "smart") {
      music.setRandomMode(guildId, true);
      music.setAutoMode(guildId, true);
      music.setRandomType(guildId, "all");

      const queue = await music.getQueue(guildId);
      const nextQueue = await applyGuildShuffleMode(guildId, queue);
      await music.saveQueue(guildId, nextQueue);
      return "Smart shuffle enabled";
    }

    if (mode === "shuffle") {
      music.setRandomMode(guildId, true);
      music.setAutoMode(guildId, false);
      if (music.getRandomType(guildId) === "off") {
        music.setRandomType(guildId, "all");
      }

      const queue = await music.getQueue(guildId);
      const nextQueue = await applyGuildShuffleMode(guildId, queue);
      await music.saveQueue(guildId, nextQueue);
      return "Shuffle enabled";
    }

    if (mode === "off") {
      music.setRandomMode(guildId, false);
      music.setAutoMode(guildId, false);
      music.setRandomType(guildId, "off");
      return "Shuffle disabled";
    }

    const enabled = normalizeBoolean(payload.value, false);
    music.setRandomMode(guildId, enabled);
    music.setAutoMode(guildId, false);
    if (!enabled) {
      music.setRandomType(guildId, "off");
    }

    if (enabled) {
      if (music.getRandomType(guildId) === "off") {
        music.setRandomType(guildId, "all");
      }

      const queue = await music.getQueue(guildId);
      const nextQueue = await applyGuildShuffleMode(guildId, queue);
      await music.saveQueue(guildId, nextQueue);
    }

    return enabled ? "Shuffle enabled" : "Shuffle disabled";
  }

  if (action === "set_loop") {
    const enabled = normalizeBoolean(payload.value, false);
    music.setLoopQueueMode(guildId, enabled);
    return enabled ? "Loop enabled" : "Loop disabled";
  }

  if (action === "enqueue_priority") {
    const songPath = await resolveTrackPath(payload);
    if (!songPath) return "Track not found";

    music.addToPriorityQueue(guildId, songPath);

    if (!music.isPlay(guildId)) {
      const connection = music.connections[guildId];
      const channelId = connection?.joinConfig?.channelId;
      const interaction = buildPseudoInteraction(guild, channelId);
      if (interaction) {
        await music.playNext(guildId, interaction);
      }
    }

    return "Track added to priority queue";
  }

  if (action === "enqueue_playlist") {
    const playlistTrackPaths = await resolvePlaylistTrackPaths(
      guildId,
      payload,
    );
    if (!playlistTrackPaths.length) {
      return "Playlist is empty";
    }

    const tracksToQueue = await applyGuildShuffleMode(
      guildId,
      playlistTrackPaths,
    );

    const queue = await music.getQueue(guildId);
    const nextQueue = Array.isArray(queue) ? queue.slice() : [];
    nextQueue.push(...tracksToQueue);
    await music.saveQueue(guildId, nextQueue);

    return music.getRandomMode(guildId)
      ? `Queued ${tracksToQueue.length} tracks (${music.getAutoMode(guildId) ? "smart shuffled" : "shuffled"})`
      : `Queued ${tracksToQueue.length} tracks`;
  }

  if (action === "enqueue_playlists") {
    const sourcePlaylists = Array.isArray(payload.playlists)
      ? payload.playlists
      : [];
    if (!sourcePlaylists.length) {
      return "No playlists selected";
    }

    const combinedTrackPaths = [];
    for (const playlistPayload of sourcePlaylists) {
      const playlistTrackPaths = await resolvePlaylistTrackPaths(
        guildId,
        playlistPayload,
      );
      if (playlistTrackPaths.length) {
        combinedTrackPaths.push(...playlistTrackPaths);
      }
    }

    if (!combinedTrackPaths.length) {
      return "Selected playlists are empty";
    }

    const tracksToQueue = await applyGuildShuffleMode(
      guildId,
      combinedTrackPaths,
    );

    const queue = await music.getQueue(guildId);
    const nextQueue = Array.isArray(queue) ? queue.slice() : [];
    nextQueue.push(...tracksToQueue);
    await music.saveQueue(guildId, nextQueue);

    return music.getRandomMode(guildId)
      ? `Queued ${tracksToQueue.length} tracks from selected playlists (${music.getAutoMode(guildId) ? "smart shuffled" : "shuffled"})`
      : `Queued ${tracksToQueue.length} tracks from selected playlists`;
  }

  if (action === "remove_priority") {
    const pQueue = music.getPriorityQueue(guildId);
    if (!pQueue.length) return "Priority queue is empty";

    const songPath = await resolveTrackPath(payload);
    if (!songPath) return "Track not found";

    const index = pQueue.findIndex((item) => item === songPath);
    if (index < 0) return "Track not found in priority queue";

    pQueue.splice(index, 1);
    return "Track removed from priority queue";
  }

  if (action === "remove_queue") {
    const queue = await music.getQueue(guildId);
    if (!queue.length) return "Queue is empty";

    const songPath = await resolveTrackPath(payload);
    if (!songPath) return "Track not found";

    const index = queue.findIndex((item) => item === songPath);
    if (index < 0) return "Track not found in queue";

    queue.splice(index, 1);
    await music.saveQueue(guildId, queue);
    return "Track removed from queue";
  }

  if (action === "clear_queue") {
    await music.clearQueue(guildId);
    music.clearPriorityQueue(guildId);
    return "Queue cleared";
  }

  return "Ignored";
}

async function ensureTables() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS music_command_queue (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32) NOT NULL, action VARCHAR(64) NOT NULL, payload_json LONGTEXT NULL, requested_by VARCHAR(32) NULL, status ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending', result_message VARCHAR(512) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, processed_at TIMESTAMP NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, KEY idx_music_cmd_status_created (status, created_at), KEY idx_music_cmd_guild_status (guild_id, status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  );

  await pool.query(
    "CREATE TABLE IF NOT EXISTS guild_music_state (guild_id VARCHAR(32) NOT NULL PRIMARY KEY, playback_state VARCHAR(16) NOT NULL DEFAULT 'idle', channel_label VARCHAR(255) NULL, now_playing_title VARCHAR(255) NULL, now_playing_artist VARCHAR(255) NULL, shuffle_mode VARCHAR(16) NOT NULL DEFAULT 'off', is_shuffle_enabled TINYINT(1) NOT NULL DEFAULT 0, is_loop_enabled TINYINT(1) NOT NULL DEFAULT 0, queue_json LONGTEXT NULL, priority_queue_json LONGTEXT NULL, previous_queue_json LONGTEXT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  );

  try {
    await pool.query(
      "ALTER TABLE guild_music_state ADD COLUMN shuffle_mode VARCHAR(16) NOT NULL DEFAULT 'off'",
    );
  } catch (err) {
    if (!String(err?.message || "").includes("Duplicate column")) {
      throw err;
    }
  }

  await pool.query(
    "CREATE TABLE IF NOT EXISTS music_library_tracks (track_key VARCHAR(512) NOT NULL PRIMARY KEY, track_path TEXT NOT NULL, playlist_name VARCHAR(255) NULL, title VARCHAR(255) NOT NULL, artist VARCHAR(255) NULL, duration_seconds INT NOT NULL DEFAULT 0, duration_label VARCHAR(16) NOT NULL DEFAULT '--:--', source_type ENUM('root','folder') NOT NULL DEFAULT 'folder', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, KEY idx_music_library_playlist (playlist_name), KEY idx_music_library_title (title)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  );

  try {
    await pool.query(
      "ALTER TABLE music_library_tracks ADD COLUMN duration_seconds INT NOT NULL DEFAULT 0",
    );
  } catch (err) {
    if (!String(err?.message || "").includes("Duplicate column")) {
      throw err;
    }
  }

  try {
    await pool.query(
      "ALTER TABLE music_library_tracks ADD COLUMN duration_label VARCHAR(16) NOT NULL DEFAULT '--:--'",
    );
  } catch (err) {
    if (!String(err?.message || "").includes("Duplicate column")) {
      throw err;
    }
  }

  await pool.query(
    "CREATE TABLE IF NOT EXISTS guild_music_playlists (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32) NOT NULL, name VARCHAR(255) NOT NULL, created_by VARCHAR(32) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_guild_playlist_name (guild_id, name), KEY idx_guild_music_playlists_guild (guild_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  );

  await pool.query(
    "CREATE TABLE IF NOT EXISTS guild_music_playlist_tracks (playlist_id BIGINT UNSIGNED NOT NULL, track_key VARCHAR(512) NOT NULL, position INT NOT NULL DEFAULT 0, added_by VARCHAR(32) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (playlist_id, track_key), KEY idx_guild_music_playlist_tracks_position (playlist_id, position), KEY idx_guild_music_playlist_tracks_track (track_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  );

  await pool.query(
    "CREATE TABLE IF NOT EXISTS guild_user_voice_states (guild_id VARCHAR(32) NOT NULL, user_id VARCHAR(32) NOT NULL, channel_id VARCHAR(32) NOT NULL, channel_name VARCHAR(255) NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (guild_id, user_id), KEY idx_guild_voice_channel (guild_id, channel_id), KEY idx_guild_voice_updated (updated_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  );
}

async function resetPlaybackStateAfterRestart() {
  await pool.query(
    "UPDATE guild_music_state SET playback_state = 'idle', channel_label = 'No channel', now_playing_title = 'Nothing playing', now_playing_artist = '' WHERE playback_state IN ('playing', 'paused')",
  );

  await pool.query(
    "UPDATE music_command_queue SET status = 'pending' WHERE status = 'processing'",
  );
}

async function resetPlaybackStateForShutdown() {
  await pool.query(
    "UPDATE guild_music_state SET playback_state = 'idle', channel_label = 'No channel', now_playing_title = 'Nothing playing', now_playing_artist = ''",
  );

  await pool.query(
    "UPDATE music_command_queue SET status = 'pending' WHERE status = 'processing'",
  );
}

async function syncVoiceStatesSnapshot(client) {
  for (const guild of client.guilds.cache.values()) {
    await pool.query("DELETE FROM guild_user_voice_states WHERE guild_id = ?", [
      guild.id,
    ]);

    try {
      await guild.channels.fetch();
    } catch (error) {
      logger.debug(
        `syncVoiceStatesSnapshot channels fetch failed for ${guild.id}: ${error}`,
      );
    }

    const trackedUsers = new Set();

    const channels = guild.channels?.cache
      ? Array.from(guild.channels.cache.values())
      : [];

    for (const channel of channels) {
      if (!channel?.isVoiceBased?.()) continue;

      const members = channel.members
        ? Array.from(channel.members.values())
        : [];

      for (const member of members) {
        const memberId = member?.id;
        if (!memberId || trackedUsers.has(memberId)) continue;

        trackedUsers.add(memberId);
        await pool.query(
          "INSERT INTO guild_user_voice_states (guild_id, user_id, channel_id, channel_name) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id), channel_name = VALUES(channel_name)",
          [guild.id, memberId, channel.id, channel.name || null],
        );
      }
    }

    const voiceStates = guild.voiceStates?.cache
      ? Array.from(guild.voiceStates.cache.values())
      : [];

    for (const voiceState of voiceStates) {
      if (!voiceState?.channelId || !voiceState?.id) continue;
      if (trackedUsers.has(voiceState.id)) continue;

      trackedUsers.add(voiceState.id);
      const channelName = voiceState.channel?.name || null;
      await pool.query(
        "INSERT INTO guild_user_voice_states (guild_id, user_id, channel_id, channel_name) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id), channel_name = VALUES(channel_name)",
        [guild.id, voiceState.id, voiceState.channelId, channelName],
      );
    }
  }
}

async function syncLibraryTracksToDatabase() {
  const songPaths = listAllTracks();
  const libraryRows = [];
  for (const songPath of songPaths) {
    const row = await toLibraryRow(songPath);
    libraryRows.push(row);
  }

  const activeTrackKeys = new Set();
  for (const track of libraryRows) {
    activeTrackKeys.add(track.track_key);
    await pool.query(
      "INSERT INTO music_library_tracks (track_key, track_path, playlist_name, title, artist, duration_seconds, duration_label, source_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE track_path = VALUES(track_path), playlist_name = VALUES(playlist_name), title = VALUES(title), artist = VALUES(artist), duration_seconds = VALUES(duration_seconds), duration_label = VALUES(duration_label), source_type = VALUES(source_type)",
      [
        track.track_key,
        track.track_path,
        track.playlist_name,
        track.title,
        track.artist,
        track.duration_seconds,
        track.duration_label,
        track.source_type,
      ],
    );
  }

  const [existingRows] = await pool.query(
    "SELECT track_key FROM music_library_tracks",
  );

  for (const row of existingRows) {
    if (!activeTrackKeys.has(row.track_key)) {
      await pool.query("DELETE FROM music_library_tracks WHERE track_key = ?", [
        row.track_key,
      ]);
    }
  }
}

async function updateGuildMusicState(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const queuePaths = await music.getQueue(guildId);
  const priorityPaths = music.getPriorityQueue(guildId);
  const previousPaths = music.getPreviousQueue(guildId).slice(-50).reverse();

  const queue = [];
  for (const songPath of queuePaths.slice(0, 100)) {
    const display = await music.getSongName(songPath);
    queue.push(toTrackEntry(songPath, display, false));
  }

  const priorityQueue = [];
  for (const songPath of priorityPaths.slice(0, 100)) {
    const display = await music.getSongName(songPath);
    priorityQueue.push(toTrackEntry(songPath, display, true));
  }

  const previousQueue = [];
  for (const songPath of previousPaths.slice(0, 100)) {
    const display = await music.getSongName(songPath);
    previousQueue.push(toTrackEntry(songPath, display, false));
  }

  const currentTrackPath = music.getCurrentTrackPath(guildId);
  const currentDisplay = currentTrackPath
    ? await music.getSongName(currentTrackPath)
    : "Nothing playing";
  const current = splitSongDisplay(currentDisplay);

  const player = music.players[guildId];
  let playbackState = "idle";
  if (player?.state?.status === AudioPlayerStatus.Paused) {
    playbackState = "paused";
  } else if (music.isPlay(guildId)) {
    playbackState = "playing";
  }

  const connection = music.connections[guildId];
  const channelId = connection?.joinConfig?.channelId;
  const channelLabel = channelId
    ? `#${guild.channels.cache.get(channelId)?.name || "voice"}`
    : "No channel";

  const shuffleMode = music.getRandomMode(guildId)
    ? music.getAutoMode(guildId)
      ? "smart"
      : "shuffle"
    : "off";

  await pool.query(
    "INSERT INTO guild_music_state (guild_id, playback_state, channel_label, now_playing_title, now_playing_artist, shuffle_mode, is_shuffle_enabled, is_loop_enabled, queue_json, priority_queue_json, previous_queue_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE playback_state = VALUES(playback_state), channel_label = VALUES(channel_label), now_playing_title = VALUES(now_playing_title), now_playing_artist = VALUES(now_playing_artist), shuffle_mode = VALUES(shuffle_mode), is_shuffle_enabled = VALUES(is_shuffle_enabled), is_loop_enabled = VALUES(is_loop_enabled), queue_json = VALUES(queue_json), priority_queue_json = VALUES(priority_queue_json), previous_queue_json = VALUES(previous_queue_json)",
    [
      guildId,
      playbackState,
      channelLabel,
      current.title,
      current.artist,
      shuffleMode,
      shuffleMode === "off" ? 0 : 1,
      music.getLoopQueueMode(guildId) ? 1 : 0,
      JSON.stringify(queue),
      JSON.stringify(priorityQueue),
      JSON.stringify(previousQueue),
    ],
  );
}

async function processPendingCommands(client) {
  const [rows] = await pool.query(
    "SELECT id, guild_id, action, payload_json, requested_by FROM music_command_queue WHERE status = 'pending' ORDER BY id ASC LIMIT ?",
    [COMMAND_LIMIT],
  );

  for (const row of rows) {
    const [claim] = await pool.query(
      "UPDATE music_command_queue SET status = 'processing' WHERE id = ? AND status = 'pending'",
      [row.id],
    );

    if (!claim?.affectedRows) {
      continue;
    }

    try {
      const resultMessage = await applyCommand(client, row);
      await pool.query(
        "UPDATE music_command_queue SET status = 'done', result_message = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [resultMessage || "OK", row.id],
      );
    } catch (err) {
      logger.error(`music command ${row.id} failed: ${err}`);
      await pool.query(
        "UPDATE music_command_queue SET status = 'failed', result_message = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [String(err?.message || err || "Unknown error").slice(0, 500), row.id],
      );
    }
  }
}

async function cleanupProcessedCommands() {
  await pool.query(
    `DELETE FROM music_command_queue
     WHERE status IN ('done', 'failed')
       AND processed_at IS NOT NULL
       AND processed_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [COMMAND_RETENTION_MINUTES],
  );

  await pool.query(
    `DELETE FROM music_command_queue
     WHERE status IN ('done', 'failed')
       AND processed_at IS NULL
       AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [COMMAND_RETENTION_MINUTES],
  );
}

async function refreshAllGuildStates(client) {
  const guildIds = Array.from(client.guilds.cache.keys());
  for (const guildId of guildIds) {
    try {
      await updateGuildMusicState(client, guildId);
    } catch (err) {
      logger.error(`updateGuildMusicState error for ${guildId}: ${err}`);
    }
  }
}

async function rebuildBridgeState(client) {
  await syncVoiceStatesSnapshot(client);
  await refreshAllGuildStates(client);
}

async function runPhase(name, handler) {
  try {
    await handler();
    return true;
  } catch (error) {
    logger.error(`Music bridge phase failed (${name}): ${error}`);
    return false;
  }
}

function startMusicBridge(client) {
  let isRunning = false;
  let tablesReady = false;
  let lastLibrarySyncAt = 0;
  let lastCommandCleanupAt = 0;
  let didStartupRecovery = false;
  let waitingForDbLogged = false;

  const tick = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      if (!pool?.isAvailable || !pool.isAvailable()) {
        if (!waitingForDbLogged) {
          waitingForDbLogged = true;
          logger.warn("Music bridge waiting for MySQL availability...");
        }
        return;
      }

      if (waitingForDbLogged) {
        waitingForDbLogged = false;
        logger.info("Music bridge resumed after MySQL reconnect.");
      }

      if (!tablesReady) {
        const ok = await runPhase("ensureTables", async () => {
          await ensureTables();
        });
        if (!ok) return;
        tablesReady = true;
      }

      if (!didStartupRecovery) {
        await runPhase("startupReset", async () => {
          await resetPlaybackStateAfterRestart();
        });
        await runPhase("startupRebuild", async () => {
          await rebuildBridgeState(client);
        });
        didStartupRecovery = true;
      }

      const now = Date.now();

      if (now - lastLibrarySyncAt >= LIBRARY_SYNC_INTERVAL_MS) {
        const ok = await runPhase("librarySync", async () => {
          await syncLibraryTracksToDatabase();
        });
        if (ok) {
          lastLibrarySyncAt = now;
        }
      }

      await runPhase("processCommands", async () => {
        await processPendingCommands(client);
      });

      if (now - lastCommandCleanupAt >= COMMAND_CLEANUP_INTERVAL_MS) {
        const ok = await runPhase("cleanupCommands", async () => {
          await cleanupProcessedCommands();
        });
        if (ok) {
          lastCommandCleanupAt = now;
        }
      }

      await runPhase("refreshGuildStates", async () => {
        await refreshAllGuildStates(client);
      });
    } catch (err) {
      logger.error(`Music bridge tick failed: ${err}`);
    } finally {
      isRunning = false;
    }
  };

  tick();
  bridgeIntervalId = setInterval(tick, LOOP_INTERVAL_MS);
  logger.info("Music bridge started (DB commands + state sync).");
}

async function shutdownMusicBridge() {
  if (!pool?.isAvailable || !pool.isAvailable()) {
    return;
  }

  if (bridgeIntervalId) {
    clearInterval(bridgeIntervalId);
    bridgeIntervalId = null;
  }

  await runPhase("shutdownReset", async () => {
    await ensureTables();
    await resetPlaybackStateForShutdown();
  });
}

module.exports = {
  startMusicBridge,
  shutdownMusicBridge,
};
