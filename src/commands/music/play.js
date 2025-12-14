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
    .setName("play")
    .setDescription("Play command with modes: track or auto")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("Mode to use")
        .setRequired(true)
        .addChoices(
          { name: "track", value: "track" },
          { name: "auto", value: "auto" },
          { name: "random", value: "random" },
          { name: "loop", value: "loop" },
          { name: "status", value: "status" }
        )
    )

    .addStringOption((option) =>
      option
        .setName("track")
        .setDescription("Track name (autocomplete)")
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("value")
        .setDescription("Boolean value for set operations (on/off)")
        .setRequired(false)
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
        const random = musicHandler.getRandomMode(guildId) ? "ON" : "OFF";
        const loop = musicHandler.getLoopQueueMode(guildId) ? "ON" : "OFF";
        return interaction.editReply({
          content: `Status — Auto: **${auto}**, Random: **${random}**, Loop: **${loop}**`,
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
          let tracks = allFiles.map((f) => path.join(musicDir, f));
          if (musicHandler.getRandomMode(guildId)) {
            for (let i = tracks.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
            }
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
        if (value === null) {
          const cur = musicHandler.getRandomMode(guildId) ? "ON" : "OFF";
          return interaction.editReply({ content: `Random is **${cur}**` });
        }
        musicHandler.setRandomMode(guildId, value);
        return interaction.editReply({
          content: `Random mode set to **${value ? "ON" : "OFF"}**`,
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

      // TRACK: play or add a single track
      if (mode === "track") {
        if (!trackName)
          return interaction.editReply({
            content: "❌ No track specified",
            ephemeral: true,
          });
        const candidate = trackName.endsWith(".mp3")
          ? trackName
          : `${trackName}.mp3`;
        const filePath = path.join(musicDir, candidate);
        if (!fs.existsSync(filePath))
          return interaction.editReply({
            content: `❌ Track not found in music/: ${candidate}`,
            ephemeral: true,
          });

        if (isPlay(guildId)) {
          await addToQueue(guildId, filePath);
          const songName = path.basename(filePath, ".mp3").replace(/_/g, " ");
          return interaction.editReply({
            content: `▶️ Added to queue: **${songName}**`,
          });
        } else {
          await saveQueue(guildId, [filePath]);
          await playNext(guildId, interaction);
          const songName = path.basename(filePath, ".mp3").replace(/_/g, " ");
          return interaction.editReply({
            content: `🎶 Now playing: **${songName}**`,
          });
        }
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
