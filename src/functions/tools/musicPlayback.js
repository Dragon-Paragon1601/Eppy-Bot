function createMusicPlaybackTools({
  logger,
  clearAudioFolders,
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
  getQueue,
  saveQueue,
  smartShuffleTracks,
  getAutoMode,
  getRandomMode,
  getPreviousPriorityQueue,
  getPriorityQueue,
  getSongName,
  sendNotification,
  getSongDuration,
  formatTime,
  createProgressBar,
  pushHistory,
  pushPreviousQueue,
  recordTrackPlayForSmartShuffle,
  firstSongStartedMap,
  connections,
  idleTimers,
  isPlaying,
  players,
  queues,
  currentlyPlayingSource,
  nextTrackInfo,
  loopSongMap,
  _startingSet,
  loopQueueMap,
  loopSourceMap,
  progressIntervalsMap,
  skipPreviousRecordMap,
  skipQueueShiftMap,
  currentTrackMap,
}) {
  async function queueEmpty(guildId, interaction) {
    const emptyCheck = await getQueue(guildId);
    if (emptyCheck.length === 0) {
      logger.debug(`🚫 Queue for guild ${guildId} is empty.`);
      if (
        loopQueueMap.get(guildId) &&
        Array.isArray(loopSourceMap.get(guildId)) &&
        loopSourceMap.get(guildId).length > 0
      ) {
        const source = loopSourceMap.get(guildId);
        const useSmartShuffle = getAutoMode(guildId) && getRandomMode(guildId);
        const refilledQueue = useSmartShuffle
          ? await smartShuffleTracks(guildId, source)
          : [...source];

        await saveQueue(guildId, refilledQueue);
        logger.debug(
          `🔁 Looping queue for guild ${guildId}. Refilled ${source.length} tracks${useSmartShuffle ? " (smart shuffle)" : ""}.`,
        );
        try {
          await playNext(guildId, interaction);
        } catch (err) {
          logger.error(`Error in queueEmpty playNext call: ${err}`);
        }
        return;
      }

      if (interaction.channel) {
        interaction.channel.send(
          "⌛ Queue is empty. Waiting for another song!",
        );
      }
      clearAudioFolders(guildId);
      await saveQueue(guildId, []);

      idleTimers[guildId] = setTimeout(() => {
        if (!queues[guildId]?.length && connections[guildId]) {
          connections[guildId].destroy();
          delete connections[guildId];
          logger.debug(`⏹️ Bot disconnected from ${guildId} due to no music.`);
        }
      }, 180000);
    }
  }

  async function playNext(guildId, interaction) {
    if (progressIntervalsMap.has(guildId)) {
      const oldInterval = progressIntervalsMap.get(guildId);
      clearInterval(oldInterval);
      progressIntervalsMap.delete(guildId);
    }

    if (idleTimers[guildId]) {
      if (typeof idleTimers[guildId].progressInterval === "number") {
        clearInterval(idleTimers[guildId].progressInterval);
      } else if (idleTimers[guildId].progressInterval) {
        clearInterval(idleTimers[guildId].progressInterval);
      }
      idleTimers[guildId].progressInterval = null;
    }

    if (isPlaying[guildId]) return;
    if (_startingSet.has(guildId)) return;
    _startingSet.add(guildId);

    try {
      let queue = await getQueue(guildId);

      await queueEmpty(guildId, interaction);
      queue = await getQueue(guildId);

      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) {
        logger.debug(`🚫 User left voice channel. Bot disconnecting.`);
        connections[guildId]?.destroy();
        delete connections[guildId];
        return;
      }

      if (
        !connections[guildId] ||
        connections[guildId].joinConfig.channelId !== voiceChannel.id
      ) {
        if (connections[guildId]) {
          connections[guildId].destroy();
        }

        connections[guildId] = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: true,
        });

        logger.debug(
          `✅ Bot joined voice channel: ${voiceChannel.id} on server ${guildId}`,
        );
      }

      if (!connections[guildId]) {
        logger.error(
          `❌ Error: Bot couldn't join the voice channel on server ${guildId}`,
        );
        return;
      }

      let isConnectionReady = false;
      try {
        await entersState(
          connections[guildId],
          VoiceConnectionStatus.Ready,
          8000,
        );
        isConnectionReady = true;
      } catch (firstError) {
        logger.warn(
          `Voice connection not ready on first attempt for ${guildId}: ${firstError?.message || firstError}`,
        );

        try {
          if (typeof connections[guildId]?.rejoin === "function") {
            connections[guildId].rejoin();
          }
          await entersState(
            connections[guildId],
            VoiceConnectionStatus.Ready,
            6000,
          );
          isConnectionReady = true;
        } catch (secondError) {
          logger.warn(
            `Voice connection still not ready after rejoin for ${guildId}: ${secondError?.message || secondError}. Continuing with playback attempt.`,
          );
        }
      }

      logger.debug(
        `Voice readiness for ${guildId}: ready=${isConnectionReady}, status=${connections[guildId]?.state?.status || "unknown"}`,
      );

      let songPath;
      const ppQueue = getPreviousPriorityQueue(guildId);
      const pQueue = getPriorityQueue(guildId);
      if (ppQueue && ppQueue.length > 0) {
        songPath = ppQueue.shift();
        currentlyPlayingSource[guildId] = "previous_priority";
      } else if (pQueue && pQueue.length > 0) {
        songPath = pQueue.shift();
        currentlyPlayingSource[guildId] = "priority";
      } else {
        songPath = queue[0];
        currentlyPlayingSource[guildId] = "main";
      }

      if (!songPath) {
        logger.error(`🚫 Error: No valid track to play for ${guildId}`);
        return;
      }

      const nextPPQueue = getPreviousPriorityQueue(guildId);
      const nextPQueue = getPriorityQueue(guildId);
      const nextQueue = await getQueue(guildId);
      let nextTrackData = null;

      if (currentlyPlayingSource[guildId] === "previous_priority") {
        if (nextPPQueue && nextPPQueue.length > 0) {
          nextTrackData = { songPath: nextPPQueue[0], source: "previous" };
        } else if (nextPQueue && nextPQueue.length > 0) {
          nextTrackData = { songPath: nextPQueue[0], source: "priority" };
        } else if (nextQueue && nextQueue.length > 0) {
          nextTrackData = { songPath: nextQueue[0], source: "main" };
        }
      } else if (currentlyPlayingSource[guildId] === "priority") {
        if (nextPPQueue && nextPPQueue.length > 0) {
          nextTrackData = { songPath: nextPPQueue[0], source: "previous" };
        } else if (nextPQueue && nextPQueue.length > 0) {
          nextTrackData = { songPath: nextPQueue[0], source: "priority" };
        } else if (nextQueue && nextQueue.length > 0) {
          nextTrackData = { songPath: nextQueue[0], source: "main" };
        }
      } else if (currentlyPlayingSource[guildId] === "main") {
        if (nextPPQueue && nextPPQueue.length > 0) {
          nextTrackData = { songPath: nextPPQueue[0], source: "previous" };
        } else if (nextPQueue && nextPQueue.length > 0) {
          nextTrackData = { songPath: nextPQueue[0], source: "priority" };
        } else if (nextQueue && nextQueue.length > 1) {
          nextTrackData = { songPath: nextQueue[1], source: "main" };
        }
      }
      nextTrackInfo.set(guildId, nextTrackData);

      const resource = createAudioResource(songPath);
      if (
        !players[guildId] ||
        players[guildId].state?.status === AudioPlayerStatus.Idle
      ) {
        players[guildId] = createAudioPlayer();
      }

      const subscription = connections[guildId].subscribe(players[guildId]);
      if (!subscription) {
        logger.error(
          `❌ Failed to subscribe player to voice connection for ${guildId}`,
        );
        return;
      }

      logger.debug(
        `Voice subscription created for ${guildId}. connectionStatus=${connections[guildId]?.state?.status || "unknown"}`,
      );

      players[guildId].play(resource);
      if (players[guildId].state?.status === AudioPlayerStatus.Paused) {
        players[guildId].unpause();
      }

      logger.debug(
        `Player state after play for ${guildId}: ${players[guildId].state?.status || "unknown"}`,
      );

      isPlaying[guildId] = true;
      currentTrackMap.set(guildId, songPath);

      const songName = await getSongName(songPath);
      const isPrioritySong = currentlyPlayingSource[guildId] === "priority";
      const displayName = isPrioritySong ? `⭐ ${songName}` : songName;

      logger.info(
        `🎵 Now playing for ${guildId}: ${songName} (priority: ${isPrioritySong})`,
      );
      pushHistory(guildId, songPath);

      const [sentMessage, totalTime] = await Promise.all([
        sendNotification(
          guildId,
          interaction,
          `🎶 Now playing: **${songName}**`,
        ),
        getSongDuration(songPath),
      ]);

      if (sentMessage && typeof sentMessage.edit === "function") {
        try {
          sentMessage.edit(
            `🎶 Now playing: **${displayName}** [${formatTime(totalTime)}]`,
          );
        } catch (e) {
          logger.error(
            `Failed editing initial notification for duration: ${e}`,
          );
        }
      }

      if (!idleTimers[guildId]) idleTimers[guildId] = {};
      if (idleTimers[guildId]?.progressInterval) {
        clearInterval(idleTimers[guildId].progressInterval);
      }

      if (sentMessage && typeof sentMessage.edit === "function") {
        let lastProgressSegment = -1;

        const progressInterval = setInterval(() => {
          if (players[guildId].state.status === AudioPlayerStatus.Playing) {
            const currentTime =
              players[guildId].state.resource.playbackDuration;
            const currentProgress = Math.round((currentTime / totalTime) * 23);

            let shouldUpdate = false;
            if (currentProgress !== lastProgressSegment) {
              lastProgressSegment = currentProgress;
              shouldUpdate = true;
            }

            if (shouldUpdate) {
              try {
                sentMessage.edit(
                  `🎶 **${displayName}** (${formatTime(totalTime)})\n[${createProgressBar(currentTime, totalTime)}]`,
                );
              } catch (e) {
                logger.error(`Failed editing progress message: ${e}`);
              }
            }
          }
        }, 100);

        idleTimers[guildId].progressInterval = progressInterval;
        progressIntervalsMap.set(guildId, progressInterval);

        try {
          sentMessage.edit(
            `🎶 **${songName}** (${formatTime(totalTime)})\n[${createProgressBar(0, totalTime)}]`,
          );
        } catch (e) {
          logger.debug(`Initial progress bar edit failed: ${e}`);
        }

        players[guildId].once(AudioPlayerStatus.Idle, async () => {
          if (progressIntervalsMap.has(guildId)) {
            clearInterval(progressIntervalsMap.get(guildId));
            progressIntervalsMap.delete(guildId);
          }
          if (idleTimers[guildId]?.progressInterval) {
            clearInterval(idleTimers[guildId].progressInterval);
            idleTimers[guildId].progressInterval = null;
          }
          try {
            const cachedNextTrack = nextTrackInfo.get(guildId);
            if (cachedNextTrack) {
              await getSongName(cachedNextTrack.songPath);
            }

            const finishedMsg = `🎶 Finished playing: **${isPrioritySong ? "⭐ " : ""}${songName}**`;
            sentMessage.edit(finishedMsg);
          } catch (e) {
            logger.error(`Failed editing finished message: ${e}`);
          }

          if (skipPreviousRecordMap.get(guildId)) {
            skipPreviousRecordMap.delete(guildId);
          } else {
            pushPreviousQueue(guildId, songPath);
          }

          await recordTrackPlayForSmartShuffle(guildId, songPath);

          isPlaying[guildId] = false;
          firstSongStartedMap.set(guildId, false);
          queue = await getQueue(guildId);
          const loopSong = loopSongMap.get(guildId);
          if (skipQueueShiftMap.get(guildId)) {
            skipQueueShiftMap.delete(guildId);
          } else if (currentlyPlayingSource[guildId] === "main") {
            if (!loopSong || loopSong !== songPath) {
              if (queue.length > 0) {
                queue.shift();
                await saveQueue(guildId, queue);
              }
            }
          }

          delete currentlyPlayingSource[guildId];
          currentTrackMap.delete(guildId);
          nextTrackInfo.delete(guildId);
          _startingSet.delete(guildId);
          try {
            await playNext(guildId, interaction);
          } catch (err) {
            logger.error(`Error in Idle listener playNext call: ${err}`);
          }
        });
      } else {
        players[guildId].once(AudioPlayerStatus.Idle, async () => {
          if (progressIntervalsMap.has(guildId)) {
            clearInterval(progressIntervalsMap.get(guildId));
            progressIntervalsMap.delete(guildId);
          }
          if (idleTimers[guildId]?.progressInterval) {
            clearInterval(idleTimers[guildId].progressInterval);
            idleTimers[guildId].progressInterval = null;
          }
          if (skipPreviousRecordMap.get(guildId)) {
            skipPreviousRecordMap.delete(guildId);
          } else {
            pushPreviousQueue(guildId, songPath);
          }

          await recordTrackPlayForSmartShuffle(guildId, songPath);

          isPlaying[guildId] = false;
          firstSongStartedMap.set(guildId, false);
          queue = await getQueue(guildId);
          const loopSong = loopSongMap.get(guildId);
          if (skipQueueShiftMap.get(guildId)) {
            skipQueueShiftMap.delete(guildId);
          } else if (currentlyPlayingSource[guildId] === "main") {
            if (!loopSong || loopSong !== songPath) {
              if (queue.length > 0) {
                queue.shift();
                await saveQueue(guildId, queue);
              }
            }
          }
          delete currentlyPlayingSource[guildId];
          currentTrackMap.delete(guildId);
          if (!_startingSet.has(guildId)) {
            try {
              await playNext(guildId, interaction);
            } catch (err) {
              logger.error(
                `Error in fallback Idle listener playNext call: ${err}`,
              );
            }
          }
        });
      }

      if (idleTimers[guildId]) clearTimeout(idleTimers[guildId]);
    } finally {
      if (!isPlaying[guildId]) _startingSet.delete(guildId);
    }
  }

  function startPlaying(interaction) {
    const guildId = interaction.guild.id;
    if (
      !players[guildId] ||
      players[guildId].state.status !== AudioPlayerStatus.Playing
    ) {
      playNext(guildId, interaction);
    }
  }

  return {
    queueEmpty,
    playNext,
    startPlaying,
  };
}

module.exports = {
  createMusicPlaybackTools,
};
