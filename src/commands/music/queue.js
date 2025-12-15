const { SlashCommandBuilder } = require("discord.js");
const {
  getQueue,
  playNext,
  shuffleQueue,
  saveQueue,
  isPlay,
  playersStop,
  clearQueue,
} = require("../../functions/handlers/handleMusic");
const {
  clearAudioFolders,
} = require("../../functions/handlers/handleClearAudio");
const path = require("path");
const fs = require("fs");
const logger = require("../../logger");
let players = require("../../functions/handlers/handleMusic").players;
let connections = require("../../functions/handlers/handleMusic").connections;
let isPlaying = require("../../functions/handlers/handleMusic").isPlaying;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Commands related to queue.")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Choose action to perform on the queue")
        .setRequired(true)
        .addChoices(
          { name: "play", value: "play" },
          { name: "queue", value: "queue" },
          { name: "clear", value: "clear" },
          { name: "resume", value: "resume" },
          { name: "skip", value: "skip" },
          { name: "shuffle", value: "shuffle" },
          { name: "skipto", value: "skipto" },
          { name: "stop", value: "stop" },
          { name: "unplay", value: "unplay" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("track")
        .setDescription("Track name (autocomplete)")
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("index")
        .setDescription("Song number for 'skipto' or 'unplay' action")
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
      logger.error(`queue autocomplete error: ${err}`);
    }
  },

  async execute(interaction) {
    const action = interaction.options.getString("action");
    const guildId = interaction.guild.id;
    const queue = await getQueue(guildId);
    const voiceChannel = interaction.member.voice.channel;

    if (action === "queue") {
      if (!queue || queue.length === 0) {
        return interaction.reply({
          content: "🎵 Queue is now empty.",
        });
      }

      const displayedQueue = queue
        .slice(0, 25)
        .map((file, index) => {
          const songName = path
            .basename(file)
            .replace(/\.mp3$/, "")
            .replace(/_/g, " ");
          return `\`${index + 1}.\` **${songName}**`;
        })
        .join("\n");

      const queueMessage =
        queue.length > 25
          ? `📁 **Current queue:**\n${displayedQueue}\n...and **${
              queue.length - 25
            }** more songs!`
          : `📁 **Current queue:**\n${displayedQueue}`;

      return interaction.reply({
        content: queueMessage,
      });
    }

    if (action === "play") {
      try {
        const trackName = interaction.options.getString("track");
        logger.debug(
          `Queue play requested: guild=${guildId}, track=${trackName}`
        );
        if (!trackName)
          return interaction.reply({
            content: "❌ No track specified",
            ephemeral: true,
          });
        const musicDir = path.join(__dirname, "music");
        if (!fs.existsSync(musicDir))
          return interaction.reply({
            content: "❌ No music folder found.",
            ephemeral: true,
          });
        const candidate = trackName.endsWith(".mp3")
          ? trackName
          : `${trackName}.mp3`;
        const filePath = path.join(musicDir, candidate);
        if (!fs.existsSync(filePath))
          return interaction.reply({
            content: `❌ Track not found: ${candidate}`,
            ephemeral: true,
          });

        if (isPlay(guildId)) {
          await addToQueue(guildId, filePath);
          const songName = path.basename(filePath, ".mp3").replace(/_/g, " ");
          // send notification to configured channel
          const notifyMsg = `▶️ Added to queue: **${songName}**`;
          try {
            await require("../../functions/handlers/handleMusic").sendNotification(
              guildId,
              interaction,
              notifyMsg
            );
          } catch (e) {
            logger.error(`Failed sending add-to-queue notification: ${e}`);
          }
          logger.info(`Added to queue: ${songName} (guild=${guildId})`);
          return interaction.reply({
            content: `▶️ Added to queue: **${songName}**`,
            ephemeral: true,
          });
        } else {
          await saveQueue(guildId, [filePath]);
          await playNext(guildId, interaction);
          logger.info(
            `Now playing: ${path
              .basename(filePath, ".mp3")
              .replace(/_/g, " ")} (guild=${guildId})`
          );
          return interaction.reply({
            content: `🎶 Now playing: **${path
              .basename(filePath, ".mp3")
              .replace(/_/g, " ")}**`,
          });
        }
      } catch (err) {
        logger.error(`Error in /queue play: ${err}`);
        try {
          if (interaction.deferred || interaction.replied) {
            return interaction.editReply({
              content: `❌ Something went wrong: ${err.message}`,
              ephemeral: true,
            });
          } else {
            return interaction.reply({
              content: `❌ Something went wrong: ${err.message}`,
              ephemeral: true,
            });
          }
        } catch (e) {
          logger.error(`Failed to notify user about /queue play error: ${e}`);
        }
      }
    }

    if (action === "clear") {
      try {
        await clearQueue(guildId);
        const clearLoopSong =
          require("../../functions/handlers/handleMusic").clearLoopSong;
        clearLoopSong(guildId);
        if (connections[guildId]) {
          playersStop(guildId);
          isPlaying[guildId] = false;
          players[guildId].stop();
          connections[guildId]?.destroy();
          delete connections[guildId];
        }

        await interaction.reply({
          content: "🗑️ Queue cleared!",
        });

        await clearAudioFolders(guildId);

        await interaction.followUp({
          content: "🗑️ All audio files cleared!",
        });
      } catch (error) {
        logger.error(`Error clearing queue: ${error}`);
        await interaction.reply({
          content:
            "❌ Something went wrong while deleting queue and audio files.",
          ephemeral: true,
        });
      }
    }

    if (action === "shuffle") {
      if (!queue || queue.length < 2) {
        return interaction.reply({
          content: "🚫 Can't shuffle queue because it's now empty!",
          ephemeral: true,
        });
      }

      await shuffleQueue(guildId);

      const queueNew = await getQueue(guildId);
      const displayedQueue = queueNew
        .slice(0, 25)
        .map((file, index) => {
          const songName = path
            .basename(file)
            .replace(/\.mp3$/, "")
            .replace(/_/g, " ");
          return `\`${index + 1}.\` **${songName}**`;
        })
        .join("\n");

      const queueMessage =
        queueNew.length > 25
          ? `📁 **Current queue:**\n${displayedQueue}\n...and **${
              queueNew.length - 25
            }** more songs!`
          : `📁 **Current queue:**\n${displayedQueue}`;

      return interaction.reply({
        content: `🔀 Queue shuffled!\n\n${queueMessage}`,
      });
    }

    if (action === "skip") {
      if (!queue || queue.length === 0) {
        return interaction.reply({
          content: "🚫 Queue is empty!",
          ephemeral: true,
        });
      }

      isPlay(guildId);

      if (queue.length === 0) {
        return interaction.reply({
          content: `⏭️ Skipped **${skippedSong}**, but queue is now empty!`,
        });
      }

      const skippedSongName = path
        .basename(queue[0], ".mp3")
        .replace(/_/g, " ");
      const currentSongName = path
        .basename(queue[1], ".mp3")
        .replace(/_/g, " ");
      const skipMsg = `⏭️ Skipped: \n**${skippedSongName}** \nNow playing: \n**${currentSongName}**`;
      try {
        await require("../../functions/handlers/handleMusic").sendNotification(
          guildId,
          interaction,
          skipMsg
        );
      } catch (e) {
        logger.error(`Failed sending skip notification: ${e}`);
      }
      await interaction.reply({
        content: "⏭️ Skipped to next track.",
        ephemeral: true,
      });

      playersStop(guildId);
      await playNext(guildId, interaction);
    }

    if (action === "skipto") {
      if (
        !interaction.options ||
        typeof interaction.options.getInteger !== "function"
      ) {
        console.error("Invalid interaction options:", interaction.options);
        return interaction.reply({
          content: "?? Invalid interaction options!",
          ephemeral: true,
        });
      }
      const amountRaw = interaction.options.getInteger("index");
      const amount = amountRaw - 2;
      if (!queue || queue.length === 0) {
        return interaction.reply({
          content: "🚫 Queue is empty!",
          ephemeral: true,
        });
      }

      if (amount <= 0 || amount >= queue.length) {
        return interaction.reply({
          content: "🚫 Wrong song number!",
          ephemeral: true,
        });
      }

      isPlay(guildId);
      queue.splice(0, amount);
      await saveQueue(guildId, queue);

      interaction.reply({
        content: `⏭️ Skipped to songs: **${amount}**.`,
      });
      playersStop(guildId);
      await playNext(guildId, interaction);
    }

    if (action === "stop") {
      try {
        if (!voiceChannel) {
          return interaction.reply({
            content: "❌ You have to be on a voice channel",
            ephemeral: true,
          });
        }

        if (connections[guildId]) {
          playersStop(guildId);
          isPlaying[guildId] = false;
          players[guildId].stop();
          connections[guildId].destroy();
          delete connections[guildId];
          const clearLoopSong =
            require("../../functions/handlers/handleMusic").clearLoopSong;
          clearLoopSong(guildId);
        }

        interaction.reply({
          content: "⏹️ Music stopped and disconnected from channel",
          ephemeral: false,
        });
      } catch (error) {
        logger.error(`Error stopping players: ${error}`);
        await interaction.reply({
          content: "❌ Something went wrong while stopping bot.",
          ephemeral: true,
        });
      }
    }

    if (action === "unplay") {
      if (
        !interaction.options ||
        typeof interaction.options.getInteger !== "function"
      ) {
        console.error("Invalid interaction options:", interaction.options);
        return interaction.reply({
          content: "?? Invalid interaction options!",
          ephemeral: true,
        });
      }
      const amountRaw = interaction.options.getInteger("index");
      const amount = amountRaw - 2;
      if (!queue || queue.length === 0) {
        return interaction.reply({
          content: "🚫 Queue is empty!",
          ephemeral: true,
        });
      }

      if (amount < 0 || amount >= queue.length) {
        return interaction.reply({
          content: "🚫 Wrong song number!",
          ephemeral: true,
        });
      }

      if (amount === 0) {
        return interaction.reply({
          content: "🚫 You can't delete currently played song!",
          ephemeral: true,
        });
      }

      const removedSongPath = queue.splice(amount, 1)[0];
      await saveQueue(guildId, queue);

      const removedSongName = path
        .basename(removedSongPath)
        .replace(/\.mp3$/, "")
        .replace(/_/g, " ");

      interaction.reply({
        content: `🗑️ Deleted **${removedSongName}** from queue`,
      });
    }

    if (action === "resume") {
      await interaction.deferReply();

      if (!queue || queue.length === 0) {
        return interaction.editReply({
          content: "🚫 Queue is empty. Use `/play` to add more songs!",
          ephemeral: true,
        });
      }

      interaction.editReply({
        content: "▶️ Resuming playback...",
      });

      await playNext(guildId, interaction);
    }
  },
};
