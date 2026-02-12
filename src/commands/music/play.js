const { SlashCommandBuilder } = require("discord.js");
const path = require("path");
const fs = require("fs");
const logger = require("../../logger");
const {
  addToQueue,
  addToQueueNext,
  saveQueue,
  playNext,
  isPlay,
  sendNotification,
  setPlaylist,
  getPlaylist,
  listPlaylists,
  listPlaylistTracks,
  getSongName,
  addToPriorityQueue,
} = require("../../functions/handlers/handleMusic");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a track or set current playlist")
    .addStringOption((option) =>
      option
        .setName("track")
        .setDescription("Track name (autocomplete)")
        .setRequired(false)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName("playlist")
        .setDescription("Set or choose a playlist (folder)")
        .setRequired(false)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused();
      const focusedName = interaction.options.getFocused(true).name;
      if (focusedName === "track") {
        const guildId = interaction.guild.id;
        const playlist = getPlaylist(guildId);
        let files = [];
        if (playlist) {
          files = listPlaylistTracks(playlist);
        } else {
          // collect tracks from root and all playlists
          const musicDir = path.join(__dirname, "music");
          files = [];
          if (fs.existsSync(musicDir)) {
            // root
            files = files.concat(
              fs
                .readdirSync(musicDir)
                .filter((f) => f.toLowerCase().endsWith(".mp3"))
                .map((f) => path.join(musicDir, f)),
            );
            // playlists
            const items = fs.readdirSync(musicDir);
            for (const item of items) {
              const full = path.join(musicDir, item);
              if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
                files = files.concat(
                  fs
                    .readdirSync(full)
                    .filter((f) => f.toLowerCase().endsWith(".mp3"))
                    .map((f) => path.join(full, f)),
                );
              }
            }
          }
        }
        const choices = files
          .map((f) => path.basename(f).replace(/\.mp3$/i, ""))
          .filter((c) =>
            c.toLowerCase().includes((focused || "").toLowerCase()),
          )
          .slice(0, 25);
        return interaction.respond(
          choices.map((name) => ({ name, value: name })),
        );
      }

      if (focusedName === "playlist") {
        const lists = ["none", ...listPlaylists()];
        const filtered = lists
          .filter((c) =>
            c.toLowerCase().includes((focused || "").toLowerCase()),
          )
          .slice(0, 25);
        return interaction.respond(
          filtered.map((name) => ({ name, value: name })),
        );
      }
    } catch (err) {
      logger.error(`play autocomplete error: ${err}`);
    }
  },

  async execute(interaction) {
    const trackName = interaction.options.getString("track");
    const playlistName = interaction.options.getString("playlist");
    const guildId = interaction.guild.id;

    try {
      // If playlist option provided and no track -> set or clear playlist
      if (playlistName && !trackName) {
        if (playlistName.toLowerCase() === "none") {
          setPlaylist(guildId, null);
          return interaction.reply({
            content: `✅ Playlist selection cleared.`,
            ephemeral: true,
          });
        }
        setPlaylist(guildId, playlistName);
        return interaction.reply({
          content: `✅ Playlist set to **${playlistName}**`,
          ephemeral: true,
        });
      }

      if (!trackName) {
        return interaction.reply({
          content: "❌ Please specify a `track` to play or `playlist` to set.",
          ephemeral: true,
        });
      }

      // Find track in chosen playlist or fallback
      const playlist = getPlaylist(guildId);
      const musicBase = path.join(__dirname, "music");
      let candidate = `${trackName}.mp3`;
      let filePath = null;
      if (playlist) {
        const tryPath = path.join(musicBase, playlist, candidate);
        if (fs.existsSync(tryPath)) filePath = tryPath;
      }
      if (!filePath) {
        const tryPath = path.join(musicBase, candidate);
        if (fs.existsSync(tryPath)) filePath = tryPath;
      }
      if (!filePath) {
        // try searching all playlists
        const lists = listPlaylists();
        for (const p of lists) {
          const tryPath = path.join(musicBase, p, candidate);
          if (fs.existsSync(tryPath)) {
            filePath = tryPath;
            break;
          }
        }
      }

      if (!filePath)
        return interaction.reply({
          content: `❌ Track not found: ${candidate}`,
          ephemeral: true,
        });

      // Use existing queue logic: when something is playing, add to priority queue (play next)
      if (isPlay(guildId)) {
        const songName = await getSongName(filePath);
        await addToPriorityQueue(guildId, filePath);
        return interaction.reply({
          content: `⏭️ Added to priority queue: ⭐ **${songName}**`,
          // make this visible to all
        });
      } else {
        await saveQueue(guildId, [filePath]);
        await playNext(guildId, interaction);
        const songName = await getSongName(filePath);
        return interaction.reply({
          content: `🎶 Now playing: **${songName}**`,
        });
      }
    } catch (err) {
      logger.error(`Error in /play: ${err}`);
      return interaction.reply({
        content: `❌ Error: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};
