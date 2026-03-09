function createMusicStateTools() {
  const firstSongStartedMap = new Map();
  let connections = {};
  let idleTimers = {};
  let isPlaying = {};
  let players = {};
  let queues = {};
  const priorityQueues = {};
  const historyMap = {};
  const previousQueues = {};
  const previousPriorityQueues = {};
  const currentlyPlayingSource = {};
  const nextTrackInfo = new Map();
  const loopSongMap = new Map();
  const _startingSet = new Set();
  const autoModeMap = new Map();
  const randomModeMap = new Map();
  const loopQueueMap = new Map();
  const loopSourceMap = new Map();
  const playlistMap = new Map();
  const autoPlaylistsMap = new Map();
  const randomTypeMap = new Map();
  const progressIntervalsMap = new Map();
  const skipPreviousRecordMap = new Map();
  const skipQueueShiftMap = new Map();
  const currentTrackMap = new Map();

  function checkFirstSongStarted(guildId) {
    if (!firstSongStartedMap.has(guildId)) {
      firstSongStartedMap.set(guildId, false);
    }
    return firstSongStartedMap.get(guildId);
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

  function clearLoopSource(guildId) {
    loopSourceMap.delete(guildId);
  }

  function getLoopSource(guildId) {
    return loopSourceMap.get(guildId);
  }

  function addToPriorityQueue(guildId, songPath) {
    if (!priorityQueues[guildId]) priorityQueues[guildId] = [];
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
    if (historyMap[guildId].length > 200) historyMap[guildId].shift();
  }

  function getHistory(guildId) {
    return historyMap[guildId] || [];
  }

  function pushPreviousQueue(guildId, songPath) {
    if (!previousQueues[guildId]) previousQueues[guildId] = [];
    previousQueues[guildId].push(songPath);
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

  function addToPreviousPriorityQueue(guildId, songPath) {
    if (!previousPriorityQueues[guildId]) previousPriorityQueues[guildId] = [];
    previousPriorityQueues[guildId].push(songPath);
    if (previousPriorityQueues[guildId].length > 200) {
      previousPriorityQueues[guildId].shift();
    }
  }

  function getPreviousPriorityQueue(guildId) {
    return previousPriorityQueues[guildId] || [];
  }

  function clearPreviousPriorityQueue(guildId) {
    previousPriorityQueues[guildId] = [];
  }

  function setRandomType(guildId, type) {
    const allowed = ["off", "from_playlist", "playlist", "all"];
    if (!allowed.includes(type)) return;
    randomTypeMap.set(guildId, type);
  }

  function getRandomType(guildId) {
    return randomTypeMap.get(guildId) || "off";
  }

  function getCurrentTrackPath(guildId) {
    return currentTrackMap.get(guildId) || null;
  }

  function getCurrentSource(guildId) {
    return currentlyPlayingSource[guildId] || null;
  }

  return {
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
  };
}

module.exports = {
  createMusicStateTools,
};
