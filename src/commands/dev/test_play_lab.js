const { SlashCommandBuilder, GatewayIntentBits } = require("discord.js");
const path = require("path");
const fs = require("fs");
const os = require("os");
const dnsNative = require("dns");
const dns = require("dns").promises;
const tls = require("tls");
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
    .setName("test_play_lab")
    .setDescription("DEV LAB: voice debug with hard reconnect diagnostics"),

  async execute(interaction) {
    const traceId = `tp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const logLines = [];
    const startedAt = Date.now();

    const pushLine = (text) => {
      const line = `[${new Date().toISOString()}] ${text}`;
      logLines.push(line);
      if (logLines.length > 220) logLines.shift();
      logger.info(`[test_play][${traceId}] ${text}`);
    };

    const pushError = (text) => {
      const line = `[${new Date().toISOString()}] ❌ ${text}`;
      logLines.push(line);
      if (logLines.length > 220) logLines.shift();
      logger.error(`[test_play][${traceId}] ${text}`);
    };

    const pushWarn = (text) => {
      const line = `[${new Date().toISOString()}] ⚠️ ${text}`;
      logLines.push(line);
      if (logLines.length > 220) logLines.shift();
      logger.warn(`[test_play][${traceId}] ${text}`);
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

    const redact = (value, showStart = 6, showEnd = 4) => {
      const str = String(value || "");
      if (!str) return "";
      if (str.length <= showStart + showEnd) return "*".repeat(str.length);
      return `${str.slice(0, showStart)}...${str.slice(-showEnd)}`;
    };

    const parseVoiceEndpoint = (endpoint) => {
      if (!endpoint || typeof endpoint !== "string") return null;
      const normalized = endpoint.replace(/^wss?:\/\//i, "").trim();
      const lastColon = normalized.lastIndexOf(":");
      const hasPort = lastColon > -1 && normalized.indexOf("]") < lastColon;
      if (!hasPort) {
        return { host: normalized, port: 443 };
      }

      const host = normalized.slice(0, lastColon);
      const portRaw = normalized.slice(lastColon + 1);
      const port = Number(portRaw);
      if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        return { host: normalized, port: 443 };
      }

      return { host, port };
    };

    const getNetworkSnapshot = () => {
      const interfaces = os.networkInterfaces();
      const summary = [];
      for (const [name, addresses] of Object.entries(interfaces || {})) {
        for (const addr of addresses || []) {
          summary.push({
            name,
            family: addr.family,
            address: addr.address,
            internal: addr.internal,
            cidr: addr.cidr,
          });
        }
      }
      return summary;
    };

    const testTlsConnect = (host, port = 443, timeoutMs = 5000) => {
      return new Promise((resolve) => {
        const started = Date.now();
        let settled = false;

        const socket = tls.connect(
          {
            host,
            port,
            servername: host,
            rejectUnauthorized: false,
            timeout: timeoutMs,
          },
          () => {
            if (settled) return;
            settled = true;
            const elapsed = Date.now() - started;
            const proto = socket.getProtocol ? socket.getProtocol() : "unknown";
            resolve({ ok: true, elapsed, protocol: proto });
            socket.end();
          },
        );

        socket.on("timeout", () => {
          if (settled) return;
          settled = true;
          resolve({
            ok: false,
            elapsed: Date.now() - started,
            error: "timeout",
          });
          socket.destroy();
        });

        socket.on("error", (err) => {
          if (settled) return;
          settled = true;
          resolve({
            ok: false,
            elapsed: Date.now() - started,
            error: err?.message || String(err),
            code: err?.code || null,
          });
        });
      });
    };

    const runVoiceEndpointDiagnostics = async (endpoint) => {
      const parsed = parseVoiceEndpoint(endpoint);
      if (!parsed?.host) {
        pushWarn("Voice endpoint diagnostics skipped (empty endpoint).");
        return;
      }
      const { host, port } = parsed;

      pushLine(`Voice endpoint diagnostics start: host=${host}, port=${port}`);

      try {
        const lookupAll = await dns.lookup(host, { all: true });
        pushLine(`DNS lookup(all): ${stringifySafe(lookupAll)}`);
      } catch (err) {
        pushError(
          `DNS lookup(all) failed for ${host}: ${err?.code || ""} ${err?.message || err}`,
        );
      }

      try {
        const ipv4 = await dns.resolve4(host);
        pushLine(`DNS resolve4: ${stringifySafe(ipv4)}`);
      } catch (err) {
        pushWarn(
          `DNS resolve4 failed for ${host}: ${err?.code || ""} ${err?.message || err}`,
        );
      }

      try {
        const ipv6 = await dns.resolve6(host);
        pushLine(`DNS resolve6: ${stringifySafe(ipv6)}`);
      } catch (err) {
        pushWarn(
          `DNS resolve6 failed for ${host}: ${err?.code || ""} ${err?.message || err}`,
        );
      }

      const tlsResult = await testTlsConnect(host, port, 5000);
      pushLine(
        `TLS connectivity to ${host}:${port} => ${stringifySafe(tlsResult)}`,
      );

      if (port !== 443) {
        const tls443 = await testTlsConnect(host, 443, 5000);
        pushLine(
          `TLS connectivity to ${host}:443 (fallback probe) => ${stringifySafe(tls443)}`,
        );
      }
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
    let gotVoiceStateUpdate = false;
    let gotVoiceServerUpdate = false;
    let voiceStatePacketCount = 0;
    let voiceServerPacketCount = 0;
    let firstVoiceStateAt = null;
    let firstVoiceServerAt = null;
    let lastVoiceEndpoint = null;
    let endpointDiagnosticsPromise = null;
    let voiceChannelForJoin = null;
    let manualConfigureKickCount = 0;
    let forceVoiceEndpoint443 = false;

    const replaceEndpointPort = (endpoint, forcedPort) => {
      const parsed = parseVoiceEndpoint(endpoint);
      if (!parsed?.host) return endpoint;
      return `${parsed.host}:${forcedPort}`;
    };

    const getCurrentAdapterCreator = () => {
      const baseCreator = interaction.guild.voiceAdapterCreator;
      if (!forceVoiceEndpoint443) return baseCreator;

      return (methods) => {
        const wrappedMethods = {
          ...methods,
          onVoiceServerUpdate: (data) => {
            try {
              const originalEndpoint = data?.endpoint || null;
              const rewritten = originalEndpoint
                ? replaceEndpointPort(originalEndpoint, 443)
                : originalEndpoint;

              if (
                originalEndpoint &&
                rewritten &&
                originalEndpoint !== rewritten
              ) {
                pushWarn(
                  `LAB fallback: rewriting VOICE_SERVER_UPDATE endpoint from ${originalEndpoint} to ${rewritten}.`,
                );
              }

              methods.onVoiceServerUpdate({
                ...data,
                endpoint: rewritten,
              });
            } catch (err) {
              pushError(
                `Adapter endpoint rewrite failed: ${err?.message || err}. Forwarding original payload.`,
              );
              methods.onVoiceServerUpdate(data);
            }
          },
        };

        return baseCreator(wrappedMethods);
      };
    };

    const tryManualConfigureNetworking = (reasonLabel) => {
      if (!connection) return false;
      const configureFn = connection.configureNetworking;
      if (typeof configureFn !== "function") {
        pushWarn(
          `Manual networking kick skipped (${reasonLabel}): configureNetworking not exposed.`,
        );
        return false;
      }

      try {
        configureFn.call(connection);
        manualConfigureKickCount += 1;
        pushLine(
          `Manual networking kick #${manualConfigureKickCount} via configureNetworking() (${reasonLabel}).`,
        );
        return true;
      } catch (err) {
        pushError(
          `Manual configureNetworking failed (${reasonLabel}): ${err?.message || err}`,
        );
        return false;
      }
    };

    const createFreshConnection = (reasonLabel) => {
      if (connection) {
        try {
          connection.destroy();
          pushLine(
            `Destroyed previous voice connection before re-create (${reasonLabel}).`,
          );
        } catch (destroyErr) {
          pushWarn(
            `Previous connection destroy failed during re-create: ${destroyErr?.message || destroyErr}`,
          );
        }
      }

      connection = joinVoiceChannel({
        channelId: voiceChannelForJoin.id,
        guildId: interaction.guild.id,
        adapterCreator: getCurrentAdapterCreator(),
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

      connection.on("debug", (message) => {
        pushLine(`Voice debug: ${message}`);
      });

      pushLine(
        `Voice connection (${reasonLabel}) created. current=${connection.state?.status}, forceVoiceEndpoint443=${forceVoiceEndpoint443}`,
      );
    };

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
              const netCode =
                connection?.state?.networking?.state?.code ?? null;
              const status = connection?.state?.status;
              if (
                status === VoiceConnectionStatus.Signalling ||
                netCode === 6
              ) {
                const parsedEndpoint = parseVoiceEndpoint(lastVoiceEndpoint);
                if (
                  !forceVoiceEndpoint443 &&
                  parsedEndpoint?.port &&
                  parsedEndpoint.port !== 443
                ) {
                  forceVoiceEndpoint443 = true;
                  pushWarn(
                    `Retry strategy: enabling LAB endpoint port fallback to 443 (last endpoint port=${parsedEndpoint.port}).`,
                  );
                  createFreshConnection(
                    `force-endpoint-443-attempt-${attempt + 1}`,
                  );
                  continue;
                }

                // Lab-only hotfix path: try configureNetworking once before hard recreate.
                if (
                  gotVoiceStateUpdate &&
                  gotVoiceServerUpdate &&
                  manualConfigureKickCount < 2
                ) {
                  const kicked = tryManualConfigureNetworking(
                    `pre-hard-recreate-attempt-${attempt + 1}`,
                  );
                  if (kicked) {
                    pushLine(
                      "Manual networking kick sent; waiting for next attempt before destroying connection.",
                    );
                    continue;
                  }
                }

                pushLine(
                  `Retry strategy: hard re-create connection (status=${status}, netCode=${netCode}).`,
                );
                createFreshConnection(`hard-recreate-attempt-${attempt + 1}`);
              } else {
                pushLine(
                  `Retry strategy: connection.rejoin() before next attempt.`,
                );
                connection.rejoin();
              }
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
      pushLine(`Elapsed total=${Date.now() - startedAt}ms`);

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
      try {
        dnsNative.setDefaultResultOrder("ipv4first");
        pushLine("DNS preference forced for process: ipv4first (lab mode).");
      } catch (dnsErr) {
        pushWarn(
          `Unable to force ipv4first DNS preference: ${dnsErr?.message || dnsErr}`,
        );
      }
      pushLine(
        `Context: guild=${interaction.guild?.id || "unknown"}, user=${interaction.user?.id || "unknown"}, textChannel=${interaction.channelId || "unknown"}`,
      );
      pushLine(
        `Runtime: node=${process.version}, platform=${process.platform}, arch=${process.arch}, pid=${process.pid}, uptimeSec=${Math.round(process.uptime())}, cwd=${process.cwd()}`,
      );
      pushLine(
        `OS: hostname=${os.hostname()}, release=${os.release()}, totalMemMB=${Math.round(os.totalmem() / 1024 / 1024)}, freeMemMB=${Math.round(os.freemem() / 1024 / 1024)}, loadavg=${stringifySafe(os.loadavg())}`,
      );
      pushLine(`Network interfaces: ${stringifySafe(getNetworkSnapshot())}`);
      pushLine(
        `Client ws status=${interaction.client.ws.status}, ping=${interaction.client.ws.ping}, shardCount=${interaction.client.ws.shards?.size || "n/a"}`,
      );
      const intentsBitfield = Number(
        interaction.client.options?.intents?.bitfield || 0,
      );
      pushLine(
        `Gateway intents bitfield=${intentsBitfield}, hasGuildVoiceStates=${!!(intentsBitfield & GatewayIntentBits.GuildVoiceStates)}`,
      );
      const shardId = interaction.guild?.shardId;
      const shard =
        typeof shardId === "number"
          ? interaction.client.ws.shards.get(shardId)
          : null;
      pushLine(
        `Shard detail: guildShardId=${shardId}, shardStatus=${shard?.status ?? "n/a"}, shardPing=${shard?.ping ?? "n/a"}`,
      );
      pushLine(
        `Env snapshot: NODE_OPTIONS=${process.env.NODE_OPTIONS || "(empty)"}, DISCORD_TOKEN_present=${!!process.env.DISCORD_TOKEN}, TOKEN_present=${!!process.env.token || !!process.env.TOKEN}`,
      );
      pushLine(
        `Voice dependency report: ${generateDependencyReport().replace(/\n/g, " | ")}`,
      );
      pushLine(
        `Guild snapshot: name=${interaction.guild?.name || "unknown"}, ownerId=${interaction.guild?.ownerId || "unknown"}, memberCount=${interaction.guild?.memberCount || "unknown"}, premiumTier=${interaction.guild?.premiumTier || "unknown"}, preferredLocale=${interaction.guild?.preferredLocale || "unknown"}, afkChannelId=${interaction.guild?.afkChannelId || "none"}`,
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
      voiceChannelForJoin = voiceChannel;
      pushLine(
        `Voice channel metadata: type=${voiceChannel.type}, rtcRegion=${voiceChannel.rtcRegion || "auto"}, userLimit=${voiceChannel.userLimit}, full=${voiceChannel.full}`,
      );

      const me = interaction.guild.members.me;
      const perms = voiceChannel.permissionsFor(me);
      pushLine(
        `Bot permissions on VC: view=${perms?.has("ViewChannel")}, connect=${perms?.has("Connect")}, speak=${perms?.has("Speak")}, useVAD=${perms?.has("UseVAD")}`,
      );
      const userPerms = voiceChannel.permissionsFor(interaction.user.id);
      pushLine(
        `User permissions on VC: view=${userPerms?.has("ViewChannel")}, connect=${userPerms?.has("Connect")}, speak=${userPerms?.has("Speak")}`,
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
              gotVoiceStateUpdate = true;
              voiceStatePacketCount += 1;
              if (!firstVoiceStateAt) firstVoiceStateAt = Date.now();
              pushLine(
                `RAW VOICE_STATE_UPDATE(bot): channel_id=${d.channel_id}, session_id=${d.session_id || "n/a"}, deaf=${d.deaf}, mute=${d.mute}, self_deaf=${d.self_deaf}, self_mute=${d.self_mute}`,
              );

              if (
                gotVoiceServerUpdate &&
                connection?.state?.status ===
                  VoiceConnectionStatus.Signalling &&
                manualConfigureKickCount < 2
              ) {
                tryManualConfigureNetworking(
                  "raw-voice-state-update-in-signalling",
                );
              }
            }
          }

          if (t === "VOICE_SERVER_UPDATE") {
            gotVoiceServerUpdate = true;
            voiceServerPacketCount += 1;
            if (!firstVoiceServerAt) firstVoiceServerAt = Date.now();
            lastVoiceEndpoint = d.endpoint || null;
            pushLine(
              `RAW VOICE_SERVER_UPDATE: endpoint=${d.endpoint || "null"}, tokenPresent=${!!d.token}, tokenMasked=${redact(d.token || "")}, guild_id=${d.guild_id}`,
            );

            if (
              gotVoiceStateUpdate &&
              connection?.state?.status === VoiceConnectionStatus.Signalling &&
              manualConfigureKickCount < 2
            ) {
              tryManualConfigureNetworking(
                "raw-voice-server-update-in-signalling",
              );
            }

            if (!endpointDiagnosticsPromise && d.endpoint) {
              endpointDiagnosticsPromise = runVoiceEndpointDiagnostics(
                d.endpoint,
              )
                .catch((diagErr) => {
                  pushError(
                    `Voice endpoint diagnostics failed: ${diagErr?.message || diagErr}`,
                  );
                })
                .finally(() => {
                  endpointDiagnosticsPromise = null;
                });
            }
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

      createFreshConnection("initial");

      const ready = await waitForReadyWithRetry(3);
      if (!ready) {
        if (endpointDiagnosticsPromise) {
          pushLine(
            "Waiting for endpoint diagnostics completion before failure summary...",
          );
          await endpointDiagnosticsPromise;
        }
        pushLine(
          `Voice gateway packets summary: gotVoiceStateUpdate=${gotVoiceStateUpdate}, gotVoiceServerUpdate=${gotVoiceServerUpdate}`,
        );
        pushLine(
          `Voice packets counters: voiceStatePacketCount=${voiceStatePacketCount}, voiceServerPacketCount=${voiceServerPacketCount}, firstVoiceStateAt=${firstVoiceStateAt ? new Date(firstVoiceStateAt).toISOString() : "n/a"}, firstVoiceServerAt=${firstVoiceServerAt ? new Date(firstVoiceServerAt).toISOString() : "n/a"}, lastVoiceEndpoint=${lastVoiceEndpoint || "n/a"}`,
        );
        if (gotVoiceStateUpdate && !gotVoiceServerUpdate) {
          pushError(
            "Diagnostic: Missing VOICE_SERVER_UPDATE from gateway (bot gets VOICE_STATE_UPDATE only). Connection cannot leave signalling.",
          );
        } else if (!gotVoiceStateUpdate && !gotVoiceServerUpdate) {
          pushError(
            "Diagnostic: Missing both VOICE_STATE_UPDATE and VOICE_SERVER_UPDATE. Likely gateway/event delivery issue.",
          );
        } else if (gotVoiceStateUpdate && gotVoiceServerUpdate) {
          pushError(
            "Diagnostic: Both VOICE_* packets received but networking still closed/signalling. Likely voice endpoint/network transport problem.",
          );
        }
        pushError("Connection never reached READY after retries.");
        return cleanup("voice-not-ready");
      }
      pushLine("Voice connection reached READY state.");
      if (endpointDiagnosticsPromise) {
        pushLine("Waiting for endpoint diagnostics completion after READY...");
        await endpointDiagnosticsPromise;
      }
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
