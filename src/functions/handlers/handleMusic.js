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
const priorityQueues = {};
const historyMap = {};
// separate structure to maintain a 'previous' queue (tracks that have finished playing)
// this is what `/queue previous` will pull from. we keep it distinct from historyMap
// because history is also used for informational commands like `/queue next`.
const previousQueues = {};
// highest-priority queue used when /queue previous is invoked
const previousPriorityQueues = {};
const currentlyPlayingSource = {}; // 'main' or 'priority'
const nextTrackInfo = new Map(); // guildId -> { songPath, source: 'priority'|'main' } for display in Idle
const loopSongMap = new Map();
const _startingSet = new Set();
const autoModeMap = new Map();
const randomModeMap = new Map();
const loopQueueMap = new Map();
const loopSourceMap = new Map();
const playlistMap = new Map(); // guildId -> playlist name
const randomTypeMap = new Map(); // guildId -> 'off'|'from_playlist'|'playlist'|'all'
const progressIntervalsMap = new Map(); // guildId -> intervalId (for more reliable cleanup)
const skipPreviousRecordMap = new Map();

// Check if the first song was started
function checkFirstSongStarted(guildId) {
  if (!firstSongStartedMap.has(guildId)) {
    firstSongStartedMap.set(guildId, false);
  }
  return firstSongStartedMap.get(guildId);
}

// Get the queue for a guild
async function getQueue(guildId) {
  let queue = await Queue.findOne({ guildId });
  if (!queue) {
    queue = new Queue({ guildId, songs: [] });
    await queue.save().catch((err) => logger.error(`Queue save error: ${err}`));
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

// Save the queue for a guild
async function saveQueue(guildId, queue) {
  let queueDoc = await Queue.findOne({ guildId });
  if (!queueDoc) {
    queueDoc = new Queue({ guildId, songs: queue });
  } else {
    queueDoc.songs = queue;
  }
  await queueDoc
    .save()
    .catch((err) => logger.error(`Queue save error: ${err}`));
}

// Priority queue: songs that should be played next (not persisted)
function addToPriorityQueue(guildId, songPath) {
  if (!priorityQueues[guildId]) priorityQueues[guildId] = [];
  // add to end (FIFO)
  priorityQueues[guildId].push(songPath);
}

function getPriorityQueue(guildId) {
  return priorityQueues[guildId] || [];
}

function clearPriorityQueue(guildId) {
  if (priorityQueues[guildId]) priorityQueues[guildId] = [];
}

function pushHistory(guildId, songPath) {
  if (!historyMap[guildId]) historyMap[guildId] = [];
  historyMap[guildId].push(songPath);
  // limit history to 200
  if (historyMap[guildId].length > 200) historyMap[guildId].shift();
}

function getHistory(guildId) {
  return historyMap[guildId] || [];
}

// previous-queue helpers --------------------------------------------------
function pushPreviousQueue(guildId, songPath) {
  if (!previousQueues[guildId]) previousQueues[guildId] = [];
  previousQueues[guildId].push(songPath);
  // keep it reasonably bounded
  if (previousQueues[guildId].length > 200) previousQueues[guildId].shift();
}

function popPreviousQueue(guildId) {
  const q = previousQueues[guildId] || [];
  return q.length > 0 ? q.pop() : null;
}

function getPreviousQueue(guildId) {
  return previousQueues[guildId] || [];
}

function clearPreviousQueue(guildId) {
  previousQueues[guildId] = [];
}

// previous priority queue helpers -----------------------------------------
function addToPreviousPriorityQueue(guildId, songPath) {
  if (!previousPriorityQueues[guildId]) previousPriorityQueues[guildId] = [];
  previousPriorityQueues[guildId].push(songPath);
  if (previousPriorityQueues[guildId].length > 200)
    previousPriorityQueues[guildId].shift();
}

function getPreviousPriorityQueue(guildId) {
  return previousPriorityQueues[guildId] || [];
}

function clearPreviousPriorityQueue(guildId) {
  previousPriorityQueues[guildId] = [];
}

// Play previous track from history
async function playPrevious(guildId, interaction) {
  // grab the last played song from the dedicated "previous" queue. this
  // queue is populated when tracks finish. we `pop` so that calling
  // `/queue previous` repeatedly will step backwards through the history.
  const previousTrack = popPreviousQueue(guildId);
  if (!previousTrack) {
    if (interaction && interaction.reply)
      return interaction.reply({
        content: "🚫 No previous track.",
        ephemeral: true,
      });
    return;
  }

  // schedule the previous track to play next with the highest priority
  addToPreviousPriorityQueue(guildId, previousTrack);

  // the currently playing song should become the next after the previous
  const history = getHistory(guildId);
  const currentTrack =
    history && history.length > 0 ? history[history.length - 1] : null;
  if (currentTrack) addToPreviousPriorityQueue(guildId, currentTrack);

  // ensure the currently playing song does NOT get recorded to previousQueue
  skipPreviousRecordMap.set(guildId, true);

  // stop the currently playing song; the idle listener in playNext will shift
  // the queue and start the next track (which is the one we just queued).
  if (players[guildId]) {
    try {
      players[guildId].stop();
    } catch (e) {}
  }

  // make sure the handler knows the queue is no longer playing so a new song
  // can be started; we don't want the previous lock to block playNext
  isPlaying[guildId] = false;
  _startingSet.delete(guildId);
}

function pause(guildId) {
  if (players[guildId] && typeof players[guildId].pause === "function") {
    try {
      players[guildId].pause();
      return true;
    } catch (e) {
      logger.error(`pause error for ${guildId}: ${e}`);
    }
  }
  return false;
}
function resume(guildId) {
  if (players[guildId] && typeof players[guildId].unpause === "function") {
    try {
      players[guildId].unpause();
      return true;
    } catch (e) {
      logger.error(`resume error for ${guildId}: ${e}`);
    }
  }
  return false;
}

// Add a song to the queue
async function addToQueue(guildId, songPath) {
  let queue = await getQueue(guildId);
  queue.push(songPath);
  await saveQueue(guildId, queue);
}
// Add a song to position 2 (index 1) in the queue
async function addToQueueNext(guildId, songPath) {
  let queue = await getQueue(guildId);
  queue.splice(1, 0, songPath);
  await saveQueue(guildId, queue);
}
// Clear the queue for a guild
async function clearQueue(guildId) {
  await saveQueue(guildId, []);
  // when the main queue is wiped we should also forget any "previous" history
  clearPreviousQueue(guildId);
  clearPreviousPriorityQueue(guildId);
}

// Shuffle the queue for a guild
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

// Check if music is currently playing
function isPlay(guildId) {
  return !!isPlaying[guildId];
}

// Stop music playback
function playersStop(guildId) {
  const emptyResource = createAudioResource(Buffer.alloc(0));
  players[guildId].play(emptyResource);
}

// Check if the queue is empty
async function queueEmpty(guildId, interaction) {
  let emptyCheck = await getQueue(guildId);
  if (emptyCheck.length === 0) {
    logger.debug(`🚫 Queue for guild ${guildId} is empty.`);
    // If loop mode for whole queue is enabled and we have a stored source, refill the queue
    if (
      loopQueueMap.get(guildId) &&
      Array.isArray(loopSourceMap.get(guildId)) &&
      loopSourceMap.get(guildId).length > 0
    ) {
      const source = loopSourceMap.get(guildId);
      await saveQueue(guildId, [...source]);
      logger.debug(
        `🔁 Looping queue for guild ${guildId}. Refilled ${source.length} tracks.`,
      );
      try {
        await playNext(guildId, interaction);
      } catch (err) {
        logger.error(`Error in queueEmpty playNext call: ${err}`);
      }
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
        logger.debug(`⏹️ Bot disconnected from ${guildId} due to no music.`);
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

// Create a progress bar for the currently playing song
function createProgressBar(currentTime, totalTime, barLength = 23) {
  if (isNaN(currentTime) || isNaN(totalTime) || totalTime === 0)
    return "[─────────────────]";
  let progress = Math.round((currentTime / totalTime) * barLength);
  progress = Math.max(0, Math.min(progress, barLength));
  return "█".repeat(progress) + "─".repeat(barLength - progress);
}

// Get song duration from metadata
async function getSongDuration(songPath) {
  try {
    const metadata = await mm.parseFile(songPath);
    return metadata.format.duration * 1000;
  } catch (err) {
    logger.error(`Error fetching metadata for ${songPath}: ${err}`);
    return 0;
  }
}

// Truncate string to max length, appending ellipsis if needed
function truncate(str, maxLen) {
  if (!str || typeof str !== "string") return str;
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

// Get song name from metadata (artist/title) or fallback to filename
async function getSongName(songPath) {
  try {
    const metadata = await mm.parseFile(songPath);
    let artist = metadata.common?.artist;
    let title = metadata.common?.title;

    if (artist && title) {
      // limit artist length for display
      artist = truncate(artist, 25);
      title = truncate(title, 50); // also protect title if very long
      return `${title} - ${artist}`;
    }
  } catch (err) {
    logger.debug(`Unable to fetch metadata for ${songPath}: ${err}`);
  }

  // Fallback to filename if metadata unavailable
  return path.basename(songPath, ".mp3").replace(/_/g, " ");
}

// Play the next song in the queue
async function playNext(guildId, interaction) {
  // Aggressive cleanup of old progress interval first
  if (progressIntervalsMap.has(guildId)) {
    const oldInterval = progressIntervalsMap.get(guildId);
    clearInterval(oldInterval);
    progressIntervalsMap.delete(guildId);
  }
  // Also clean up from idleTimers to be safe
  if (idleTimers[guildId]) {
    if (typeof idleTimers[guildId].progressInterval === "number") {
      clearInterval(idleTimers[guildId].progressInterval);
    } else if (idleTimers[guildId].progressInterval) {
      clearInterval(idleTimers[guildId].progressInterval);
    }
    idleTimers[guildId].progressInterval = null;
  }

  if (isPlaying[guildId]) {
    return;
  }
  if (_startingSet.has(guildId)) return; // prevent concurrent starts
  _startingSet.add(guildId);

  try {
    let queue = await getQueue(guildId);

    await queueEmpty(guildId, interaction);

    // In case queueEmpty refilled the queue (e.g., looped playlist), re-fetch it so
    // the rest of this function sees the newly saved tracks.
    queue = await getQueue(guildId);

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      logger.debug(`🚫 User left voice channel. Bot disconnecting.`);
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
        `✅ Bot joined voice channel: ${voiceChannel.id} on server ${guildId}`,
      );
    }

    if (!connections[guildId]) {
      logger.error(
        `❌ Error: Bot couldn't join the voice channel on server ${guildId}`,
      );
      return;
    }

    // choose next song: previous-priority queue > priority queue > main queue
    let songPath;
    const ppQueue = getPreviousPriorityQueue(guildId);
    const pQueue = getPriorityQueue(guildId);
    if (ppQueue && ppQueue.length > 0) {
      songPath = ppQueue.shift();
      currentlyPlayingSource[guildId] = "previous_priority";
      // remove it from main queue if it was also inserted there for visibility
      const idx = queue.indexOf(songPath);
      if (idx >= 0) {
        queue.splice(idx, 1);
        await saveQueue(guildId, queue);
      }
    } else if (pQueue && pQueue.length > 0) {
      songPath = pQueue.shift();
      currentlyPlayingSource[guildId] = "priority";
    } else {
      songPath = queue[0];
      currentlyPlayingSource[guildId] = "main";
    }
    if (!songPath) {
      logger.error(`🚫 Error: No valid track to play for ${guildId}`);
      return;
    }

    // Cache next track info for display purposes
    const nextPPQueue = getPreviousPriorityQueue(guildId);
    const nextPQueue = getPriorityQueue(guildId);
    const nextQueue = await getQueue(guildId);
    let nextTrackData = null;

    // Account for the fact that currently playing song is still in the queue
    if (currentlyPlayingSource[guildId] === "previous_priority") {
      // Playing from previous-priority queue, next is remaining prev-priority,
      // then priority, then main queue
      if (nextPPQueue && nextPPQueue.length > 0) {
        nextTrackData = { songPath: nextPPQueue[0], source: "previous" };
      } else if (nextPQueue && nextPQueue.length > 0) {
        nextTrackData = { songPath: nextPQueue[0], source: "priority" };
      } else if (nextQueue && nextQueue.length > 0) {
        nextTrackData = { songPath: nextQueue[0], source: "main" };
      }
    } else if (currentlyPlayingSource[guildId] === "priority") {
      // Playing from priority queue, next is remaining prev-priority,
      // then remaining priority, or main queue
      if (nextPPQueue && nextPPQueue.length > 0) {
        nextTrackData = { songPath: nextPPQueue[0], source: "previous" };
      } else if (nextPQueue && nextPQueue.length > 0) {
        nextTrackData = { songPath: nextPQueue[0], source: "priority" };
      } else if (nextQueue && nextQueue.length > 0) {
        nextTrackData = { songPath: nextQueue[0], source: "main" };
      }
    } else if (currentlyPlayingSource[guildId] === "main") {
      // Playing from main queue, current song is at [0], so next is at [1]
      if (nextPPQueue && nextPPQueue.length > 0) {
        nextTrackData = { songPath: nextPPQueue[0], source: "previous" };
      } else if (nextPQueue && nextPQueue.length > 0) {
        nextTrackData = { songPath: nextPQueue[0], source: "priority" };
      } else if (nextQueue && nextQueue.length > 1) {
        nextTrackData = { songPath: nextQueue[1], source: "main" };
      }
    }
    nextTrackInfo.set(guildId, nextTrackData);

    isPlaying[guildId] = true;

    const resource = createAudioResource(songPath);
    if (!players[guildId]) players[guildId] = createAudioPlayer();

    connections[guildId].subscribe(players[guildId]);
    players[guildId].play(resource);
    const songName = await getSongName(songPath);
    const isPrioritySong = currentlyPlayingSource[guildId] === "priority";
    const displayName = isPrioritySong ? `⭐ ${songName}` : songName;

    logger.info(
      `🎵 Now playing for ${guildId}: ${songName} (priority: ${isPrioritySong})`,
    );
    // record played song in history (for back navigation)
    pushHistory(guildId, songPath);

    // Run getSongDuration in parallel with the initial notification; we'll edit the
    // notification once we know the total time so the displayed length isn't a
    // countdown but a static value.
    const [sentMessage, totalTime] = await Promise.all([
      sendNotification(guildId, interaction, `🎶 Now playing: **${songName}**`),
      getSongDuration(songPath),
    ]);

    // if we have a sent message, append the formatted total length
    if (sentMessage && typeof sentMessage.edit === "function") {
      try {
        sentMessage.edit(
          `🎶 Now playing: **${displayName}** [${formatTime(totalTime)}]`,
        );
      } catch (e) {
        logger.error(`Failed editing initial notification for duration: ${e}`);
      }
    }

    if (!idleTimers[guildId]) idleTimers[guildId] = {};

    if (idleTimers[guildId]?.progressInterval) {
      clearInterval(idleTimers[guildId].progressInterval);
    }

    if (sentMessage && typeof sentMessage.edit === "function") {
      // let lastEditedSecond = -1; // commented timer tracking
      let lastProgressSegment = -1;

      const progressInterval = setInterval(() => {
        if (players[guildId].state.status === AudioPlayerStatus.Playing) {
          const currentTime = players[guildId].state.resource.playbackDuration;
          // const currentSecond = Math.floor(currentTime / 1000); // no numeric display
          const currentProgress = Math.round((currentTime / totalTime) * 23);

          let shouldUpdate = false;
          // let updateReason = "";

          // only update on progress bar change
          if (currentProgress !== lastProgressSegment) {
            lastProgressSegment = currentProgress;
            shouldUpdate = true;
            // updateReason += "progress";
          }

          if (shouldUpdate) {
            try {
              sentMessage.edit(
                `🎶 **${displayName}** (${formatTime(totalTime)})\n[${createProgressBar(currentTime, totalTime)}]`,
              );
            } catch (e) {
              logger.error(`Failed editing progress message: ${e}`);
            }
          }
        }
      }, 100);

      // Store interval in both places for redundancy
      idleTimers[guildId].progressInterval = progressInterval;
      progressIntervalsMap.set(guildId, progressInterval);

      // Immediately update message with initial progress bar (no timers)
      try {
        sentMessage.edit(
          `🎶 **${songName}** (${formatTime(totalTime)})\n[${createProgressBar(0, totalTime)}]`,
        );
      } catch (e) {
        logger.debug(`Initial progress bar edit failed: ${e}`);
      }

      players[guildId].once(AudioPlayerStatus.Idle, async () => {
        // Clean up progress interval BEFORE anything else
        if (progressIntervalsMap.has(guildId)) {
          clearInterval(progressIntervalsMap.get(guildId));
          progressIntervalsMap.delete(guildId);
        }
        if (idleTimers[guildId]?.progressInterval) {
          clearInterval(idleTimers[guildId].progressInterval);
          idleTimers[guildId].progressInterval = null;
        }
        try {
          // Get next track info that was cached by playNext()
          const cachedNextTrack = nextTrackInfo.get(guildId);
          let nextSongName = null;
          let nextSource = null;

          if (cachedNextTrack) {
            nextSongName = await getSongName(cachedNextTrack.songPath);
            nextSource = cachedNextTrack.source;
          }

          // only state that the track finished, no longer mention next track
          const finishedMsg = `🎶 Finished playing: **${isPrioritySong ? "⭐ " : ""}${songName}**`;

          sentMessage.edit(finishedMsg);
        } catch (e) {
          logger.error(`Failed editing finished message: ${e}`);
        }
        // record the finished track in the previous queue (used by /queue previous)
        if (skipPreviousRecordMap.get(guildId)) {
          skipPreviousRecordMap.delete(guildId);
        } else {
          pushPreviousQueue(guildId, songPath);
        }

        isPlaying[guildId] = false;
        firstSongStartedMap.set(guildId, false);
        queue = await getQueue(guildId);
        const loopSong = loopSongMap.get(guildId);
        if (currentlyPlayingSource[guildId] === "main") {
          // if the song was from main queue and not looped single-song, shift it
          if (!loopSong || loopSong !== songPath) {
            if (queue.length > 0) {
              queue.shift();
              await saveQueue(guildId, queue);
            }
          }
        }
        // clear currentlyPlayingSource for guild
        delete currentlyPlayingSource[guildId];
        // clear next track cache
        nextTrackInfo.delete(guildId);
        // release starting lock (allow future playNext calls)
        _startingSet.delete(guildId);
        try {
          await playNext(guildId, interaction);
        } catch (err) {
          logger.error(`Error in Idle listener playNext call: ${err}`);
        }
      });
    } else {
      // No editable message available; fall back to minimal idle handling
      players[guildId].once(AudioPlayerStatus.Idle, async () => {
        if (progressIntervalsMap.has(guildId)) {
          clearInterval(progressIntervalsMap.get(guildId));
          progressIntervalsMap.delete(guildId);
        }
        if (idleTimers[guildId]?.progressInterval) {
          clearInterval(idleTimers[guildId].progressInterval);
          idleTimers[guildId].progressInterval = null;
        }
        // finished track should go to previous queue unless explicitly skipped
        if (skipPreviousRecordMap.get(guildId)) {
          skipPreviousRecordMap.delete(guildId);
        } else {
          pushPreviousQueue(guildId, songPath);
        }

        isPlaying[guildId] = false;
        firstSongStartedMap.set(guildId, false);
        queue = await getQueue(guildId);
        const loopSong = loopSongMap.get(guildId);
        if (currentlyPlayingSource[guildId] === "main") {
          if (!loopSong || loopSong !== songPath) {
            if (queue.length > 0) {
              queue.shift();
              await saveQueue(guildId, queue);
            }
          }
        }
        delete currentlyPlayingSource[guildId];
        // ensure we don't start concurrently
        if (!_startingSet.has(guildId)) {
          try {
            await playNext(guildId, interaction);
          } catch (err) {
            logger.error(
              `Error in fallback Idle listener playNext call: ${err}`,
            );
          }
        }
      });
    }

    if (idleTimers[guildId]) clearTimeout(idleTimers[guildId]);
  } finally {
    // release starting lock if it somehow was left set and playback didn't start
    if (!isPlaying[guildId]) _startingSet.delete(guildId);
  }
}

// Get the queue channel for a guild
async function getQueueChannel(guildId) {
  const query = "SELECT * FROM queue_channels WHERE guild_id = ?";
  try {
    // Create database connection (or use existing one)
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
    console.error("Query error:", err);
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

// Start playing music
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
    // clear progress interval if any - use Map first for reliability
    if (progressIntervalsMap.has(guildId)) {
      clearInterval(progressIntervalsMap.get(guildId));
      progressIntervalsMap.delete(guildId);
    }
    // Also clean up from idleTimers
    if (idleTimers[guildId]) {
      if (idleTimers[guildId].progressInterval) {
        clearInterval(idleTimers[guildId].progressInterval);
        idleTimers[guildId].progressInterval = null;
      }
      if (idleTimers[guildId].timeout) {
        clearTimeout(idleTimers[guildId].timeout);
        idleTimers[guildId].timeout = null;
      }
    }
    // clear any timeout used for idle disconnects
    if (idleTimers[guildId] && typeof idleTimers[guildId] === "number") {
      clearTimeout(idleTimers[guildId]);
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
        `Failed resetting auto/random/loop state for ${guildId}: ${e}`,
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
    // also clear previous queue so old tracks aren't accidentally reused
    clearPreviousQueue(guildId);
    clearPreviousPriorityQueue(guildId);
    skipPreviousRecordMap.delete(guildId);
  } catch (err) {
    logger.error(`stopAndCleanup error for ${guildId}: ${err}`);
  }
}

module.exports = {
  getQueue,
  saveQueue,
  addToQueue,
  addToQueueNext,
  clearQueue,
  playNext,
  startPlaying,
  getQueueChannel,
  shuffleQueue,
  addToPriorityQueue,
  getPriorityQueue,
  clearPriorityQueue,
  playPrevious,
  pause,
  resume,
  getHistory,
  // previous queue helpers
  getPreviousQueue,
  popPreviousQueue,
  clearPreviousQueue,
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
  getSongName,
};
