const { SlashCommandBuilder } = require("discord.js");
const {
  getQueue,
  playNext,
  shuffleQueue,
  saveQueue,
  isPlay,
  playersStop,
  clearQueue,
  getSongName,
  getPriorityQueue,
  playPrevious,
  pause,
  resume,
} = require("../../functions/handlers/handleMusic");
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
          { name: "auto", value: "auto" },
          { name: "queue", value: "queue" },
          { name: "clear", value: "clear" },
          { name: "next", value: "next" },
          { name: "previous", value: "previous" },
          { name: "shuffle", value: "shuffle" },
          { name: "pause", value: "pause" },
          { name: "resume", value: "resume" },
          { name: "stop", value: "stop" },
          { name: "skipto", value: "skipto" },
          { name: "unplay", value: "unplay" },
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName("index")
        .setDescription("Song number for 'skipto' or 'unplay' action")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("value")
        .setDescription("Used for 'auto' action to enable or disable")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("random")
        .setDescription("When enabling auto, set random selection")
        .setRequired(false),
    ),

  async execute(interaction) {
    const action = interaction.options.getString("action");
    const guildId = interaction.guild.id;
    const queue = await getQueue(guildId);
    const voiceChannel = interaction.member.voice.channel;

    if (action === "queue") {
      const pQueue = await getPriorityQueue(guildId);

      let queueMessage = "";

      // Display priority queue first if it exists
      if (pQueue && pQueue.length > 0) {
        const priorityDisplay = await Promise.all(
          pQueue.slice(0, 25).map(async (file, index) => {
            const songName = await getSongName(file);
            return `\`${index + 1}.\` ⭐ **${songName}**`;
          }),
        ).then((results) => results.join("\n"));

        queueMessage += `⭐ **Priority Queue:**\n${priorityDisplay}`;
        if (pQueue.length > 25) {
          queueMessage += `\n...and **${pQueue.length - 25}** more priority songs!\n\n`;
        } else {
          queueMessage += "\n\n";
        }
      }

      // Display main queue
      if (!queue || queue.length === 0) {
        if (pQueue && pQueue.length > 0) {
          queueMessage += "📁 **Main Queue:** (empty)";
        } else {
          return await interaction.reply({
            content: "🎵 Queue is now empty.",
          });
        }
      } else {
        const displayedQueue = await Promise.all(
          queue.slice(0, 25).map(async (file, index) => {
            const songName = await getSongName(file);
            return `\`${index + 1}.\` **${songName}**`;
          }),
        ).then((results) => results.join("\n"));

        queueMessage += `📁 **Main Queue:**\n${displayedQueue}`;
        if (queue.length > 25) {
          queueMessage += `\n...and **${queue.length - 25}** more songs!`;
        }
      }

      try {
        return await interaction.reply({
          content: queueMessage,
        });
      } catch (err) {
        logger.error(`Failed to send queue reply: ${err}`);
        return null;
      }
    }

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
      } catch (error) {
        logger.error(`Error clearing queue: ${error}`);
        await interaction.reply({
          content: "❌ Something went wrong while clearing queue.",
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
      const displayedQueue = await Promise.all(
        queueNew.slice(0, 25).map(async (file, index) => {
          const songName = await getSongName(file);
          return `\`${index + 1}.\` **${songName}**`;
        }),
      ).then((results) => results.join("\n"));

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

    if (action === "previous") {
      try {
        await playPrevious(guildId, interaction);
      } catch (err) {
        logger.error(`Failed previous: ${err}`);
        return interaction.reply({
          content: `❌ Error: ${err.message}`,
          ephemeral: true,
        });
      }
      return;
    }

    if (action === "pause") {
      try {
        const ok = pause(guildId);
        return interaction.reply({
          content: ok ? "⏸️ Paused." : "❌ Can't pause.",
          ephemeral: true,
        });
      } catch (err) {
        logger.error(`Pause error: ${err}`);
        return interaction.reply({
          content: `❌ Error: ${err.message}`,
          ephemeral: true,
        });
      }
    }

    if (action === "auto") {
      // /queue auto [value:boolean] [random:boolean]
      try {
        const value = interaction.options.getBoolean("value");
        const random = interaction.options.getBoolean("random");
        const musicHandler = require("../../functions/handlers/handleMusic");

        // If user explicitly passes value=false, disable auto
        if (value === false) {
          musicHandler.setAutoMode(guildId, false);
          musicHandler.setRandomMode(guildId, false);
          musicHandler.setLoopQueueMode(guildId, false);
          musicHandler.clearLoopSource(guildId);
          return interaction.reply({
            content: `✅ Auto disabled`,
            ephemeral: true,
          });
        }

        // Otherwise (value === true OR value === null) -> enable auto immediately
        // enable auto: load all available tracks from non-playlist sources, or use full playlist if one is selected
        const playlist = musicHandler.getPlaylist(guildId);
        let tracks = [];
        const musicDir = path.join(__dirname, "music");

        if (playlist) {
          // when a playlist is explicitly selected we do NOT limit the number of tracks
          tracks = musicHandler.listPlaylistTracks(playlist);
        } else {
          // collect from root and playlists
          if (fs.existsSync(musicDir)) {
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
          }
          // do not slice here; we'll optionally shuffle first and then limit to 150 below
        }

        if (!tracks || tracks.length === 0)
          return interaction.reply({
            content: "❌ No tracks found to start auto",
            ephemeral: true,
          });

        // random is a boolean toggle that shuffles the selection if true
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
      } catch (err) {
        logger.error(`Error in /queue auto: ${err}`);
        return interaction.reply({
          content: `❌ Error: ${err.message}`,
          ephemeral: true,
        });
      }
    }
    if (action === "next") {
      const pQueue = await getPriorityQueue(guildId);
      const { getHistory } = require("../../functions/handlers/handleMusic");
      const history = getHistory(guildId);

      // Check if there's something to skip to
      const hasQueue = queue && queue.length > 0;
      const hasPriority = pQueue && pQueue.length > 0;

      if (!hasQueue && !hasPriority) {
        return interaction.reply({
          content: "🚫 Queue is empty!",
          ephemeral: true,
        });
      }

      isPlay(guildId);

      // Get currently playing track from history (last item)
      let skippedSongName = null;
      if (history && history.length > 0) {
        skippedSongName = await getSongName(history[history.length - 1]);
      }

      // Determine what's next (after skipping current)
      // If priority queue has 2+ items, next is priority[1]
      // If priority has 1 item, next is main queue[0]
      // If no priority, next is main queue[1]
      let nextSongName = null;
      if (pQueue && pQueue.length > 1) {
        nextSongName = await getSongName(pQueue[1]);
      } else if (pQueue && pQueue.length === 1 && hasQueue) {
        nextSongName = await getSongName(queue[0]);
      } else if (!pQueue || pQueue.length === 0) {
        if (hasQueue && queue.length > 1) {
          nextSongName = await getSongName(queue[1]);
        }
      }

      let skipMsg = `⏭️ Skipped: **${skippedSongName || "Unknown"}**`;
      if (nextSongName) {
        skipMsg += `\n⏭️ Next: **${nextSongName}**`;
      } else {
        skipMsg += `\n⏭️ Queue is now empty!`;
      }

      await interaction.reply({
        content: skipMsg,
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

      const pQueue = await getPriorityQueue(guildId);
      const indexRaw = interaction.options.getInteger("index");

      // Total queue size = priority queue size + main queue size
      const prioritySize = pQueue ? pQueue.length : 0;
      const totalSize = prioritySize + (queue ? queue.length : 0);

      if (totalSize === 0) {
        return interaction.reply({
          content: "🚫 Queue is empty!",
          ephemeral: true,
        });
      }

      // Validate index (1-based from user perspective)
      if (indexRaw < 1 || indexRaw > totalSize) {
        return interaction.reply({
          content: `🚫 Wrong song number! Queue has ${totalSize} songs.`,
          ephemeral: true,
        });
      }

      isPlay(guildId);

      // Index 1 is current song, so we skip to index (user wants index-1 in 0-based)
      const targetIndex = indexRaw - 1;

      if (targetIndex <= prioritySize) {
        // Skip within priority queue
        const skipAmount = targetIndex - 1; // -1 because we keep current
        if (skipAmount > 0 && pQueue) {
          pQueue.splice(0, skipAmount);
        }
      } else {
        // Skip into main queue - need to account for priority queue
        // Main queue index = targetIndex - prioritySize - 1
        const mainQueueTarget = targetIndex - prioritySize - 1;
        if (queue && mainQueueTarget > 0) {
          queue.splice(0, mainQueueTarget);
          await saveQueue(guildId, queue);
        }
      }

      try {
        await interaction.reply({
          content: `⏭️ Skipped to song ${indexRaw}.`,
          ephemeral: true,
        });
      } catch (err) {
        logger.error(`Failed to reply skipto: ${err}`);
      }
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

        try {
          await interaction.reply({
            content: "⏹️ Music stopped and disconnected from channel",
            ephemeral: false,
          });
        } catch (err) {
          logger.error(`Failed to send stop reply: ${err}`);
        }
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

      const removedSongName = await getSongName(removedSongPath);

      try {
        await interaction.reply({
          content: `🗑️ Deleted **${removedSongName}** from queue`,
        });
      } catch (err) {
        logger.error(`Failed to reply removed song: ${err}`);
      }
    }

    if (action === "resume") {
      // Try unpausing if possible, otherwise start playback
      try {
        const resumed = resume(guildId);
        if (resumed)
          return interaction.reply({
            content: "▶️ Resumed playback.",
            ephemeral: true,
          });
      } catch (e) {
        logger.error(`Resume attempt failed: ${e}`);
      }

      await interaction.deferReply();

      if (!queue || queue.length === 0) {
        try {
          return await interaction.editReply({
            content: "🚫 Queue is empty. Use `/play` to add more songs!",
            ephemeral: true,
          });
        } catch (err) {
          logger.error(`Failed to edit reply (queue empty): ${err}`);
          return null;
        }
      }

      try {
        await interaction.editReply({
          content: "▶️ Resuming playback...",
        });
      } catch (err) {
        logger.error(`Failed to edit reply (resuming): ${err}`);
      }

      await playNext(guildId, interaction);
    }
  },
};
