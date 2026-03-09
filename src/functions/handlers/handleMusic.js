const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
} = require("@discordjs/voice");
const { clearAudioFolders } = require("./handleClearAudio");
const logger = require("./../../logger");
const mm = require("music-metadata");
const path = require("path");
const fs = require("fs");
const config = require("../../config");
const pool = require("../../events/mysql/connect");
const runtimeStore = require("../../database/runtimeStore");
const { createMusicCatalogTools } = require("../tools/musicCatalog");
const { createMusicQueueTools } = require("../tools/musicQueue");
const { createMusicTrackInfoTools } = require("../tools/musicTrackInfo");
const { createMusicStateTools } = require("../tools/musicState");
const { createMusicNotificationTools } = require("../tools/musicNotification");
const { createMusicPlaybackTools } = require("../tools/musicPlayback");
const {
  getGuildNotificationSettings,
  isNotificationTypeEnabled,
} = require("../tools/notificationSettings");
const {
  firstSongStartedMap,
  connections,
  idleTimers,
  isPlaying,
  players,
  queues,
  currentlyPlayingSource,
  nextTrackInfo,
  loopSongMap,
  _startingSet,
  autoModeMap,
  randomModeMap,
  loopQueueMap,
  loopSourceMap,
  playlistMap,
  autoPlaylistsMap,
  progressIntervalsMap,
  skipPreviousRecordMap,
  skipQueueShiftMap,
  currentTrackMap,
  checkFirstSongStarted,
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
  addToPriorityQueue,
  getPriorityQueue,
  clearPriorityQueue,
  pushHistory,
  getHistory,
  pushPreviousQueue,
  popPreviousQueue,
  getPreviousQueue,
  clearPreviousQueue,
  addToPreviousPriorityQueue,
  getPreviousPriorityQueue,
  clearPreviousPriorityQueue,
  setRandomType,
  getRandomType,
  getCurrentTrackPath,
  getCurrentSource,
} = createMusicStateTools();

// Get the queue for a guild
async function getQueue(guildId) {
  return runtimeStore.getQueue(guildId);
}

const {
  getMusicBaseDir,
  listPlaylists,
  listPlaylistTracks,
  setPlaylist,
  getPlaylist,
  getAutoPlaylists,
  toggleAutoPlaylist,
  clearAutoPlaylists,
  selectAllAutoPlaylists,
  getAutoQueueTracks,
  recordTrackPlayForSmartShuffle,
  smartShuffleTracks,
} = createMusicCatalogTools({
  config,
  logger,
  runtimeStore,
  getHistory,
  getAutoMode,
  getRandomMode,
  playlistMap,
  autoPlaylistsMap,
  path,
  fs,
});

// Save the queue for a guild
async function saveQueue(guildId, queue) {
  await runtimeStore.saveQueue(guildId, queue);
}

const { addToQueue, addToQueueNext, clearQueue, shuffleQueue } =
  createMusicQueueTools({
    getQueue,
    saveQueue,
    clearPreviousQueue,
    clearPreviousPriorityQueue,
  });

const { formatTime, createProgressBar, getSongDuration, getSongName } =
  createMusicTrackInfoTools({ logger, mm, path });

const { getQueueChannel, sendNotification } = createMusicNotificationTools({
  pool,
  logger,
  getGuildNotificationSettings,
  isNotificationTypeEnabled,
});

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

  // if we're currently playing a track that itself came from /queue previous,
  // move it to the front of the main queue so it can play later and we can
  // safely pull another previous item next.
  if (currentlyPlayingSource[guildId] === "previous_priority") {
    const history = getHistory(guildId);
    const currentTrack =
      history && history.length > 0 ? history[history.length - 1] : null;
    if (currentTrack) {
      const queue = await getQueue(guildId);
      if (!queue || queue[0] !== currentTrack) {
        const nextQueue = Array.isArray(queue) ? queue.slice() : [];
        nextQueue.unshift(currentTrack);
        await saveQueue(guildId, nextQueue);
      }
    }
  }

  // ensure the currently playing song does NOT get recorded to previousQueue
  skipPreviousRecordMap.set(guildId, true);
  // ensure the currently playing song is not removed from the main queue
  skipQueueShiftMap.set(guildId, true);

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

// Check if music is currently playing
function isPlay(guildId) {
  return !!isPlaying[guildId];
}

// Stop music playback
function playersStop(guildId) {
  const emptyResource = createAudioResource(Buffer.alloc(0));
  players[guildId].play(emptyResource);
}

const { playNext, startPlaying } = createMusicPlaybackTools({
  logger,
  clearAudioFolders,
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
  getQueue,
  saveQueue,
  smartShuffleTracks,
  getAutoMode,
  getRandomMode,
  getPreviousPriorityQueue,
  getPriorityQueue,
  getSongName,
  sendNotification,
  getSongDuration,
  formatTime,
  createProgressBar,
  pushHistory,
  pushPreviousQueue,
  recordTrackPlayForSmartShuffle,
  firstSongStartedMap,
  connections,
  idleTimers,
  isPlaying,
  players,
  queues,
  currentlyPlayingSource,
  nextTrackInfo,
  loopSongMap,
  _startingSet,
  loopQueueMap,
  loopSourceMap,
  progressIntervalsMap,
  skipPreviousRecordMap,
  skipQueueShiftMap,
  currentTrackMap,
});

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
    currentTrackMap.delete(guildId);
    // also clear previous queue so old tracks aren't accidentally reused
    clearPreviousQueue(guildId);
    clearPreviousPriorityQueue(guildId);
    skipPreviousRecordMap.delete(guildId);
    skipQueueShiftMap.delete(guildId);
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
  getPreviousPriorityQueue,
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
  sendNotification,
  getMusicBaseDir,
  setPlaylist,
  getPlaylist,
  listPlaylists,
  listPlaylistTracks,
  getAutoPlaylists,
  toggleAutoPlaylist,
  clearAutoPlaylists,
  selectAllAutoPlaylists,
  getAutoQueueTracks,
  smartShuffleTracks,
  setRandomType,
  getRandomType,
  stopAndCleanup,
  getSongName,
  getCurrentTrackPath,
  getCurrentSource,
};
