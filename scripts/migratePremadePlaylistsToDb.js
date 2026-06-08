#!/usr/bin/env node
/**
 * Migration script to populate premade_playlists from music directory
 * Run once to map existing folder-based playlists to MySQL
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

const config = {
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  MUSIC_DIR: process.env.MUSIC_DIR,
};

const MUSIC_BASE_DIR = (() => {
  const configured = (config.MUSIC_DIR || "").trim();
  if (!configured) {
    return path.join(__dirname, "../src/commands/music/music");
  }
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
})();

let pool = null;

async function initDb() {
  if (!config.DB_HOST || !config.DB_USER || !config.DB_NAME) {
    throw new Error(
      "MySQL not configured. Set DB_HOST, DB_USER, DB_NAME env vars.",
    );
  }

  pool = mysql.createPool({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  console.log("✓ MySQL connected");
}

function toTrackKey(songPath) {
  const relative = path.relative(MUSIC_BASE_DIR, songPath);
  return (relative || songPath).split(path.sep).join("/").toLowerCase();
}

function listPlaylistFolders() {
  if (!fs.existsSync(MUSIC_BASE_DIR)) {
    console.warn(`Music directory not found: ${MUSIC_BASE_DIR}`);
    return [];
  }

  return fs.readdirSync(MUSIC_BASE_DIR).filter((f) => {
    const fullPath = path.join(MUSIC_BASE_DIR, f);
    return fs.statSync(fullPath).isDirectory();
  });
}

function listTracksInPlaylist(playlistName) {
  const playlistDir = path.join(MUSIC_BASE_DIR, playlistName);
  if (!fs.existsSync(playlistDir)) return [];

  return fs
    .readdirSync(playlistDir)
    .filter((f) => f.toLowerCase().endsWith(".mp3"))
    .map((f) => path.join(playlistDir, f));
}

async function migratePlaylist(playlistName, trackPaths) {
  const connection = await pool.getConnection();

  try {
    // Check if exists
    const [existing] = await connection.query(
      "SELECT id FROM premade_playlists WHERE name = ? LIMIT 1",
      [playlistName],
    );

    let playlistId;
    if (existing.length > 0) {
      playlistId = existing[0].id;
      console.log(
        `  ℹ Playlist "${playlistName}" already exists (id=${playlistId}). Clearing tracks...`,
      );

      // Clear existing tracks
      await connection.query(
        "DELETE FROM premade_playlist_tracks WHERE playlist_id = ?",
        [playlistId],
      );
    } else {
      // Insert new playlist
      const [result] = await connection.query(
        "INSERT INTO premade_playlists (name, description) VALUES (?, ?)",
        [playlistName, `Auto-migrated from folder: ${playlistName}`],
      );
      playlistId = result.insertId;
      console.log(`  ✓ Created playlist "${playlistName}" (id=${playlistId})`);
    }

    // Insert tracks in order
    let insertedCount = 0;
    for (let index = 0; index < trackPaths.length; index++) {
      const trackPath = trackPaths[index];
      const trackKey = toTrackKey(trackPath);

      // Check if track exists in music_library_tracks
      const [trackExists] = await connection.query(
        "SELECT track_key FROM music_library_tracks WHERE track_key = ? LIMIT 1",
        [trackKey],
      );

      if (trackExists.length === 0) {
        console.warn(`    ⚠ Track not in library: ${trackKey} (skipping)`);
        continue;
      }

      // Insert into playlist_tracks
      await connection.query(
        "INSERT INTO premade_playlist_tracks (playlist_id, track_key, position) VALUES (?, ?, ?)",
        [playlistId, trackKey, index],
      );

      insertedCount++;
    }

    console.log(`  ✓ Added ${insertedCount} tracks to "${playlistName}"`);
    return { playlistName, playlistId, tracksAdded: insertedCount };
  } finally {
    connection.release();
  }
}

async function main() {
  try {
    console.log("🎵 Premade Playlists Migration Script\n");
    console.log(`Music directory: ${MUSIC_BASE_DIR}`);
    console.log(`Database: ${config.DB_HOST}/${config.DB_NAME}\n`);

    await initDb();

    const playlistFolders = listPlaylistFolders();
    if (playlistFolders.length === 0) {
      console.warn("No playlist folders found!");
      process.exit(0);
    }

    console.log(`Found ${playlistFolders.length} playlist folder(s):\n`);

    const results = [];
    for (const playlistName of playlistFolders) {
      const trackPaths = listTracksInPlaylist(playlistName);
      console.log(`📁 ${playlistName} (${trackPaths.length} tracks)`);

      if (trackPaths.length === 0) {
        console.log(`  ⚠ Skipping empty playlist\n`);
        continue;
      }

      const result = await migratePlaylist(playlistName, trackPaths);
      results.push(result);
      console.log();
    }

    console.log("✅ Migration complete!\n");
    console.log("Summary:");
    for (const result of results) {
      console.log(
        `  • ${result.playlistName}: ${result.tracksAdded} tracks (id=${result.playlistId})`,
      );
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

main();
