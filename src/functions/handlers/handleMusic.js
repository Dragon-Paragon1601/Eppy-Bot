const path = require("path");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const { clearAudioFolders } = require("./handleClearAudio");
const logger = require("./../../logger");
const mm = require("music-metadata");
const fs = require("fs");
const config = require("../../config");
const mysql = require("mysql2/promise");
const pool = require("../../events/mysql/connect");
const Queue = require("../../schemas/queue");
const QueueChannel = require("../../schemas/queueChannel");
const firstSongStartedMap = new Map();
let connections = {};
let idleTimers = {};
let isPlaying = {};
let players = {};
let queues = {};
const loopSongMap = new Map();
const _startingSet = new Set();
const autoModeMap = new Map();
const randomModeMap = new Map();
const loopQueueMap = new Map();
const loopSourceMap = new Map();
const playlistMap = new Map(); // guildId -> playlist name
const randomTypeMap = new Map(); // guildId -> 'off'|'from_playlist'|'playlist'|'all'

// Sprawdź czy pierwsza piosenka została rozpoczęta
function checkFirstSongStarted(guildId) {
  if (!firstSongStartedMap.has(guildId)) {
    firstSongStartedMap.set(guildId, false);
  }
  return firstSongStartedMap.get(guildId);
}

// Pobierz kolejkę dla danej gildii
async function getQueue(guildId) {
  let queue = await Queue.findOne({ guildId });
  if (!queue) {
    queue = new Queue({ guildId, songs: [] });
    await queue
      .save()
      .catch((err) => logger.error(`Błąd zapisu kolejki: ${err}`));
  }
  return queue.songs;
}

function setLoopSong(guildId, songPath) {
  loopSongMap.set(guildId, songPath);
}

function clearLoopSong(guildId) {
  if (loopSongMap.has(guildId)) loopSongMap.delete(guildId);
}

function getLoopSong(guildId) {
  return loopSongMap.get(guildId);
}

function setAutoMode(guildId, value) {
  autoModeMap.set(guildId, !!value);
}

function getAutoMode(guildId) {
  return !!autoModeMap.get(guildId);
}

function setRandomMode(guildId, value) {
  randomModeMap.set(guildId, !!value);
}

function getRandomMode(guildId) {
  return !!randomModeMap.get(guildId);
}

function setLoopQueueMode(guildId, value) {
  loopQueueMap.set(guildId, !!value);
}

function getLoopQueueMode(guildId) {
  return !!loopQueueMap.get(guildId);
}

function setLoopSource(guildId, arrayOfPaths) {
  if (!Array.isArray(arrayOfPaths)) return;
  loopSourceMap.set(guildId, arrayOfPaths.slice());
}

// Playlist selection helpers
function setPlaylist(guildId, playlistName) {
  if (!playlistName) return playlistMap.delete(guildId);
  playlistMap.set(guildId, playlistName);
}

function getPlaylist(guildId) {
  return playlistMap.get(guildId) || null;
}

function listPlaylists() {
  try {
    const musicDir = path.join(__dirname, "../../commands/music/music");
    if (!fs.existsSync(musicDir)) return [];
    return fs
      .readdirSync(musicDir)
      .filter((f) => fs.statSync(path.join(musicDir, f)).isDirectory());
  } catch (err) {
    logger.error(`listPlaylists error: ${err}`);
    return [];
  }
}

function listPlaylistTracks(playlistName) {
  try {
    const musicDir = path.join(__dirname, "../../commands/music/music");
    const dir = playlistName ? path.join(musicDir, playlistName) : musicDir;
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".mp3"))
      .map((f) => path.join(dir, f));
  } catch (err) {
    logger.error(`listPlaylistTracks error: ${err}`);
    return [];
  }
}

// Random mode type helpers
function setRandomType(guildId, type) {
  const allowed = ["off", "from_playlist", "playlist", "all"];
  if (!allowed.includes(type)) return;
  randomTypeMap.set(guildId, type);
}

function getRandomType(guildId) {
  return randomTypeMap.get(guildId) || "off";
}

function clearLoopSource(guildId) {
  loopSourceMap.delete(guildId);
}

function getLoopSource(guildId) {
  return loopSourceMap.get(guildId);
}

// Zapisz kolejkę dla danej gildii
async function saveQueue(guildId, queue) {
  let queueDoc = await Queue.findOne({ guildId });
  if (!queueDoc) {
    queueDoc = new Queue({ guildId, songs: queue });
  } else {
    queueDoc.songs = queue;
  }
  await queueDoc
    .save()
    .catch((err) => logger.error(`Błąd zapisu kolejki: ${err}`));
}

// Dodaj piosenkę do kolejki
async function addToQueue(guildId, songPath) {
  let queue = await getQueue(guildId);
  queue.push(songPath);
  await saveQueue(guildId, queue);
}

// Wyczyść kolejkę dla danej gildii
async function clearQueue(guildId) {
  await saveQueue(guildId, []);
}

// Przetasuj kolejkę dla danej gildii
async function shuffleQueue(guildId, shuffleTimes = 10) {
  let queue = await getQueue(guildId);
  if (!queue || queue.length < 3) return;

  for (let n = 0; n < shuffleTimes; n++) {
    for (let i = queue.length - 1; i > 1; i--) {
      const j = Math.floor(Math.random() * (i - 1)) + 1;
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
  }

  await saveQueue(guildId, queue);
}

// Sprawdź czy muzyka jest odtwarzana
function isPlay(guildId) {
  return !!isPlaying[guildId];
}

// Zatrzymaj odtwarzanie muzyki
function playersStop(guildId) {
  const emptyResource = createAudioResource(Buffer.alloc(0));
  players[guildId].play(emptyResource);
}

// Sprawdź czy kolejka jest pusta
async function queueEmpty(guildId, interaction) {
  let emptyCheck = await getQueue(guildId);
  if (emptyCheck.length === 0) {
    logger.debug(`🚫 Kolejka dla gildii ${guildId} jest pusta.`);
    // If loop mode for whole queue is enabled and we have a stored source, refill the queue
    if (
      loopQueueMap.get(guildId) &&
      Array.isArray(loopSourceMap.get(guildId)) &&
      loopSourceMap.get(guildId).length > 0
    ) {
      const source = loopSourceMap.get(guildId);
      await saveQueue(guildId, [...source]);
      logger.debug(
        `🔁 Looping queue for gildii ${guildId}. Refilled ${source.length} tracks.`
      );
      playNext(guildId, interaction);
      return;
    }
    if (interaction.channel) {
      interaction.channel.send("⌛ Queue is empty. Waiting for another song!");
    }
    clearAudioFolders(guildId);
    await saveQueue(guildId, []);

    idleTimers[guildId] = setTimeout(() => {
      if (!queues[guildId]?.length && connections[guildId]) {
        connections[guildId].destroy();
        delete connections[guildId];
        logger.debug(`⏹️ Bot rozłączony z ${guildId} z powodu braku muzyki.`);
      }
    }, 180000);
    return;
  }
}

// Sformatuj czas w milisekundach na minuty i sekundy
function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Utwórz pasek postępu dla odtwarzanej piosenki
function createProgressBar(currentTime, totalTime, barLength = 23) {
  if (isNaN(currentTime) || isNaN(totalTime) || totalTime === 0)
    return "[─────────────────]";
  let progress = Math.round((currentTime / totalTime) * barLength);
  progress = Math.max(0, Math.min(progress, barLength));
  return "█".repeat(progress) + "─".repeat(barLength - progress);
}

// Pobierz długość piosenki
async function getSongDuration(songPath) {
  try {
    const metadata = await mm.parseFile(songPath);
    return metadata.format.duration * 1000;
  } catch (err) {
    logger.error(`Błąd pobierania metadanych dla ${songPath}: ${err}`);
    return 0;
  }
}

// Odtwórz następną piosenkę w kolejce
async function playNext(guildId, interaction) {
  if (isPlaying[guildId]) {
    return;
  }
  if (_startingSet.has(guildId)) return; // prevent concurrent starts
  _startingSet.add(guildId);

  try {
    let queue = await getQueue(guildId);

    await queueEmpty(guildId, interaction);

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      logger.debug(`🚫 Użytkownik opuścił kanał głosowy. Bot rozłącza się.`);
      connections[guildId]?.destroy();
      delete connections[guildId];
      return;
    }

    if (
      !connections[guildId] ||
      connections[guildId].joinConfig.channelId !== voiceChannel.id
    ) {
      if (connections[guildId]) {
        connections[guildId].destroy();
      }

      connections[guildId] = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      logger.debug(
        `✅ Bot dołączył do kanału: ${voiceChannel.id} na serwerze ${guildId}`
      );
    }

    if (!connections[guildId]) {
      logger.error(
        `❌ Błąd: Bot nie mógł dołączyć do kanału głosowego na serwerze ${guildId}`
      );
      return;
    }

    const songPath = queue[0];
    if (!songPath) {
      logger.error(
        `🚫 Błąd: Brak poprawnego utworu do odtworzenia dla ${guildId}`
      );
      return;
    }

    logger.info(
      `🎵 Odtwarzanie dla ${guildId}: ${path
        .basename(songPath, ".mp3")
        .replace(/_/g, " ")}`
    );

    isPlaying[guildId] = true;

    const resource = createAudioResource(songPath);
    if (!players[guildId]) players[guildId] = createAudioPlayer();

    connections[guildId].subscribe(players[guildId]);
    players[guildId].play(resource);
    const songName = path.basename(songPath, ".mp3").replace(/_/g, " ");
    const sentMessage = await sendNotification(
      guildId,
      interaction,
      `🎶 Now playing: **${songName}**`
    );
    if (!idleTimers[guildId]) idleTimers[guildId] = {};

    if (idleTimers[guildId]?.progressInterval) {
      clearInterval(idleTimers[guildId].progressInterval);
    }

    if (sentMessage && typeof sentMessage.edit === "function") {
      const totalTime = await getSongDuration(songPath);

      idleTimers[guildId].progressInterval = setInterval(() => {
        if (players[guildId].state.status === AudioPlayerStatus.Playing) {
          const currentTime = players[guildId].state.resource.playbackDuration;
          try {
            sentMessage.edit(
              `🎶 **${songName}**\n${formatTime(currentTime)}/${formatTime(
                totalTime
              )} [${createProgressBar(currentTime, totalTime)}]`
            );
          } catch (e) {
            logger.error(`Failed editing progress message: ${e}`);
          }
        }
      }, 1000);

      players[guildId].once(AudioPlayerStatus.Idle, async () => {
        clearInterval(idleTimers[guildId].progressInterval);
        try {
          sentMessage.edit(`🎶 Finished playing: **${songName}**`);
        } catch (e) {
          logger.error(`Failed editing finished message: ${e}`);
        }
        isPlaying[guildId] = false;
        firstSongStartedMap.set(guildId, false);
        queue = await getQueue(guildId);
        const loopSong = loopSongMap.get(guildId);
        if (!loopSong || loopSong !== songPath) {
          if (queue.length > 0) {
            queue.shift();
            await saveQueue(guildId, queue);
          }
        } else {
          // For a looped song we don't shift the queue so it stays as the first item and will play again
        }
        // release starting lock (allow future playNext calls)
        _startingSet.delete(guildId);
        playNext(guildId, interaction);
      });
    } else {
      // No editable message available; fall back to minimal idle handling
      players[guildId].once(AudioPlayerStatus.Idle, async () => {
        if (idleTimers[guildId]?.progressInterval)
          clearInterval(idleTimers[guildId].progressInterval);
        isPlaying[guildId] = false;
        firstSongStartedMap.set(guildId, false);
        queue = await getQueue(guildId);
        const loopSong = loopSongMap.get(guildId);
        if (!loopSong || loopSong !== songPath) {
          if (queue.length > 0) {
            queue.shift();
            await saveQueue(guildId, queue);
          }
        }
        // ensure we don't start concurrently
        if (!_startingSet.has(guildId)) playNext(guildId, interaction);
      });
    }

    if (idleTimers[guildId]) clearTimeout(idleTimers[guildId]);
  } finally {
    // release starting lock if it somehow was left set and playback didn't start
    if (!isPlaying[guildId]) _startingSet.delete(guildId);
  }
}

// Pobierz kanał kolejki dla danej gildii
async function getQueueChannel(guildId) {
  const query = "SELECT * FROM queue_channels WHERE guild_id = ?";
  try {
    // Tworzenie połączenia z bazą (lub użycie istniejącego)
    const connection = await mysql.createConnection({
      host: config.DB_HOST,
      user: config.DB_USER,
      password: config.DB_PASS,
      database: config.DB_NAME,
    });

    const [results] = await connection.execute(query, [guildId]);
    if (results.length > 0) {
      return results[0].queue_channel_id;
    } else {
      return null;
    }
  } catch (err) {
    console.error("Błąd zapytania:", err);
    throw err;
  }
}

// Notification channel (Mongo-backed)
async function setNotificationChannel(guildId, channelId) {
  try {
    let doc = await QueueChannel.findOne({ guildId });
    if (!doc) {
      doc = new QueueChannel({ guildId, channelId });
    } else {
      doc.channelId = channelId;
    }
    await doc.save();
  } catch (err) {
    logger.error(`Error setting notification channel for ${guildId}: ${err}`);
  }
}

async function clearNotificationChannel(guildId) {
  try {
    await QueueChannel.deleteOne({ guildId });
  } catch (err) {
    logger.error(`Error clearing notification channel for ${guildId}: ${err}`);
  }
}

async function getNotificationChannel(guildId) {
  try {
    const doc = await QueueChannel.findOne({ guildId });
    return doc ? doc.channelId : null;
  } catch (err) {
    logger.error(`Error fetching notification channel for ${guildId}: ${err}`);
    return null;
  }
}

// Send notification to configured channel if present, otherwise fall back to interaction.channel
async function sendNotification(guildId, interaction, content, options = {}) {
  try {
    const channelId = await getNotificationChannel(guildId);
    if (channelId) {
      try {
        const ch = await interaction.guild.channels.fetch(channelId);
        if (ch && ch.send) {
          return ch.send({ content, ...options });
        }
      } catch (e) {
        logger.error(`Failed to send to configured channel ${channelId}: ${e}`);
      }
    }

    // fallback to the channel where command was issued
    if (interaction.channel && interaction.channel.send) {
      return interaction.channel.send({ content, ...options });
    }
  } catch (err) {
    logger.error(`sendNotification error for ${guildId}: ${err}`);
  }
  return null;
}

// Rozpocznij odtwarzanie muzyki
function startPlaying(interaction) {
  const guildId = interaction.guild.id;
  if (
    !players[guildId] ||
    players[guildId].state.status !== AudioPlayerStatus.Playing
  ) {
    playNext(guildId, interaction);
  }
}

// Stop playback and clean up timers/listeners to avoid duplicate playNext calls
function stopAndCleanup(guildId) {
  try {
    // clear progress interval if any
    if (idleTimers[guildId]?.progressInterval) {
      clearInterval(idleTimers[guildId].progressInterval);
      delete idleTimers[guildId].progressInterval;
    }
    // clear any timeout used for idle disconnects
    if (idleTimers[guildId] && typeof idleTimers[guildId] === "number") {
      clearTimeout(idleTimers[guildId]);
    }
    if (idleTimers[guildId] && idleTimers[guildId].timeout) {
      clearTimeout(idleTimers[guildId].timeout);
      delete idleTimers[guildId].timeout;
    }
    delete idleTimers[guildId];

    isPlaying[guildId] = false;
    firstSongStartedMap.set(guildId, false);

    // Ensure auto/random/loop modes are disabled when stopping to avoid leftover behavior
    try {
      autoModeMap.set(guildId, false);
      randomModeMap.set(guildId, false);
      loopQueueMap.set(guildId, false);
      loopSourceMap.delete(guildId);
    } catch (e) {
      logger.error(
        `Failed resetting auto/random/loop state for ${guildId}: ${e}`
      );
    }

    if (players[guildId]) {
      try {
        if (typeof players[guildId].removeAllListeners === "function")
          players[guildId].removeAllListeners();
      } catch (e) {
        logger.error(`Failed removing player listeners for ${guildId}: ${e}`);
      }
      try {
        if (typeof players[guildId].stop === "function")
          players[guildId].stop();
      } catch (e) {
        logger.error(`Failed stopping player for ${guildId}: ${e}`);
      }
      // keep players object; it will be re-used or recreated on next play
    }

    if (connections[guildId]) {
      try {
        connections[guildId].destroy();
      } catch (e) {
        logger.error(`Failed destroying connection for ${guildId}: ${e}`);
      }
      delete connections[guildId];
    }
    // ensure start-lock is cleared so playNext can run again after stop/clear
    if (_startingSet.has(guildId)) _startingSet.delete(guildId);
  } catch (err) {
    logger.error(`stopAndCleanup error for ${guildId}: ${err}`);
  }
}

module.exports = {
  getQueue,
  saveQueue,
  addToQueue,
  clearQueue,
  playNext,
  startPlaying,
  getQueueChannel,
  shuffleQueue,
  isPlay,
  playersStop,
  connections,
  firstSongStartedMap,
  checkFirstSongStarted,
  players,
  isPlaying,
  setLoopSong,
  clearLoopSong,
  getLoopSong,
  setAutoMode,
  getAutoMode,
  setRandomMode,
  getRandomMode,
  setLoopQueueMode,
  getLoopQueueMode,
  setLoopSource,
  clearLoopSource,
  getLoopSource,
  setNotificationChannel,
  clearNotificationChannel,
  getNotificationChannel,
  sendNotification,
  setPlaylist,
  getPlaylist,
  listPlaylists,
  listPlaylistTracks,
  setRandomType,
  getRandomType,
  stopAndCleanup,
};
