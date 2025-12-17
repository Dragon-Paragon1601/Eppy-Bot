const { SlashCommandBuilder } = require("discord.js");
const path = require("path");
const fs = require("fs");
const logger = require("../../logger");
const {
  addToQueue,
  saveQueue,
  playNext,
  isPlay,
} = require("../../functions/handlers/handleMusic");
const musicHandler = require("../../functions/handlers/handleMusic");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("auto_play_settings")
    .setDescription("Configure queue modes and notification channel")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("Mode to use")
        .setRequired(true)
        .addChoices(
          { name: "auto", value: "auto" },
          { name: "random", value: "random" },
          { name: "loop", value: "loop" },
          { name: "status", value: "status" }
        )
    )

    .addBooleanOption((option) =>
      option
        .setName("value")
        .setDescription("Boolean value for set operations (on/off)")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("random_type")
        .setDescription("Random mode type")
        .setRequired(false)
        .addChoices(
          { name: "from_playlist", value: "from_playlist" },
          { name: "playlist", value: "playlist" },
          { name: "all", value: "all" }
        )
    ),
  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused();
      const musicDir = path.join(__dirname, "music");
      if (!fs.existsSync(musicDir)) return interaction.respond([]);
      const files = fs
        .readdirSync(musicDir)
        .filter((f) => f.toLowerCase().endsWith(".mp3"));
      const choices = files.map((f) => f.replace(/\.mp3$/i, ""));
      const filtered = choices
        .filter((c) => c.toLowerCase().includes((focused || "").toLowerCase()))
        .slice(0, 25);
      await interaction.respond(
        filtered.map((name) => ({ name, value: name }))
      );
    } catch (err) {
      logger.error(`play autocomplete error: ${err}`);
    }
  },

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "❌ You need to be in a voice channel to use this command!",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const mode = interaction.options.getString("mode");
    const trackName = interaction.options.getString("track");
    const value = interaction.options.getBoolean("value");

    const musicDir = path.join(__dirname, "music");
    if (!fs.existsSync(musicDir)) {
      return interaction.editReply({
        content: "❌ No `music` folder found next to this command.",
        ephemeral: true,
      });
    }

    const allFiles = fs
      .readdirSync(musicDir)
      .filter((f) => f.toLowerCase().endsWith(".mp3"));
    if (allFiles.length === 0)
      return interaction.editReply({
        content: "❌ No tracks available in the music folder.",
        ephemeral: true,
      });

    try {
      // STATUS: show current mode statuses
      if (mode === "status") {
        const auto = musicHandler.getAutoMode(guildId) ? "ON" : "OFF";
        const randomType = musicHandler.getRandomType(guildId) || "off";
        const loop = musicHandler.getLoopQueueMode(guildId) ? "ON" : "OFF";
        return interaction.editReply({
          content: `Status — Auto: **${auto}**, Random: **${randomType}**, Loop: **${loop}**`,
        });
      }

      // AUTO: set or query auto mode
      if (mode === "auto") {
        if (value === null) {
          const cur = musicHandler.getAutoMode(guildId) ? "ON" : "OFF";
          return interaction.editReply({ content: `Auto is **${cur}**` });
        }
        musicHandler.setAutoMode(guildId, value);
        if (value) {
          // Build tracks based on selected playlist and random type
          const playlist = musicHandler.getPlaylist(guildId);
          let tracks = [];
          if (playlist) {
            tracks = musicHandler.listPlaylistTracks(playlist);
          } else {
            // tracks from root music dir
            tracks = allFiles.map((f) => path.join(musicDir, f));
          }

          const randomType = musicHandler.getRandomType(guildId);
          if (randomType && randomType !== "off") {
            if (randomType === "from_playlist") {
              // shuffle tracks from current playlist
              for (let i = tracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
              }
              tracks = tracks.slice(0, 25);
            } else if (randomType === "playlist") {
              // pick random playlist and take up to 25 tracks
              const lists = musicHandler.listPlaylists();
              if (lists.length > 0) {
                const pick = lists[Math.floor(Math.random() * lists.length)];
                tracks = musicHandler.listPlaylistTracks(pick).slice(0, 25);
              }
            } else if (randomType === "all") {
              // pick 25 random tracks from all available
              let all = [];
              const lists = musicHandler.listPlaylists();
              if (lists.length > 0) {
                for (const p of lists) {
                  all = all.concat(musicHandler.listPlaylistTracks(p));
                }
              } else {
                all = allFiles.map((f) => path.join(musicDir, f));
              }
              // shuffle and slice 25
              for (let i = all.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [all[i], all[j]] = [all[j], all[i]];
              }
              tracks = all.slice(0, 25);
            }
          } else {
            // not random: cap to 25 if playlist selected
            if (playlist) tracks = tracks.slice(0, 25);
          }

          await saveQueue(guildId, tracks);
          if (musicHandler.getLoopQueueMode(guildId))
            musicHandler.setLoopSource(guildId, tracks);
          if (!isPlay(guildId)) await playNext(guildId, interaction);
          return interaction.editReply({
            content: `Auto playback **started**. ${tracks.length} tracks queued.`,
          });
        } else {
          return interaction.editReply({
            content: `Auto playback **stopped**.`,
          });
        }
      }

      // RANDOM: toggle/query random mode
      if (mode === "random") {
        const randomType = interaction.options.getString("random_type");
        if (randomType) {
          musicHandler.setRandomType(guildId, randomType);
          return interaction.editReply({
            content: `Random type set to **${randomType}**`,
          });
        }
        if (value === null) {
          const cur = musicHandler.getRandomType(guildId) || "off";
          return interaction.editReply({ content: `Random is **${cur}**` });
        }
        // boolean toggle: true -> default to from_playlist, false -> off
        musicHandler.setRandomType(guildId, value ? "from_playlist" : "off");
        return interaction.editReply({
          content: `Random mode set to **${value ? "from_playlist" : "off"}**`,
        });
      }

      // LOOP: toggle/query loop for whole-queue
      if (mode === "loop") {
        if (value === null) {
          const cur = musicHandler.getLoopQueueMode(guildId) ? "ON" : "OFF";
          return interaction.editReply({ content: `Loop is **${cur}**` });
        }
        musicHandler.setLoopQueueMode(guildId, value);
        if (value) {
          const queueNow = await musicHandler.getQueue(guildId);
          if (queueNow && queueNow.length > 0) {
            musicHandler.setLoopSource(guildId, queueNow);
          } else {
            musicHandler.setLoopSource(
              guildId,
              allFiles.map((f) => path.join(musicDir, f))
            );
          }
        } else {
          musicHandler.clearLoopSource(guildId);
        }
        return interaction.editReply({
          content: `Loop queue set to **${value ? "ON" : "OFF"}**`,
        });
      }
    } catch (err) {
      logger.error(`play command error: ${err}`);
      return interaction.editReply({
        content: `❌ Error: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};
