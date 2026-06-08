/**
 * Premade Playlists Handler
 * Manages global premade playlists stored in MySQL
 */

const pool = require("../events/mysql/connect");
const logger = require("../../logger");

async function listPremadePlaylists() {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, description, created_at FROM premade_playlists ORDER BY name ASC",
    );
    return rows || [];
  } catch (err) {
    logger.error(`listPremadePlaylists error: ${err}`);
    return [];
  }
}

async function getPremadePlaylist(playlistId) {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, description, created_at FROM premade_playlists WHERE id = ? LIMIT 1",
      [playlistId],
    );
    return rows?.[0] || null;
  } catch (err) {
    logger.error(`getPremadePlaylist(${playlistId}) error: ${err}`);
    return null;
  }
}

async function getPremadePlaylistByName(playlistName) {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, description, created_at FROM premade_playlists WHERE name = ? LIMIT 1",
      [playlistName],
    );
    return rows?.[0] || null;
  } catch (err) {
    logger.error(`getPremadePlaylistByName(${playlistName}) error: ${err}`);
    return null;
  }
}

async function getPremadePlaylistTracks(playlistId) {
  try {
    const [rows] = await pool.query(
      "SELECT l.track_path, l.track_key, l.title, l.artist, l.duration_seconds, l.duration_label FROM premade_playlist_tracks pt INNER JOIN music_library_tracks l ON l.track_key = pt.track_key WHERE pt.playlist_id = ? ORDER BY pt.position ASC",
      [playlistId],
    );
    return rows || [];
  } catch (err) {
    logger.error(`getPremadePlaylistTracks(${playlistId}) error: ${err}`);
    return [];
  }
}

async function getPremadePlaylistTrackPaths(playlistId) {
  try {
    const [rows] = await pool.query(
      "SELECT l.track_path FROM premade_playlist_tracks pt INNER JOIN music_library_tracks l ON l.track_key = pt.track_key WHERE pt.playlist_id = ? ORDER BY pt.position ASC",
      [playlistId],
    );
    return (rows || [])
      .map((row) => row?.track_path)
      .filter((path) => typeof path === "string" && path.length);
  } catch (err) {
    logger.error(`getPremadePlaylistTrackPaths(${playlistId}) error: ${err}`);
    return [];
  }
}

async function createPremadePlaylist(name, description = null) {
  try {
    const [result] = await pool.query(
      "INSERT INTO premade_playlists (name, description) VALUES (?, ?)",
      [name, description],
    );
    return { id: result.insertId, name, description, ok: true };
  } catch (err) {
    if (String(err?.code || "").includes("ER_DUP_ENTRY")) {
      logger.warn(`Premade playlist already exists: ${name}`);
      return { ok: false, exists: true, error: "Playlist already exists" };
    }
    logger.error(`createPremadePlaylist error: ${err}`);
    return { ok: false, error: err.message };
  }
}

async function deletePremadePlaylist(playlistId) {
  try {
    const [result] = await pool.query(
      "DELETE FROM premade_playlists WHERE id = ?",
      [playlistId],
    );
    return { ok: result.affectedRows > 0 };
  } catch (err) {
    logger.error(`deletePremadePlaylist(${playlistId}) error: ${err}`);
    return { ok: false, error: err.message };
  }
}

async function renamePremadePlaylist(playlistId, newName) {
  try {
    const [result] = await pool.query(
      "UPDATE premade_playlists SET name = ? WHERE id = ?",
      [newName, playlistId],
    );
    return { ok: result.affectedRows > 0 };
  } catch (err) {
    if (String(err?.code || "").includes("ER_DUP_ENTRY")) {
      return { ok: false, error: "Playlist name already exists" };
    }
    logger.error(`renamePremadePlaylist error: ${err}`);
    return { ok: false, error: err.message };
  }
}

async function addTrackToPremadePlaylist(
  playlistId,
  trackKey,
  position = null,
) {
  try {
    if (position === null) {
      // Find max position
      const [maxRows] = await pool.query(
        "SELECT COALESCE(MAX(position), -1) as max_pos FROM premade_playlist_tracks WHERE playlist_id = ?",
        [playlistId],
      );
      position = (maxRows?.[0]?.max_pos || -1) + 1;
    }

    const [result] = await pool.query(
      "INSERT INTO premade_playlist_tracks (playlist_id, track_key, position) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE position = ?",
      [playlistId, trackKey, position, position],
    );
    return { ok: true };
  } catch (err) {
    logger.error(`addTrackToPremadePlaylist error: ${err}`);
    return { ok: false, error: err.message };
  }
}

async function removeTrackFromPremadePlaylist(playlistId, trackKey) {
  try {
    const [result] = await pool.query(
      "DELETE FROM premade_playlist_tracks WHERE playlist_id = ? AND track_key = ?",
      [playlistId, trackKey],
    );
    return { ok: result.affectedRows > 0 };
  } catch (err) {
    logger.error(`removeTrackFromPremadePlaylist error: ${err}`);
    return { ok: false, error: err.message };
  }
}

async function reorderPremadePlaylistTracks(playlistId, trackOrders) {
  // trackOrders: [{ track_key, position }, ...]
  try {
    for (const order of trackOrders) {
      await pool.query(
        "UPDATE premade_playlist_tracks SET position = ? WHERE playlist_id = ? AND track_key = ?",
        [order.position, playlistId, order.track_key],
      );
    }
    return { ok: true };
  } catch (err) {
    logger.error(`reorderPremadePlaylistTracks error: ${err}`);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  listPremadePlaylists,
  getPremadePlaylist,
  getPremadePlaylistByName,
  getPremadePlaylistTracks,
  getPremadePlaylistTrackPaths,
  createPremadePlaylist,
  deletePremadePlaylist,
  renamePremadePlaylist,
  addTrackToPremadePlaylist,
  removeTrackFromPremadePlaylist,
  reorderPremadePlaylistTracks,
};
