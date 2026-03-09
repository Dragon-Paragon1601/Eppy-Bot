function createMusicQueueTools({
  getQueue,
  saveQueue,
  clearPreviousQueue,
  clearPreviousPriorityQueue,
}) {
  // Add a song to the queue tail.
  async function addToQueue(guildId, songPath) {
    const queue = await getQueue(guildId);
    queue.push(songPath);
    await saveQueue(guildId, queue);
  }

  // Insert a song right after the currently playing entry.
  async function addToQueueNext(guildId, songPath) {
    const queue = await getQueue(guildId);
    queue.splice(1, 0, songPath);
    await saveQueue(guildId, queue);
  }

  async function clearQueue(guildId) {
    await saveQueue(guildId, []);
    clearPreviousQueue(guildId);
    clearPreviousPriorityQueue(guildId);
  }

  async function shuffleQueue(guildId, shuffleTimes = 10) {
    const queue = await getQueue(guildId);
    if (!queue || queue.length < 3) return;

    for (let n = 0; n < shuffleTimes; n++) {
      for (let i = queue.length - 1; i > 1; i--) {
        const j = Math.floor(Math.random() * (i - 1)) + 1;
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    }

    await saveQueue(guildId, queue);
  }

  return {
    addToQueue,
    addToQueueNext,
    clearQueue,
    shuffleQueue,
  };
}

module.exports = {
  createMusicQueueTools,
};
