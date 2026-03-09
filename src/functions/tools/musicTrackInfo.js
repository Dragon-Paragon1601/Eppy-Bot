function createMusicTrackInfoTools({ logger, mm, path }) {
  function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function createProgressBar(currentTime, totalTime, barLength = 23) {
    if (isNaN(currentTime) || isNaN(totalTime) || totalTime === 0) {
      return "[─────────────────]";
    }

    let progress = Math.round((currentTime / totalTime) * barLength);
    progress = Math.max(0, Math.min(progress, barLength));
    return "█".repeat(progress) + "─".repeat(barLength - progress);
  }

  async function getSongDuration(songPath) {
    try {
      const metadata = await mm.parseFile(songPath);
      return metadata.format.duration * 1000;
    } catch (err) {
      logger.error(`Error fetching metadata for ${songPath}: ${err}`);
      return 0;
    }
  }

  function truncate(str, maxLen) {
    if (!str || typeof str !== "string") return str;
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + "...";
  }

  async function getSongName(songPath) {
    try {
      const metadata = await mm.parseFile(songPath);
      let artist = metadata.common?.artist;
      let title = metadata.common?.title;

      if (artist && title) {
        artist = truncate(artist, 20);
        title = truncate(title, 40);
        return `${title} - ${artist}`;
      }
    } catch (err) {
      logger.debug(`Unable to fetch metadata for ${songPath}: ${err}`);
    }

    return path.basename(songPath, ".mp3").replace(/_/g, " ");
  }

  return {
    formatTime,
    createProgressBar,
    getSongDuration,
    getSongName,
  };
}

module.exports = {
  createMusicTrackInfoTools,
};
