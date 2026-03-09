function createMusicCatalogTools({
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
}) {
  function getMusicBaseDir() {
    const configured = (config.MUSIC_DIR || "").trim();
    if (!configured) return path.join(__dirname, "../../commands/music/music");
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  function listPlaylists() {
    try {
      const musicDir = getMusicBaseDir();
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
      const musicDir = getMusicBaseDir();
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

  function setPlaylist(guildId, playlistName) {
    if (!playlistName) return playlistMap.delete(guildId);
    playlistMap.set(guildId, playlistName);
  }

  function getPlaylist(guildId) {
    return playlistMap.get(guildId) || null;
  }

  function getAutoPlaylists(guildId) {
    const selected = autoPlaylistsMap.get(guildId);
    if (!selected) return [];
    return Array.from(selected);
  }

  function toggleAutoPlaylist(guildId, playlistName) {
    const available = listPlaylists();
    const normalized = (playlistName || "").trim().toLowerCase();
    const matched = available.find((p) => p.toLowerCase() === normalized);
    if (!matched) return { ok: false, exists: false, added: false };

    let selected = autoPlaylistsMap.get(guildId);
    if (!selected) {
      selected = new Set();
      autoPlaylistsMap.set(guildId, selected);
    }

    if (selected.has(matched)) {
      selected.delete(matched);
      if (selected.size === 0) autoPlaylistsMap.delete(guildId);
      return { ok: true, exists: true, added: false, playlist: matched };
    }

    selected.add(matched);
    return { ok: true, exists: true, added: true, playlist: matched };
  }

  function clearAutoPlaylists(guildId) {
    autoPlaylistsMap.delete(guildId);
  }

  function selectAllAutoPlaylists(guildId) {
    const available = listPlaylists();
    if (!available.length) {
      autoPlaylistsMap.delete(guildId);
      return [];
    }

    autoPlaylistsMap.set(guildId, new Set(available));
    return available;
  }

  function getAutoQueueTracks(guildId) {
    const musicDir = getMusicBaseDir();
    let tracks = [];
    const selected = getAutoPlaylists(guildId);

    if (!fs.existsSync(musicDir)) return [];

    if (!selected.length) {
      tracks = tracks.concat(
        fs
          .readdirSync(musicDir)
          .filter((f) => f.toLowerCase().endsWith(".mp3"))
          .map((f) => path.join(musicDir, f)),
      );

      const items = fs.readdirSync(musicDir);
      for (const item of items) {
        const full = path.join(musicDir, item);
        if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
          tracks = tracks.concat(
            fs
              .readdirSync(full)
              .filter((f) => f.toLowerCase().endsWith(".mp3"))
              .map((f) => path.join(full, f)),
          );
        }
      }

      return tracks;
    }

    for (const playlist of selected) {
      tracks = tracks.concat(listPlaylistTracks(playlist));
    }

    return tracks;
  }

  function toTrackKey(songPath) {
    if (!songPath || typeof songPath !== "string") return null;

    try {
      const musicBaseDir = getMusicBaseDir();
      const relative = path.relative(musicBaseDir, songPath);
      const normalized = (relative || songPath).split(path.sep).join("/");
      return normalized.toLowerCase();
    } catch (err) {
      logger.debug(`toTrackKey fallback for ${songPath}: ${err}`);
      return songPath.split(path.sep).join("/").toLowerCase();
    }
  }

  function getRecentTrackKeys(guildId, limit = 15) {
    const history = getHistory(guildId);
    if (!history || history.length === 0) return new Set();

    const recent = history
      .slice(-limit)
      .map((songPath) => toTrackKey(songPath));
    return new Set(recent.filter(Boolean));
  }

  async function recordTrackPlayForSmartShuffle(guildId, songPath) {
    if (!guildId || !songPath) return;
    if (!getAutoMode(guildId) || !getRandomMode(guildId)) return;

    const trackKey = toTrackKey(songPath);
    if (!trackKey) return;

    try {
      await runtimeStore.incrementMusicPlay(guildId, trackKey);
    } catch (err) {
      logger.error(
        `recordTrackPlayForSmartShuffle error for ${guildId}: ${err}`,
      );
    }
  }

  async function smartShuffleTracks(guildId, tracks) {
    if (!Array.isArray(tracks) || tracks.length <= 1) return tracks || [];

    const trackKeys = tracks.map((songPath) => toTrackKey(songPath));
    const uniqueKeys = Array.from(new Set(trackKeys.filter(Boolean)));

    let stats = [];
    if (uniqueKeys.length > 0) {
      try {
        stats = await runtimeStore.findMusicStatsByTrackKeys(
          guildId,
          uniqueKeys,
        );
      } catch (err) {
        logger.error(
          `smartShuffleTracks stats fetch error for ${guildId}: ${err}`,
        );
      }
    }

    const playCountByTrack = new Map();
    for (const stat of stats) {
      playCountByTrack.set(stat.trackKey, stat.playCount || 0);
    }

    let maxCount = 0;
    for (const key of trackKeys) {
      const count = playCountByTrack.get(key) || 0;
      if (count > maxCount) maxCount = count;
    }

    const recentTrackKeys = getRecentTrackKeys(guildId, 15);
    const scored = tracks.map((songPath, index) => {
      const key = trackKeys[index];
      const count = playCountByTrack.get(key) || 0;
      const normalizedCount = maxCount > 0 ? count / maxCount : 0;
      const recencyPenalty = recentTrackKeys.has(key) ? 1 : 0;
      const randomNoise = Math.random() * 0.5;
      const score =
        normalizedCount * 0.85 + recencyPenalty * 1.25 + randomNoise;

      return { songPath, score };
    });

    scored.sort((a, b) => a.score - b.score);
    return scored.map((item) => item.songPath);
  }

  return {
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
  };
}

module.exports = {
  createMusicCatalogTools,
};
