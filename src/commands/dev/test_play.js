const { SlashCommandBuilder } = require("discord.js");
const path = require("path");
const fs = require("fs");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  generateDependencyReport,
} = require("@discordjs/voice");
const logger = require("../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("test_play")
    .setDescription("DEV: raw voice debug test (join channel + play push.mp3)"),

  async execute(interaction) {
    const traceId = `tp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const logLines = [];

    const pushLine = (text) => {
      const line = `[${new Date().toISOString()}] ${text}`;
      logLines.push(line);
      if (logLines.length > 45) logLines.shift();
      logger.info(`[test_play][${traceId}] ${text}`);
    };

    const pushError = (text) => {
      const line = `[${new Date().toISOString()}] ❌ ${text}`;
      logLines.push(line);
      if (logLines.length > 45) logLines.shift();
      logger.error(`[test_play][${traceId}] ${text}`);
    };

    const stringifySafe = (value) => {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    const describeVoiceState = (state) => {
      if (!state) return "(no-state)";
      const info = {
        status: state.status,
        reason: state.reason,
        closeCode: state.closeCode,
        subscriptionExists: !!state.subscription,
      };

      if (state.networking?.state) {
        info.networking = {
          code: state.networking.state.code,
          wsStatus:
            state.networking.state.ws?.readyState ??
            state.networking.state.connectionData?.code ??
            null,
          udpKeepAliveInterval:
            state.networking.state.udp?.keepAliveInterval ?? null,
        };
      }

      return stringifySafe(info);
    };

    const render = (title) => {
      const body = logLines.join("\n");
      const trimmed =
        body.length > 1700 ? body.slice(body.length - 1700) : body;
      return `🧪 **test_play debug** (${traceId})\n${title}\n\n\`\`\`\n${trimmed || "(no logs yet)"}\n\`\`\``;
    };

    const updateMessage = async (title) => {
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: render(title) });
        } else {
          await interaction.editReply({ content: render(title) });
        }
      } catch (err) {
        logger.error(
          `[test_play][${traceId}] Failed to update interaction message: ${err}`,
        );
      }
    };

    let connection = null;
    let player = null;
    let cleaned = false;
    let rawListener = null;

    const waitForReadyWithRetry = async (maxAttempts = 3) => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          pushLine(
            `Waiting for VoiceConnectionStatus.Ready. attempt=${attempt}/${maxAttempts}`,
          );
          await entersState(connection, VoiceConnectionStatus.Ready, 12_000);
          pushLine(`READY reached on attempt ${attempt}.`);
          return true;
        } catch (err) {
          pushError(
            `READY timeout/abort on attempt ${attempt}: ${err?.message || err}`,
          );
          pushLine(
            `Connection state snapshot after failed attempt: ${describeVoiceState(connection?.state)}`,
          );

          if (
            attempt < maxAttempts &&
            typeof connection?.rejoin === "function"
          ) {
            try {
              pushLine(`Calling connection.rejoin() before next attempt.`);
              connection.rejoin();
            } catch (rejoinErr) {
              pushError(
                `connection.rejoin failed: ${rejoinErr?.message || rejoinErr}`,
              );
            }
          }
        }
      }

      return false;
    };

    const cleanup = async (reason) => {
      if (cleaned) return;
      cleaned = true;

      pushLine(`Cleanup start. reason=${reason}`);

      try {
        if (rawListener) {
          interaction.client.off("raw", rawListener);
          rawListener = null;
          pushLine("Detached raw gateway listener.");
        }
      } catch (err) {
        pushError(`Failed detaching raw listener: ${err?.message || err}`);
      }

      try {
        if (player) {
          player.stop(true);
          pushLine("Player stopped.");
        }
      } catch (err) {
        pushError(`Player stop failed: ${err?.message || err}`);
      }

      try {
        if (connection) {
          connection.destroy();
          pushLine("Voice connection destroyed.");
        }
      } catch (err) {
        pushError(`Connection destroy failed: ${err?.message || err}`);
      }

      await updateMessage(`✅ Finished (${reason})`);
    };

    try {
      pushLine("Command execution started.");
      pushLine(
        `Context: guild=${interaction.guild?.id || "unknown"}, user=${interaction.user?.id || "unknown"}, textChannel=${interaction.channelId || "unknown"}`,
      );
      pushLine(
        `Client ws status=${interaction.client.ws.status}, ping=${interaction.client.ws.ping}, shardCount=${interaction.client.ws.shards?.size || "n/a"}`,
      );
      pushLine(
        `Voice dependency report: ${generateDependencyReport().replace(/\n/g, " | ")}`,
      );

      const member = interaction.member;
      const voiceChannel = member?.voice?.channel || null;

      if (!voiceChannel) {
        pushError("User is not in a voice channel.");
        return updateMessage("⛔ Stopped (user not in voice)");
      }

      pushLine(
        `Voice target: id=${voiceChannel.id}, name=${voiceChannel.name}, bitrate=${voiceChannel.bitrate}, members=${voiceChannel.members?.size || "n/a"}`,
      );
      pushLine(
        `Voice channel metadata: type=${voiceChannel.type}, rtcRegion=${voiceChannel.rtcRegion || "auto"}, userLimit=${voiceChannel.userLimit}, full=${voiceChannel.full}`,
      );

      const me = interaction.guild.members.me;
      const perms = voiceChannel.permissionsFor(me);
      pushLine(
        `Bot permissions on VC: view=${perms?.has("ViewChannel")}, connect=${perms?.has("Connect")}, speak=${perms?.has("Speak")}, useVAD=${perms?.has("UseVAD")}`,
      );

      rawListener = (packet) => {
        try {
          const t = packet?.t;
          const d = packet?.d;
          if (!t || !d) return;
          if (d.guild_id !== interaction.guild.id) return;

          if (t === "VOICE_STATE_UPDATE") {
            const isBot = d.user_id === interaction.client.user.id;
            if (isBot) {
              pushLine(
                `RAW VOICE_STATE_UPDATE(bot): channel_id=${d.channel_id}, session_id=${d.session_id || "n/a"}, deaf=${d.deaf}, mute=${d.mute}, self_deaf=${d.self_deaf}, self_mute=${d.self_mute}`,
              );
            }
          }

          if (t === "VOICE_SERVER_UPDATE") {
            pushLine(
              `RAW VOICE_SERVER_UPDATE: endpoint=${d.endpoint || "null"}, tokenPresent=${!!d.token}, guild_id=${d.guild_id}`,
            );
          }
        } catch (err) {
          pushError(`RAW listener error: ${err?.message || err}`);
        }
      };

      interaction.client.on("raw", rawListener);
      pushLine("Attached raw gateway listener for VOICE_* packets.");

      const audioPath = path.resolve(__dirname, "../music/push.mp3");
      pushLine(`Audio path resolved: ${audioPath}`);

      if (!fs.existsSync(audioPath)) {
        pushError(`Audio file not found at: ${audioPath}`);
        return updateMessage("⛔ Stopped (missing push.mp3)");
      }

      const stat = fs.statSync(audioPath);
      pushLine(
        `Audio file OK: size=${stat.size} bytes, modified=${stat.mtime.toISOString()}`,
      );

      await updateMessage("🔌 Creating voice connection...");

      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      connection.on("stateChange", (oldState, newState) => {
        pushLine(
          `Voice state change: ${oldState?.status || "unknown"} -> ${newState?.status || "unknown"}`,
        );
        pushLine(`Voice state details old=${describeVoiceState(oldState)}`);
        pushLine(`Voice state details new=${describeVoiceState(newState)}`);
      });

      connection.on("error", (err) => {
        pushError(`Voice connection error: ${err?.message || err}`);
      });

      pushLine(`Voice connection created. current=${connection.state?.status}`);

      const ready = await waitForReadyWithRetry(3);
      if (!ready) {
        pushError("Connection never reached READY after retries.");
        return cleanup("voice-not-ready");
      }
      pushLine("Voice connection reached READY state.");
      await updateMessage("✅ Voice ready. Creating audio player...");

      player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
        },
      });

      player.on("stateChange", (oldState, newState) => {
        pushLine(
          `Player state change: ${oldState?.status || "unknown"} -> ${newState?.status || "unknown"}`,
        );
      });

      player.on("error", (err) => {
        pushError(`Player error: ${err?.message || err}`);
      });

      const subscription = connection.subscribe(player);
      pushLine(`Player subscribed=${!!subscription}`);
      if (!subscription) {
        pushError("Subscription failed (connection.subscribe returned null).");
        return cleanup("subscribe-failed");
      }

      const resource = createAudioResource(audioPath, {
        inlineVolume: true,
      });

      if (resource.volume) {
        resource.volume.setVolume(1.0);
        pushLine("Resource volume explicitly set to 1.0");
      }

      pushLine("Starting playback now.");
      player.play(resource);

      await entersState(player, AudioPlayerStatus.Playing, 15_000);
      pushLine("Player reached PLAYING state.");
      await updateMessage("▶️ Playback started. Waiting for Idle...");

      await Promise.race([
        entersState(player, AudioPlayerStatus.Idle, 180_000),
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Timeout waiting for Idle")),
            180_000,
          );
        }),
      ]);

      pushLine("Player reached IDLE (track finished or stopped).");
      await cleanup("track-finished");
    } catch (err) {
      pushError(
        `Unhandled execute error: ${err?.stack || err?.message || err}`,
      );
      await cleanup("execute-error");
    }
  },
};
