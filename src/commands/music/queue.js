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
          { name: "auto", value: "auto" },
          { name: "clear", value: "clear" },
          { name: "resume", value: "resume" },
          { name: "skip", value: "skip" },
          { name: "shuffle", value: "shuffle" },
          { name: "skipto", value: "skipto" },
          { name: "stop", value: "stop" },
          { name: "unplay", value: "unplay" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("index")
        .setDescription("Song number for 'skipto' or 'unplay' action")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("value")
        .setDescription("Used for 'auto' action to enable or disable")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("random")
        .setDescription("When enabling auto, set random selection")
        .setRequired(false)
    ),

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

    // play action removed: use `/play` command to add specific tracks

    if (action === "clear") {
      try {
        await clearQueue(guildId);
        const mh = require("../../functions/handlers/handleMusic");
        mh.clearLoopSong(guildId);
        // stop and cleanup timers/listeners to avoid duplicate playNext when resumed
        mh.stopAndCleanup(guildId);
        // disable auto when queue is cleared
        mh.setAutoMode(guildId, false);
        mh.setRandomMode(guildId, false);
        mh.setLoopQueueMode(guildId, false);
        mh.clearLoopSource(guildId);

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

    if (action === "auto") {
      // /queue auto [value:boolean] [random:boolean]
      try {
        const value = interaction.options.getBoolean("value");
        const random = interaction.options.getBoolean("random");
        const musicHandler = require("../../functions/handlers/handleMusic");

        // status
        if (value === null) {
          const cur = musicHandler.getAutoMode(guildId) ? "ON" : "OFF";
          const rnd = musicHandler.getRandomMode(guildId) ? "ON" : "OFF";
          const sel = musicHandler.getPlaylist(guildId) || "(none)";
          return interaction.reply({
            content: `Auto: **${cur}** | Random: **${rnd}** | Playlist: **${sel}**`,
            ephemeral: true,
          });
        }

        if (value) {
          // enable auto: build up to 25 tracks from selected playlist or all playlists
          const playlist = musicHandler.getPlaylist(guildId);
          let tracks = [];
          const musicDir = path.join(__dirname, "music");

          if (playlist) {
            tracks = musicHandler.listPlaylistTracks(playlist).slice(0, 25);
          } else {
            // collect from root and playlists
            if (fs.existsSync(musicDir)) {
              tracks = tracks.concat(
                fs
                  .readdirSync(musicDir)
                  .filter((f) => f.toLowerCase().endsWith(".mp3"))
                  .map((f) => path.join(musicDir, f))
              );
              const items = fs.readdirSync(musicDir);
              for (const item of items) {
                const full = path.join(musicDir, item);
                if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
                  tracks = tracks.concat(
                    fs
                      .readdirSync(full)
                      .filter((f) => f.toLowerCase().endsWith(".mp3"))
                      .map((f) => path.join(full, f))
                  );
                }
              }
            }
            // take up to 25
            tracks = tracks.slice(0, 25);
          }

          if (!tracks || tracks.length === 0)
            return interaction.reply({
              content: "❌ No tracks found to start auto",
              ephemeral: true,
            });

          // random is a boolean toggle that shuffles the selection
          if (random) {
            for (let i = tracks.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
            }
            musicHandler.setRandomMode(guildId, true);
          } else {
            musicHandler.setRandomMode(guildId, false);
          }

          await saveQueue(guildId, tracks);
          // Auto implies looping the chosen source
          musicHandler.setLoopSource(guildId, tracks);
          musicHandler.setLoopQueueMode(guildId, true);
          musicHandler.setAutoMode(guildId, true);

          if (!isPlay(guildId)) await playNext(guildId, interaction);

          return interaction.reply({
            content: `✅ Auto enabled (${tracks.length} tracks)`,
            ephemeral: true,
          });
        } else {
          // disable auto
          musicHandler.setAutoMode(guildId, false);
          musicHandler.setRandomMode(guildId, false);
          musicHandler.setLoopQueueMode(guildId, false);
          musicHandler.clearLoopSource(guildId);
          return interaction.reply({
            content: `✅ Auto disabled`,
            ephemeral: true,
          });
        }
      } catch (err) {
        logger.error(`Error in /queue auto: ${err}`);
        return interaction.reply({
          content: `❌ Error: ${err.message}`,
          ephemeral: true,
        });
      }
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
          const mh = require("../../functions/handlers/handleMusic");
          mh.stopAndCleanup(guildId);
          mh.clearLoopSong(guildId);
          // disable auto when stopping
          mh.setAutoMode(guildId, false);
          mh.setRandomMode(guildId, false);
          mh.setLoopQueueMode(guildId, false);
          mh.clearLoopSource(guildId);
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
