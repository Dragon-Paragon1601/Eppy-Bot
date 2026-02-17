const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
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
  getPreviousPriorityQueue,
  playPrevious,
  pause,
  resume,
} = require("../../functions/handlers/handleMusic");
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
        ),
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
      const mainQueue = queue || [];

      if ((!pQueue || pQueue.length === 0) && mainQueue.length === 0) {
        return await interaction.reply({
          content: "🎵 Queue is now empty.",
        });
      }

      const PAGE_SIZE = 10;
      const totalPages = Math.max(1, Math.ceil(mainQueue.length / PAGE_SIZE));

      const priorityNames = pQueue
        ? await Promise.all(pQueue.map((file) => getSongName(file)))
        : [];
      const mainNames = await Promise.all(
        mainQueue.map((file) => getSongName(file)),
      );

      const createEmbed = (page) => {
        const safePage = Math.max(0, Math.min(page, totalPages - 1));
        const start = safePage * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, mainNames.length);
        const currentMainSlice = mainNames.slice(start, end);
        const previousCount = start;
        const remainingCount = Math.max(mainNames.length - end, 0);

        const lines = [];
        if (safePage > 0) {
          lines.push(`⬆️ Na poprzednich stronach: **${previousCount}**`);
          lines.push("");
        }

        if (safePage === 0 && priorityNames.length > 0) {
          lines.push("⭐ **Priority Queue:**");

          for (let i = 0; i < priorityNames.length; i++) {
            lines.push(`\`${i + 1}.\` ⭐ **${priorityNames[i]}**`);
          }
          lines.push("");
        }

        lines.push("📁 **Main Queue:**");
        if (currentMainSlice.length === 0) {
          lines.push("*(empty)*");
        } else {
          for (let i = 0; i < currentMainSlice.length; i++) {
            const position = start + i + 1;
            lines.push(`\`${position}.\` **${currentMainSlice[i]}**`);
          }
        }

        lines.push("");
        lines.push(`⬇️ Do końca kolejki: **${remainingCount}**`);

        return new EmbedBuilder()
          .setTitle("🎵 Queue")
          .setDescription(lines.join("\n"))
          .setColor(0x1db954)
          .setFooter({ text: `Strona ${safePage + 1}/${totalPages}` });
      };

      const createButtons = (page, disabled = false) =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("queue_prev")
            .setLabel("◀️ Prev")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || page <= 0),
          new ButtonBuilder()
            .setCustomId("queue_next")
            .setLabel("Next ▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled || page >= totalPages - 1),
        );

      let page = 0;
      const reply = await interaction.reply({
        embeds: [createEmbed(page)],
        components: [createButtons(page)],
        fetchReply: true,
      });

      if (totalPages <= 1) {
        return;
      }

      const authorId = interaction.user.id;
      const collector = reply.createMessageComponentCollector({ time: 120000 });

      collector.on("collect", async (i) => {
        try {
          if (i.user.id !== authorId) {
            await i.reply({
              content: "Only the command user can control this queue message.",
              ephemeral: true,
            });
            return;
          }

          if (!i.isButton()) return;

          if (i.customId === "queue_next" && page < totalPages - 1) {
            page += 1;
          } else if (i.customId === "queue_prev" && page > 0) {
            page -= 1;
          }

          await i.update({
            embeds: [createEmbed(page)],
            components: [createButtons(page)],
          });
        } catch (err) {
          logger.error(`Queue collector error: ${err}`);
        }
      });

      collector.on("end", async () => {
        try {
          await reply.edit({
            components: [createButtons(page, true)],
          });
        } catch (err) {
          logger.error(`Failed to disable queue buttons: ${err}`);
        }
      });

      return;
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
        // compute name of the track that will be pulled from the previous queue
        const {
          getPreviousQueue,
        } = require("../../functions/handlers/handleMusic");
        const prevQueue = getPreviousQueue(guildId);
        const prevPath =
          prevQueue && prevQueue.length > 0
            ? prevQueue[prevQueue.length - 1]
            : null;
        let prevName = null;
        if (prevPath) prevName = await getSongName(prevPath);

        if (!prevPath) {
          await playPrevious(guildId, interaction);
          return;
        }

        // perform the actual previous logic (this will pop the item and enqueue it)
        await playPrevious(guildId, interaction);

        await interaction.reply({
          content: `⏮️ Queued previous track: **${prevName || "Unknown"}**`,
        });
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
        // Source is now controlled by /playlist command:
        // - no selected playlists => everything
        // - selected playlists => only selected ones
        const selectedPlaylists = musicHandler.getAutoPlaylists(guildId);
        let tracks = musicHandler.getAutoQueueTracks(guildId);

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

        const sourceInfo = selectedPlaylists.length
          ? `from selected playlists (${selectedPlaylists.length})`
          : "from all tracks";

        return interaction.reply({
          content: `✅ Auto enabled (${tracks.length} tracks, ${sourceInfo})`,
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
      const ppQueue = await getPreviousPriorityQueue(guildId);
      const pQueue = await getPriorityQueue(guildId);
      const { getHistory } = require("../../functions/handlers/handleMusic");
      const history = getHistory(guildId);

      // Check if there's something to skip to
      const hasQueue = queue && queue.length > 0;
      const hasPriority =
        (ppQueue && ppQueue.length > 0) || (pQueue && pQueue.length > 0);

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

      // Determine what will be played after skipping current.  We examine copies
      // of the priority and main queues and remove the skipped song if it sits at
      // the head so that the message doesn't mistakenly report it again.
      let nextSongName = null;
      const skippedPath =
        history && history.length > 0 ? history[history.length - 1] : null;

      // copy arrays to avoid mutating real data
      const ppCopy = ppQueue ? ppQueue.slice() : [];
      const pCopy = pQueue ? pQueue.slice() : [];
      const qCopy = queue ? queue.slice() : [];

      // drop the skipped track if it's queued as first in either list
      if (skippedPath) {
        if (ppCopy.length > 0 && ppCopy[0] === skippedPath) ppCopy.shift();
        if (pCopy.length > 0 && pCopy[0] === skippedPath) pCopy.shift();
        if (qCopy.length > 0 && qCopy[0] === skippedPath) qCopy.shift();
      }

      // priority wins if anything remains
      let nextIsPriority = false;
      if (ppCopy.length > 0) {
        nextSongName = await getSongName(ppCopy[0]);
      } else if (pCopy.length > 0) {
        nextIsPriority = true;
        nextSongName = await getSongName(pCopy[0]);
      } else if (qCopy.length > 0) {
        nextSongName = await getSongName(qCopy[0]);
      }

      // attach flag value back to skipMsg later
      const priorityIndicator = nextIsPriority ? "⭐ " : "";

      let skipMsg = `⏭️ Skipped: **${skippedSongName || "Unknown"}**`;
      if (nextSongName) {
        skipMsg += `\n⏭️ Next: ${priorityIndicator}**${nextSongName}**`;
      } else {
        skipMsg += `\n⏭️ Queue is now empty!`;
      }

      await interaction.reply({
        content: skipMsg,
        // visible to everyone now
      });

      const musicHandler = require("../../functions/handlers/handleMusic");
      // Stop the player but keep the connection alive to avoid reconnect
      const playerRef = musicHandler.players[guildId];
      if (playerRef) {
        try {
          if (typeof playerRef.stop === "function") {
            playerRef.stop();
          }
        } catch (e) {
          logger.error(`Failed stopping player: ${e}`);
        }
      }
      musicHandler.isPlaying[guildId] = false;

      try {
        await playNext(guildId, interaction);
      } catch (err) {
        logger.error(`playNext error in 'next' action: ${err}`);
      }
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

      try {
        await playNext(guildId, interaction);
      } catch (err) {
        logger.error(`playNext error in 'resume' action: ${err}`);
      }
    }
  },
};
